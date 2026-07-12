const db = require("../config/db");

// ===============================
// Get Damaged Items
// ===============================
const getDamagedItems = async (req, res) => {
  try {
    let sql = `
      SELECT
        d.id,
        d.product_id,
        p.name AS product_name,
        d.qty AS quantity,
        d.reason,
        d.store_id,
        d.created_at
      FROM damaged_items d
      JOIN products p ON d.product_id = p.id
    `;

    const params = [];

    if (req.user.role !== "Admin") {
      sql += " WHERE d.store_id = ?";
      params.push(req.user.store_id);
    } else if (req.query.store_id) {
      sql += " WHERE d.store_id = ?";
      params.push(req.query.store_id);
    }

    sql += " ORDER BY d.id DESC";

    const [rows] = await db.query(sql, params);

    res.json(rows);
  } catch (err) {
    console.error("Get Damaged Error:", err);
    res.status(500).json({
      message: err.message,
    });
  }
};

// ===============================
// Add Damaged Item
// ===============================
const addDamagedItem = async (req, res) => {
  try {
    const { product_id, quantity, reason, store_id } = req.body;

    if (!product_id || !quantity) {
      return res.status(400).json({
        message: "Product and quantity are required",
      });
    }

    const finalStore =
      req.user.role === "Admin"
        ? Number(store_id)
        : req.user.store_id;

    // Product Check
    const [products] = await db.query(
      "SELECT id, stock FROM products WHERE id = ?",
      [product_id]
    );

    if (products.length === 0) {
      return res.status(404).json({
        message: "Product not found",
      });
    }

    const product = products[0];

    if (Number(product.stock) < Number(quantity)) {
      return res.status(400).json({
        message: "Not enough stock",
      });
    }

    // Reduce Product Stock
    await db.query(
      "UPDATE products SET stock = stock - ? WHERE id = ?",
      [quantity, product_id]
    );

    // Insert Damaged Record
    await db.query(
      `
      INSERT INTO damaged_items
      (store_id, product_id, qty, reason, created_by)
      VALUES (?, ?, ?, ?, ?)
      `,
      [
        finalStore,
        product_id,
        quantity,
        reason || "Damaged",
        req.user.id,
      ]
    );

    res.json({
      message: "Damaged item added successfully",
    });
  } catch (err) {
    console.error("Add Damaged Error:", err);
    res.status(500).json({
      message: err.message,
    });
  }
};

// ===============================
// Delete Damaged Item
// ===============================
const deleteDamagedItem = async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT * FROM damaged_items WHERE id = ?",
      [req.params.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        message: "Damaged record not found",
      });
    }

    const item = rows[0];

    // Admin সব delete করতে পারবে
    // Manager / Store Keeper শুধু নিজের store-এর
    if (
      req.user.role !== "Admin" &&
      item.store_id !== req.user.store_id
    ) {
      return res.status(403).json({
        message: "Access denied",
      });
    }

    // Restore Product Stock
    await db.query(
      "UPDATE products SET stock = stock + ? WHERE id = ?",
      [item.qty, item.product_id]
    );

    // Delete Record
    await db.query(
      "DELETE FROM damaged_items WHERE id = ?",
      [req.params.id]
    );

    res.json({
      message: "Damaged record deleted successfully",
    });
  } catch (err) {
    console.error("Delete Damaged Error:", err);
    res.status(500).json({
      message: err.message,
    });
  }
};

module.exports = {
  getDamagedItems,
  addDamagedItem,
  deleteDamagedItem,
};