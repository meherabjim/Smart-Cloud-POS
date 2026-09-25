const db = require("../config/db");
const { calculateSalary } = require("../config/salaryRules");
const { accountLabel, makeTxnRef } = require("../config/payout");

// Salary is Admin-only (enforced in the route). Admin sees all stores.
// An optional ?store_id= narrows the view to one store.

const round2 = (v) => Math.round((Number(v) + Number.EPSILON) * 100) / 100;

// Pull each active staff member's monthly attendance counts + salary.
const loadStaffForMonth = async (year, month, storeId) => {
  let sql = `
    SELECT
      u.id AS user_id,
      u.name,
      u.role,
      u.store_id,
      u.salary,
      st.name AS store_name,
      sa.method     AS pay_method,
      sa.account_no AS pay_account_no,
      sa.bank_name  AS pay_bank_name,
      (SELECT COUNT(*) FROM staff_accounts sp2
        WHERE sp2.user_id = u.id AND sp2.status = 'Pending') AS pending_change,
      IFNULL(SUM(a.status = 'Late'), 0)   AS late_days,
      IFNULL(SUM(a.status = 'Absent'), 0) AS absent_days
    FROM users u
    LEFT JOIN stores st ON st.id = u.store_id
    LEFT JOIN staff_accounts sa
      ON sa.user_id = u.id AND sa.status = 'Active'
    LEFT JOIN attendance a
      ON a.user_id = u.id
      AND YEAR(a.date) = ?
      AND MONTH(a.date) = ?
    WHERE (u.status IS NULL OR u.status = 'Active')
  `;
  const params = [year, month];

  if (storeId) {
    sql += " AND u.store_id = ?";
    params.push(Number(storeId));
  }

  sql += `
    GROUP BY u.id, u.name, u.role, u.store_id, u.salary, st.name,
             sa.method, sa.account_no, sa.bank_name
    ORDER BY u.name ASC`;

  const [rows] = await db.query(sql, params);
  return rows;
};

// Where this staff member's salary goes (from their Active account).
// No account set yet -> Cash.
const payoutOf = (s) => {
  const method = s.pay_method || "Cash";
  return {
    method,
    account_no: method === "Cash" ? null : s.pay_account_no,
    bank_name: method === "Bank" ? s.pay_bank_name : null,
    has_account: Boolean(s.pay_method),
  };
};

// ========================================
// PUT /api/salary/user/:id
// body: { salary }
// Set a staff member's monthly salary.
// ========================================
exports.setUserSalary = async (req, res) => {
  try {
    const { salary } = req.body;

    if (salary == null || Number(salary) < 0) {
      return res
        .status(400)
        .json({ success: false, message: "A valid salary is required." });
    }

    const [result] = await db.query(
      "UPDATE users SET salary = ? WHERE id = ?",
      [Number(salary), req.params.id]
    );

    if (result.affectedRows === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Staff member not found." });
    }

    return res.json({ success: true, message: "Salary updated." });
  } catch (error) {
    console.error("Set Salary Error:", error);
    return res
      .status(500)
      .json({ success: false, message: error.message });
  }
};

// ========================================
// GET /api/salary/preview?year=&month=&store_id=
// Shows the calculated salary for each staff member for the month,
// and whether it has already been paid.
// ========================================
exports.getPreview = async (req, res) => {
  try {
    const now = new Date();
    const year = Number(req.query.year) || now.getFullYear();
    const month = Number(req.query.month) || now.getMonth() + 1;
    const storeId = req.query.store_id;

    const staff = await loadStaffForMonth(year, month, storeId);

    // Which staff are already paid for this month?
    const [paidRows] = await db.query(
      "SELECT user_id FROM salary_payments WHERE year = ? AND month = ?",
      [year, month]
    );
    const paidSet = new Set(paidRows.map((r) => r.user_id));

    const list = staff.map((s) => {
      const calc = calculateSalary(s.salary, s.absent_days, s.late_days);
      return {
        user_id: s.user_id,
        name: s.name,
        role: s.role,
        store_id: s.store_id,
        store_name: s.store_name,
        ...calc,
        already_paid: paidSet.has(s.user_id),
        payout: (() => {
          const p = payoutOf(s);
          return {
            method: p.method,
            label: p.has_account ? accountLabel(p) : "Cash (no account set)",
            has_account: p.has_account,
            is_demo: p.method !== "Cash",
            pending_change: Number(s.pending_change) > 0,
          };
        })(),
      };
    });

    const totalPayable = list
      .filter((s) => !s.already_paid)
      .reduce((sum, s) => sum + s.net_paid, 0);

    return res.json({
      success: true,
      year,
      month,
      total_unpaid_payable: round2(totalPayable),
      staff: list,
    });
  } catch (error) {
    console.error("Salary Preview Error:", error);
    return res
      .status(500)
      .json({ success: false, message: error.message });
  }
};

// ========================================
// Internal: pay a set of staff rows for a month inside one transaction.
// Skips anyone already paid. Also writes an Expense row per payment.
// ========================================
const payStaff = async (staffRows, year, month, paidBy) => {
  let connection;
  const paid = [];
  const skipped = [];

  try {
    connection = await db.getConnection();
    await connection.beginTransaction();

    for (const s of staffRows) {
      // Skip if already paid (unique key also protects this).
      const [exists] = await connection.query(
        "SELECT id FROM salary_payments WHERE user_id = ? AND year = ? AND month = ? LIMIT 1",
        [s.user_id, year, month]
      );
      if (exists.length > 0) {
        skipped.push({ user_id: s.user_id, name: s.name, reason: "already paid" });
        continue;
      }

      const calc = calculateSalary(s.salary, s.absent_days, s.late_days);
      const payout = payoutOf(s);
      const isDemo = payout.method !== "Cash" ? 1 : 0;

      const [salResult] = await connection.query(
        `
        INSERT INTO salary_payments
          (user_id, store_id, year, month, base_salary,
           absent_days, late_days, absent_deduction, late_deduction,
           net_paid, paid_by, payment_method, account_no, bank_name, is_demo)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          s.user_id,
          s.store_id,
          year,
          month,
          calc.base_salary,
          calc.absent_days,
          calc.late_days,
          calc.absent_deduction,
          calc.late_deduction,
          calc.net_paid,
          paidBy,
          payout.method,
          payout.account_no,
          payout.bank_name,
          isDemo,
        ]
      );

      // Reference number (DEMO-... for Bank/bKash/Nagad/Rocket, CASH-... for cash)
      const txnRef = makeTxnRef(payout.method, salResult.insertId);
      await connection.query(
        "UPDATE salary_payments SET txn_ref = ? WHERE id = ?",
        [txnRef, salResult.insertId]
      );

      const paidTo = accountLabel(payout);

      // Mirror the payout as an expense so profit reports stay correct.
      const expenseDate = `${year}-${String(month).padStart(2, "0")}-01`;
      await connection.query(
        `
        INSERT INTO expenses
          (store_id, category, amount, note, expense_date, source, ref_id, created_by)
        VALUES (?, 'Salary', ?, ?, ?, 'Salary', ?, ?)
        `,
        [
          s.store_id,
          calc.net_paid,
          `Salary of ${s.name} for ${month}/${year} via ${paidTo}${isDemo ? " (demo transfer)" : ""}`,
          expenseDate,
          salResult.insertId,
          paidBy,
        ]
      );

      paid.push({
        user_id: s.user_id,
        name: s.name,
        net_paid: calc.net_paid,
        paid_to: paidTo,
        txn_ref: txnRef,
        is_demo: isDemo === 1,
      });
    }

    await connection.commit();
    return { paid, skipped };
  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch (e) {
        console.error("Salary rollback error:", e);
      }
    }
    throw error;
  } finally {
    if (connection) connection.release();
  }
};

// ========================================
// POST /api/salary/pay-all
// body: { year?, month?, store_id? }
// One-click: pay every unpaid active staff member for the month.
// ========================================
exports.payAll = async (req, res) => {
  try {
    const now = new Date();
    const year = Number(req.body.year) || now.getFullYear();
    const month = Number(req.body.month) || now.getMonth() + 1;
    const storeId = req.body.store_id;

    const staff = await loadStaffForMonth(year, month, storeId);

    if (staff.length === 0) {
      return res
        .status(400)
        .json({ success: false, message: "No staff found to pay." });
    }

    const { paid, skipped } = await payStaff(staff, year, month, req.user.id);

    const totalPaid = paid.reduce((sum, p) => sum + p.net_paid, 0);

    return res.json({
      success: true,
      message: `Paid ${paid.length} staff. Skipped ${skipped.length}.`,
      year,
      month,
      total_paid: round2(totalPaid),
      paid,
      skipped,
    });
  } catch (error) {
    console.error("Pay All Salary Error:", error);
    return res
      .status(500)
      .json({ success: false, message: error.message });
  }
};

// ========================================
// POST /api/salary/pay/:userId
// body: { year?, month? }  -> pay a single staff member.
// ========================================
exports.payOne = async (req, res) => {
  try {
    const now = new Date();
    const year = Number(req.body.year) || now.getFullYear();
    const month = Number(req.body.month) || now.getMonth() + 1;
    const userId = Number(req.params.userId);

    const staff = await loadStaffForMonth(year, month, null);
    const target = staff.find((s) => Number(s.user_id) === userId);

    if (!target) {
      return res
        .status(404)
        .json({ success: false, message: "Staff member not found." });
    }

    const { paid, skipped } = await payStaff([target], year, month, req.user.id);

    if (paid.length === 0) {
      return res.status(400).json({
        success: false,
        message: skipped[0]?.reason
          ? `Not paid: ${skipped[0].reason}.`
          : "Nothing was paid.",
      });
    }

    return res.json({
      success: true,
      message: paid[0].is_demo
        ? `Salary recorded: ৳${paid[0].net_paid} to ${paid[0].paid_to} (DEMO — no real transfer).`
        : `Salary paid in cash: ৳${paid[0].net_paid}.`,
      payment: paid[0],
    });
  } catch (error) {
    console.error("Pay One Salary Error:", error);
    return res
      .status(500)
      .json({ success: false, message: error.message });
  }
};

// ========================================
// GET /api/salary/history?year=&month=&store_id=
// ========================================
exports.getHistory = async (req, res) => {
  try {
    const { year, month, store_id } = req.query;

    let sql = `
      SELECT
        sp.id,
        sp.user_id,
        u.name,
        u.role,
        sp.store_id,
        sp.year,
        sp.month,
        sp.base_salary,
        sp.absent_days,
        sp.late_days,
        sp.absent_deduction,
        sp.late_deduction,
        sp.net_paid,
        sp.payment_method,
        sp.account_no,
        sp.bank_name,
        sp.txn_ref,
        sp.is_demo,
        st.name AS store_name,
        sp.created_at
      FROM salary_payments sp
      LEFT JOIN users u ON u.id = sp.user_id
      LEFT JOIN stores st ON st.id = sp.store_id
      WHERE 1 = 1
    `;
    const params = [];

    if (year) {
      sql += " AND sp.year = ?";
      params.push(Number(year));
    }
    if (month) {
      sql += " AND sp.month = ?";
      params.push(Number(month));
    }
    if (store_id) {
      sql += " AND sp.store_id = ?";
      params.push(Number(store_id));
    }

    sql += " ORDER BY sp.id DESC";

    const [rows] = await db.query(sql, params);

    return res.json({
      success: true,
      payments: rows.map((r) => ({
        ...r,
        base_salary: Number(r.base_salary) || 0,
        absent_deduction: Number(r.absent_deduction) || 0,
        late_deduction: Number(r.late_deduction) || 0,
        net_paid: Number(r.net_paid) || 0,
        is_demo: Number(r.is_demo) === 1,
        paid_to: accountLabel({
          method: r.payment_method,
          account_no: r.account_no,
          bank_name: r.bank_name,
        }),
        account_no: undefined,
      })),
    });
  } catch (error) {
    console.error("Salary History Error:", error);
    return res
      .status(500)
      .json({ success: false, message: error.message });
  }
};
