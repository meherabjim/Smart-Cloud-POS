const bcrypt = require("bcryptjs");
const db = require("../config/db");
const { validateAccount, maskAccount, accountLabel } = require("../config/payout");

// =========================================================
// Salary account (where a staff member's salary goes)
//
// Rules
//  - First time (no Active account yet): saved as Active at once.
//    This happens right after face registration.
//  - Later changes: staff must re-enter their password, and the
//    change stays "Pending" until Admin approves it. Salary keeps
//    going to the old Active account until then.
//  - Admin changing their own account: Active at once (password still required).
// =========================================================

const publicAccount = (row, { full = true } = {}) =>
  row
    ? {
        id: row.id,
        method: row.method,
        account_no: full ? row.account_no : maskAccount(row.account_no),
        account_name: row.account_name,
        bank_name: row.bank_name,
        branch: row.branch,
        status: row.status,
        label: accountLabel(row, { full }),
        requested_at: row.requested_at,
      }
    : null;

const getActiveAndPending = async (userId, conn = db) => {
  const [rows] = await conn.query(
    `SELECT * FROM staff_accounts
     WHERE user_id = ? AND status IN ('Active', 'Pending')
     ORDER BY id DESC`,
    [userId]
  );
  return {
    active: rows.find((r) => r.status === "Active") || null,
    pending: rows.find((r) => r.status === "Pending") || null,
  };
};

// ========================================
// GET /api/payout/me
// ========================================
exports.getMine = async (req, res) => {
  try {
    const { active, pending } = await getActiveAndPending(req.user.id);
    return res.json({
      success: true,
      active: publicAccount(active),
      pending: publicAccount(pending),
    });
  } catch (error) {
    console.error("Get Payout Account Error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ========================================
// POST /api/payout/me
// body: { method, account_no, account_name, bank_name, branch, password }
// ========================================
exports.saveMine = async (req, res) => {
  const check = validateAccount(req.body);
  if (!check.ok) {
    return res.status(400).json({ success: false, message: check.message });
  }
  const acc = check.value;

  let connection;
  try {
    connection = await db.getConnection();
    await connection.beginTransaction();

    const { active } = await getActiveAndPending(req.user.id, connection);

    // ---- First-time setup -> Active immediately ----
    if (!active) {
      await connection.query(
        `INSERT INTO staff_accounts
           (user_id, method, account_no, account_name, bank_name, branch, status)
         VALUES (?, ?, ?, ?, ?, ?, 'Active')`,
        [req.user.id, acc.method, acc.account_no, acc.account_name, acc.bank_name, acc.branch]
      );
      await connection.commit();
      return res.json({ success: true, status: "Active", message: "Salary account saved." });
    }

    // ---- Change request -> password required ----
    const password = req.body.password;
    if (!password) {
      await connection.rollback();
      return res.status(400).json({ success: false, message: "Enter your password to change the salary account." });
    }

    const [urows] = await connection.query(
      "SELECT password_hash FROM users WHERE id = ? LIMIT 1",
      [req.user.id]
    );
    const matched = urows.length > 0 && (await bcrypt.compare(String(password), urows[0].password_hash));
    if (!matched) {
      await connection.rollback();
      return res.status(401).json({ success: false, message: "Password is incorrect." });
    }

    const same =
      active.method === acc.method &&
      (active.account_no || null) === (acc.account_no || null) &&
      (active.bank_name || null) === (acc.bank_name || null);
    if (same) {
      await connection.rollback();
      return res.status(400).json({ success: false, message: "This is already your salary account." });
    }

    // Any earlier pending request is replaced by the new one.
    await connection.query(
      "UPDATE staff_accounts SET status = 'Cancelled' WHERE user_id = ? AND status = 'Pending'",
      [req.user.id]
    );

    if (req.user.role === "Admin") {
      await connection.query(
        "UPDATE staff_accounts SET status = 'Old' WHERE user_id = ? AND status = 'Active'",
        [req.user.id]
      );
      await connection.query(
        `INSERT INTO staff_accounts
           (user_id, method, account_no, account_name, bank_name, branch, status, reviewed_by, reviewed_at)
         VALUES (?, ?, ?, ?, ?, ?, 'Active', ?, NOW())`,
        [req.user.id, acc.method, acc.account_no, acc.account_name, acc.bank_name, acc.branch, req.user.id]
      );
      await connection.commit();
      return res.json({ success: true, status: "Active", message: "Salary account updated." });
    }

    await connection.query(
      `INSERT INTO staff_accounts
         (user_id, method, account_no, account_name, bank_name, branch, status)
       VALUES (?, ?, ?, ?, ?, ?, 'Pending')`,
      [req.user.id, acc.method, acc.account_no, acc.account_name, acc.bank_name, acc.branch]
    );
    await connection.commit();
    return res.json({
      success: true,
      status: "Pending",
      message: "Change request sent. Admin must approve it. Until then salary goes to your current account.",
    });
  } catch (error) {
    if (connection) {
      try { await connection.rollback(); } catch (e) { /* ignore */ }
    }
    console.error("Save Payout Account Error:", error);
    return res.status(500).json({ success: false, message: error.message });
  } finally {
    if (connection) connection.release();
  }
};

// ========================================
// DELETE /api/payout/me/pending  -> staff cancels own request
// ========================================
exports.cancelMine = async (req, res) => {
  try {
    const [r] = await db.query(
      "UPDATE staff_accounts SET status = 'Cancelled' WHERE user_id = ? AND status = 'Pending'",
      [req.user.id]
    );
    if (r.affectedRows === 0) {
      return res.status(404).json({ success: false, message: "No pending request." });
    }
    return res.json({ success: true, message: "Request cancelled." });
  } catch (error) {
    console.error("Cancel Payout Request Error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ========================================
// GET /api/payout/pending   (Admin)
// ========================================
exports.listPending = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT p.*, u.name AS user_name, u.role, u.store_id, s.name AS store_name
       FROM staff_accounts p
       JOIN users u ON u.id = p.user_id
       LEFT JOIN stores s ON s.id = u.store_id
       WHERE p.status = 'Pending'
       ORDER BY p.id ASC`
    );

    const list = [];
    for (const r of rows) {
      // eslint-disable-next-line no-await-in-loop
      const { active } = await getActiveAndPending(r.user_id);
      list.push({
        id: r.id,
        user_id: r.user_id,
        user_name: r.user_name,
        role: r.role,
        store_id: r.store_id,
        store_name: r.store_name,
        requested: publicAccount(r),
        current: publicAccount(active),
      });
    }

    return res.json({ success: true, requests: list });
  } catch (error) {
    console.error("List Payout Requests Error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ========================================
// POST /api/payout/:id/approve   (Admin)
// POST /api/payout/:id/reject    (Admin)
// ========================================
exports.review = (decision) => async (req, res) => {
  let connection;
  try {
    connection = await db.getConnection();
    await connection.beginTransaction();

    const [rows] = await connection.query(
      "SELECT * FROM staff_accounts WHERE id = ? AND status = 'Pending' LIMIT 1",
      [req.params.id]
    );
    if (rows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: "Request not found or already reviewed." });
    }
    const reqRow = rows[0];

    if (decision === "approve") {
      await connection.query(
        "UPDATE staff_accounts SET status = 'Old' WHERE user_id = ? AND status = 'Active'",
        [reqRow.user_id]
      );
      await connection.query(
        "UPDATE staff_accounts SET status = 'Active', reviewed_by = ?, reviewed_at = NOW() WHERE id = ?",
        [req.user.id, reqRow.id]
      );
    } else {
      await connection.query(
        "UPDATE staff_accounts SET status = 'Rejected', reviewed_by = ?, reviewed_at = NOW() WHERE id = ?",
        [req.user.id, reqRow.id]
      );
    }

    await connection.commit();
    return res.json({
      success: true,
      message: decision === "approve" ? "Account change approved." : "Account change rejected.",
    });
  } catch (error) {
    if (connection) {
      try { await connection.rollback(); } catch (e) { /* ignore */ }
    }
    console.error("Review Payout Request Error:", error);
    return res.status(500).json({ success: false, message: error.message });
  } finally {
    if (connection) connection.release();
  }
};

// ========================================
// GET /api/payout/my-salary  -> own payslips (any staff)
// ========================================
exports.mySalary = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT id, year, month, base_salary, absent_days, late_days,
              absent_deduction, late_deduction, net_paid,
              payment_method, account_no, bank_name, txn_ref, is_demo, created_at
       FROM salary_payments
       WHERE user_id = ?
       ORDER BY year DESC, month DESC`,
      [req.user.id]
    );

    return res.json({
      success: true,
      payments: rows.map((r) => ({
        ...r,
        base_salary: Number(r.base_salary) || 0,
        absent_deduction: Number(r.absent_deduction) || 0,
        late_deduction: Number(r.late_deduction) || 0,
        net_paid: Number(r.net_paid) || 0,
        is_demo: Number(r.is_demo) === 1,
        paid_to: accountLabel({ method: r.payment_method, account_no: r.account_no, bank_name: r.bank_name }),
        account_no: undefined,
      })),
    });
  } catch (error) {
    console.error("My Salary Error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.getActiveAndPending = getActiveAndPending;
