// backend/controllers/inventoryController.js
const db = require("../config/db");

// ================================
// Get Inventory History (with product name + optional filters)
// ================================
exports.getInventoryHistory = async (req, res) => {
    try {
        const { store_id, product_id, type } = req.query;

        let sql = `
            SELECT
                ih.id,
                ih.store_id,
                ih.product_id,
                p.name AS product_name,
                p.barcode,
                ih.type,
                ih.qty,
                ih.created_at
            FROM inventory_history ih
            LEFT JOIN products p ON p.id = ih.product_id
            WHERE 1=1
        `;
        const params = [];

        if (store_id) {
            sql += " AND ih.store_id = ?";
            params.push(store_id);
        }
        if (product_id) {
            sql += " AND ih.product_id = ?";
            params.push(product_id);
        }
        if (type) {
            sql += " AND ih.type = ?";
            params.push(type);
        }

        sql += " ORDER BY ih.created_at DESC LIMIT 200";

        const [rows] = await db.query(sql, params);
        res.status(200).json(rows);
    } catch (error) {
        console.error("GET INVENTORY HISTORY ERROR:", error);
        res.status(500).json({ message: error.message });
    }
};