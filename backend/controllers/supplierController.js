const db = require("../config/db");

const hasAllStoreAccess = (role) => role === "Admin" || role === "Viewer";

const resolveStore = (req, storeId) => {
  if (hasAllStoreAccess(req.user.role)) {
    return storeId ? Number(storeId) : null;
  }
  return req.user.store_id;
};

const round2 = (v) => Math.round((Number(v) + Number.EPSILON) * 100) / 100;

// GET /api/suppliers?store_id=
exports.getSuppliers = async (req, res) => {
  try {
    const scopedStore = resolveStore(req, req.query.store_id);

    let sql = `
      SELECT sp.id, sp.store_id, s.name AS store_name, sp.name, sp.phone,
             sp.address, sp.due_balance, sp.created_at
      FROM suppliers sp
      LEFT JOIN stores s ON s.id = sp.store_id
      WHERE 1 = 1
    `;
    const params = [];

    if (scopedStore) { sql += " AND sp.store_id = ?"; params.push(scopedStore); }
    sql += " ORDER BY sp.name ASC";

    const [rows] = await db.query(sql, params);
    const totalDue = rows.reduce((sum, r) => sum + Number(r.due_balance || 0), 0);

    return res.json({
      success: true,
      total_due: round2(totalDue),
      suppliers: rows.map((r) => ({ ...r, due_balance: Number(r.due_balance) || 0 })),
    });
  } catch (error) {
    console.error("Get Suppliers Error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/suppliers   body: { name, phone?, address?, store_id? }
exports.addSupplier = async (req, res) => {
  try {
    const { name, phone, address, store_id } = req.body;

    if (!name) {
      return res.status(400).json({ success: false, message: "Supplier name is required." });
    }

    const scopedStore = resolveStore(req, store_id);
    if (!scopedStore) {
      return res.status(400).json({ success: false, message: "A valid store is required." });
    }

    const [result] = await db.query(
      `
      INSERT INTO suppliers (store_id, name, phone, address, due_balance, created_by)
      VALUES (?, ?, ?, ?, 0, ?)
      `,
      [scopedStore, String(name).trim(),
       phone ? String(phone).trim() : null,
       address ? String(address).trim() : null, req.user.id]
    );

    return res.json({ success: true, message: "Supplier added.", supplier_id: result.insertId });
  } catch (error) {
    console.error("Add Supplier Error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Shared helper for DUE / PAYMENT (uses a transaction + row lock)
const applyLedger = async (req, res, type) => {
  const supplierId = Number(req.params.id);
  const { amount, note } = req.body;

  if (!amount || Number(amount) <= 0) {
    return res.status(400).json({ success: false, message: "A positive amount is required." });
  }

  let connection;
  try {
    connection = await db.getConnection();
    await connection.beginTransaction();

    const [rows] = await connection.query(
      "SELECT id, store_id, due_balance FROM suppliers WHERE id = ? LIMIT 1 FOR UPDATE",
      [supplierId]
    );

    if (rows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: "Supplier not found." });
    }

    const supplier = rows[0];

    if (
      !hasAllStoreAccess(req.user.role) &&
      Number(supplier.store_id) !== Number(req.user.store_id)
    ) {
      await connection.rollback();
      return res.status(403).json({ success: false, message: "Not your store's supplier." });
    }

    const current = Number(supplier.due_balance) || 0;
    const value = round2(amount);

    let newBalance;
    if (type === "DUE") {
      newBalance = round2(current + value);
    } else {
      if (value > current) {
        await connection.rollback();
        return res.status(400).json({
          success: false,
          message: `Payment (${value}) is more than the current due (${current}).`,
        });
      }
      newBalance = round2(current - value);
    }

    await connection.query("UPDATE suppliers SET due_balance = ? WHERE id = ?", [newBalance, supplierId]);

    await connection.query(
      `
      INSERT INTO supplier_transactions
        (supplier_id, store_id, type, amount, balance_after, note, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
      [supplierId, supplier.store_id, type, value, newBalance,
       note ? String(note).trim() : null, req.user.id]
    );

    await connection.commit();

    return res.json({
      success: true,
      message: type === "DUE" ? "Due (credit purchase) recorded." : "Payment recorded.",
      due_balance: newBalance,
    });
  } catch (error) {
    if (connection) { try { await connection.rollback(); } catch (e) { console.error(e); } }
    console.error("Supplier Ledger Error:", error);
    return res.status(500).json({ success: false, message: error.message });
  } finally {
    if (connection) connection.release();
  }
};

exports.addDue = (req, res) => applyLedger(req, res, "DUE");
exports.addPayment = (req, res) => applyLedger(req, res, "PAYMENT");

// GET /api/suppliers/:id/transactions
exports.getTransactions = async (req, res) => {
  try {
    const supplierId = Number(req.params.id);

    const [supRows] = await db.query(
      "SELECT id, store_id, name, due_balance FROM suppliers WHERE id = ? LIMIT 1",
      [supplierId]
    );
    if (supRows.length === 0) {
      return res.status(404).json({ success: false, message: "Supplier not found." });
    }

    if (
      !hasAllStoreAccess(req.user.role) &&
      Number(supRows[0].store_id) !== Number(req.user.store_id)
    ) {
      return res.status(403).json({ success: false, message: "Not your store's supplier." });
    }

    const [rows] = await db.query(
      `
      SELECT id, type, amount, balance_after, note, created_at
      FROM supplier_transactions
      WHERE supplier_id = ?
      ORDER BY id DESC
      `,
      [supplierId]
    );

    return res.json({
      success: true,
      supplier: { ...supRows[0], due_balance: Number(supRows[0].due_balance) || 0 },
      transactions: rows.map((r) => ({
        ...r,
        amount: Number(r.amount) || 0,
        balance_after: Number(r.balance_after) || 0,
      })),
    });
  } catch (error) {
    console.error("Get Supplier Transactions Error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// DELETE /api/suppliers/:id  (Admin only)
exports.deleteSupplier = async (req, res) => {
  try {
    const supplierId = Number(req.params.id);

    const [rows] = await db.query(
      "SELECT id, due_balance FROM suppliers WHERE id = ? LIMIT 1",
      [supplierId]
    );
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: "Supplier not found." });
    }

    if (Number(rows[0].due_balance) !== 0) {
      return res.status(400).json({
        success: false,
        message: "Clear the due balance before deleting this supplier.",
      });
    }

    await db.query("DELETE FROM supplier_transactions WHERE supplier_id = ?", [supplierId]);
    await db.query("DELETE FROM suppliers WHERE id = ?", [supplierId]);

    return res.json({ success: true, message: "Supplier deleted." });
  } catch (error) {
    console.error("Delete Supplier Error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};