const db = require("../config/db");
const { calculateSalary } = require("../config/salaryRules");

const round2 = (v) => Math.round((Number(v) + Number.EPSILON) * 100) / 100;

const loadStaffForMonth = async (year, month, storeId) => {
  let sql = `
    SELECT
      u.id AS user_id, u.name, u.role, u.store_id, u.salary,
      IFNULL(SUM(a.status = 'Late'), 0)   AS late_days,
      IFNULL(SUM(a.status = 'Absent'), 0) AS absent_days
    FROM users u
    LEFT JOIN attendance a
      ON a.user_id = u.id AND YEAR(a.date) = ? AND MONTH(a.date) = ?
    WHERE (u.status IS NULL OR u.status = 'Active')
  `;
  const params = [year, month];

  if (storeId) { sql += " AND u.store_id = ?"; params.push(Number(storeId)); }
  sql += " GROUP BY u.id ORDER BY u.name ASC";

  const [rows] = await db.query(sql, params);
  return rows;
};

// PUT /api/salary/user/:id   body: { salary }
exports.setUserSalary = async (req, res) => {
  try {
    const { salary } = req.body;
    if (salary == null || Number(salary) < 0) {
      return res.status(400).json({ success: false, message: "A valid salary is required." });
    }

    const [result] = await db.query("UPDATE users SET salary = ? WHERE id = ?", [Number(salary), req.params.id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: "Staff member not found." });
    }

    return res.json({ success: true, message: "Salary updated." });
  } catch (error) {
    console.error("Set Salary Error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/salary/preview?year=&month=&store_id=
exports.getPreview = async (req, res) => {
  try {
    const now = new Date();
    const year = Number(req.query.year) || now.getFullYear();
    const month = Number(req.query.month) || now.getMonth() + 1;
    const storeId = req.query.store_id;

    const staff = await loadStaffForMonth(year, month, storeId);

    const [paidRows] = await db.query(
      "SELECT user_id FROM salary_payments WHERE year = ? AND month = ?",
      [year, month]
    );
    const paidSet = new Set(paidRows.map((r) => r.user_id));

    const list = staff.map((s) => {
      const calc = calculateSalary(s.salary, s.absent_days, s.late_days);
      return {
        user_id: s.user_id, name: s.name, role: s.role, store_id: s.store_id,
        ...calc, already_paid: paidSet.has(s.user_id),
      };
    });

    const totalPayable = list.filter((s) => !s.already_paid).reduce((sum, s) => sum + s.net_paid, 0);

    return res.json({
      success: true, year, month,
      total_unpaid_payable: round2(totalPayable),
      staff: list,
    });
  } catch (error) {
    console.error("Salary Preview Error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Internal: pay a set of staff for a month (transaction) + write Expense per payout
const payStaff = async (staffRows, year, month, paidBy) => {
  let connection;
  const paid = [];
  const skipped = [];

  try {
    connection = await db.getConnection();
    await connection.beginTransaction();

    for (const s of staffRows) {
      const [exists] = await connection.query(
        "SELECT id FROM salary_payments WHERE user_id = ? AND year = ? AND month = ? LIMIT 1",
        [s.user_id, year, month]
      );
      if (exists.length > 0) {
        skipped.push({ user_id: s.user_id, name: s.name, reason: "already paid" });
        continue;
      }

      const calc = calculateSalary(s.salary, s.absent_days, s.late_days);

      const [salResult] = await connection.query(
        `
        INSERT INTO salary_payments
          (user_id, store_id, year, month, base_salary,
           absent_days, late_days, absent_deduction, late_deduction, net_paid, paid_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [s.user_id, s.store_id, year, month, calc.base_salary,
         calc.absent_days, calc.late_days, calc.absent_deduction,
         calc.late_deduction, calc.net_paid, paidBy]
      );

      const expenseDate = `${year}-${String(month).padStart(2, "0")}-01`;
      await connection.query(
        `
        INSERT INTO expenses
          (store_id, category, amount, note, expense_date, source, ref_id, created_by)
        VALUES (?, 'Salary', ?, ?, ?, 'Salary', ?, ?)
        `,
        [s.store_id, calc.net_paid,
         `Salary of ${s.name} for ${month}/${year}`, expenseDate, salResult.insertId, paidBy]
      );

      paid.push({ user_id: s.user_id, name: s.name, net_paid: calc.net_paid });
    }

    await connection.commit();
    return { paid, skipped };
  } catch (error) {
    if (connection) { try { await connection.rollback(); } catch (e) { console.error(e); } }
    throw error;
  } finally {
    if (connection) connection.release();
  }
};

// POST /api/salary/pay-all   body: { year?, month?, store_id? }
exports.payAll = async (req, res) => {
  try {
    const now = new Date();
    const year = Number(req.body.year) || now.getFullYear();
    const month = Number(req.body.month) || now.getMonth() + 1;
    const storeId = req.body.store_id;

    const staff = await loadStaffForMonth(year, month, storeId);
    if (staff.length === 0) {
      return res.status(400).json({ success: false, message: "No staff found to pay." });
    }

    const { paid, skipped } = await payStaff(staff, year, month, req.user.id);
    const totalPaid = paid.reduce((sum, p) => sum + p.net_paid, 0);

    return res.json({
      success: true,
      message: `Paid ${paid.length} staff. Skipped ${skipped.length}.`,
      year, month, total_paid: round2(totalPaid), paid, skipped,
    });
  } catch (error) {
    console.error("Pay All Salary Error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/salary/pay/:userId   body: { year?, month? }
exports.payOne = async (req, res) => {
  try {
    const now = new Date();
    const year = Number(req.body.year) || now.getFullYear();
    const month = Number(req.body.month) || now.getMonth() + 1;
    const userId = Number(req.params.userId);

    const staff = await loadStaffForMonth(year, month, null);
    const target = staff.find((s) => Number(s.user_id) === userId);
    if (!target) {
      return res.status(404).json({ success: false, message: "Staff member not found." });
    }

    const { paid, skipped } = await payStaff([target], year, month, req.user.id);
    if (paid.length === 0) {
      return res.status(400).json({
        success: false,
        message: skipped[0]?.reason ? `Not paid: ${skipped[0].reason}.` : "Nothing was paid.",
      });
    }

    return res.json({ success: true, message: "Salary paid.", payment: paid[0] });
  } catch (error) {
    console.error("Pay One Salary Error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/salary/history?year=&month=&store_id=
exports.getHistory = async (req, res) => {
  try {
    const { year, month, store_id } = req.query;

    let sql = `
      SELECT sp.id, sp.user_id, u.name, u.role, sp.store_id, sp.year, sp.month,
             sp.base_salary, sp.absent_days, sp.late_days,
             sp.absent_deduction, sp.late_deduction, sp.net_paid, sp.created_at
      FROM salary_payments sp
      LEFT JOIN users u ON u.id = sp.user_id
      WHERE 1 = 1
    `;
    const params = [];

    if (year)  { sql += " AND sp.year = ?";  params.push(Number(year)); }
    if (month) { sql += " AND sp.month = ?"; params.push(Number(month)); }
    if (store_id) { sql += " AND sp.store_id = ?"; params.push(Number(store_id)); }
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
      })),
    });
  } catch (error) {
    console.error("Salary History Error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};