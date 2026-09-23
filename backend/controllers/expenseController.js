const db = require("../config/db");

const hasAllStoreAccess = (role) => role === "Admin" || role === "Viewer";

const resolveStore = (req, storeId) => {
  if (hasAllStoreAccess(req.user.role)) {
    return storeId ? Number(storeId) : null;
  }
  return req.user.store_id;
};

// GET /api/expenses?store_id=&year=&month=
exports.getExpenses = async (req, res) => {
  try {
    const scopedStore = resolveStore(req, req.query.store_id);
    const { year, month } = req.query;

    let sql = `
      SELECT e.id, e.store_id, s.name AS store_name, e.category, e.amount,
             e.note, e.expense_date, e.source, e.created_at
      FROM expenses e
      LEFT JOIN stores s ON s.id = e.store_id
      WHERE 1 = 1
    `;
    const params = [];

    if (scopedStore) { sql += " AND e.store_id = ?"; params.push(scopedStore); }
    if (year)  { sql += " AND YEAR(e.expense_date) = ?";  params.push(Number(year)); }
    if (month) { sql += " AND MONTH(e.expense_date) = ?"; params.push(Number(month)); }

    sql += " ORDER BY e.expense_date DESC, e.id DESC";

    const [rows] = await db.query(sql, params);
    const total = rows.reduce((sum, r) => sum + Number(r.amount || 0), 0);

    return res.json({
      success: true,
      total_expense: Math.round((total + Number.EPSILON) * 100) / 100,
      expenses: rows.map((r) => ({ ...r, amount: Number(r.amount) || 0 })),
    });
  } catch (error) {
    console.error("Get Expenses Error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/expenses   body: { category, amount, note?, expense_date?, store_id? }
exports.addExpense = async (req, res) => {
  try {
    const { category, amount, note, expense_date, store_id } = req.body;

    if (!category || amount == null || Number(amount) <= 0) {
      return res.status(400).json({
        success: false,
        message: "Category and a positive amount are required.",
      });
    }

    const scopedStore = resolveStore(req, store_id);
    if (!scopedStore) {
      return res.status(400).json({ success: false, message: "A valid store is required." });
    }

    const date = expense_date || new Date().toISOString().slice(0, 10);

    await db.query(
      `
      INSERT INTO expenses
        (store_id, category, amount, note, expense_date, source, created_by)
      VALUES (?, ?, ?, ?, ?, 'Manual', ?)
      `,
      [scopedStore, String(category).trim(), Number(amount),
       note ? String(note).trim() : null, date, req.user.id]
    );

    return res.json({ success: true, message: "Expense added." });
  } catch (error) {
    console.error("Add Expense Error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// DELETE /api/expenses/:id   (Salary-sourced rows are protected)
exports.deleteExpense = async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT id, store_id, source FROM expenses WHERE id = ? LIMIT 1",
      [req.params.id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: "Expense not found." });
    }

    const expense = rows[0];

    if (expense.source === "Salary") {
      return res.status(400).json({
        success: false,
        message: "Salary expenses are auto-generated and cannot be deleted here.",
      });
    }

    if (
      !hasAllStoreAccess(req.user.role) &&
      Number(expense.store_id) !== Number(req.user.store_id)
    ) {
      return res.status(403).json({ success: false, message: "Not your store's expense." });
    }

    await db.query("DELETE FROM expenses WHERE id = ?", [req.params.id]);
    return res.json({ success: true, message: "Expense deleted." });
  } catch (error) {
    console.error("Delete Expense Error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};