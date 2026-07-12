const db = require("../config/db");
const bcrypt = require("bcryptjs");

exports.resetDemoData = async (req, res) => {
  let connection;

  try {
    const { password, store_id } = req.body;

    if (!password) {
      return res.status(400).json({
        message: "Password is required",
      });
    }

    const [rows] = await db.query(
      "SELECT id, password_hash, role FROM users WHERE id = ?",
      [req.user.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    const user = rows[0];

    if ((user.role || "").toLowerCase() !== "admin") {
      return res.status(403).json({
        message: "Only Admin can reset demo data",
      });
    }

    const match = await bcrypt.compare(password, user.password_hash);

    if (!match) {
      return res.status(401).json({
        message: "Incorrect password",
      });
    }

    // store_id present & not "all" => scoped reset for one store only.
    // store_id missing / null / "all" => full reset across every store.
    const isScoped =
      store_id !== undefined &&
      store_id !== null &&
      String(store_id).toLowerCase() !== "all" &&
      String(store_id).trim() !== "";

    if (isScoped) {
      const [storeRows] = await db.query(
        "SELECT id, name FROM stores WHERE id = ?",
        [store_id]
      );

      if (storeRows.length === 0) {
        return res.status(404).json({
          message: "Store not found",
        });
      }
    }

    connection = await db.getConnection();

    await connection.beginTransaction();

    await connection.query("SET FOREIGN_KEY_CHECKS = 0");

    if (isScoped) {
      // Scoped reset: only the selected store's data.
      await connection.query(
        `
        DELETE si FROM sale_items si
        INNER JOIN sales s ON s.id = si.sale_id
        WHERE s.store_id = ?
        `,
        [store_id]
      );

      await connection.query("DELETE FROM sales WHERE store_id = ?", [store_id]);
      await connection.query("DELETE FROM damaged_items WHERE store_id = ?", [store_id]);
      await connection.query("DELETE FROM inventory_history WHERE store_id = ?", [store_id]);
      await connection.query("DELETE FROM products WHERE store_id = ?", [store_id]);
    } else {
      // Full reset: every store.
      await connection.query("DELETE FROM sale_items");
      await connection.query("DELETE FROM sales");
      await connection.query("DELETE FROM damaged_items");
      await connection.query("DELETE FROM inventory_history");
      await connection.query("DELETE FROM products");
    }

    await connection.query("SET FOREIGN_KEY_CHECKS = 1");

    await connection.commit();

    return res.status(200).json({
      success: true,
      message: isScoped
        ? `Store #${store_id} demo data reset successfully.`
        : "All stores' demo data reset successfully.",
    });
  } catch (err) {
    console.error("Reset Error:", err);

    if (connection) {
      await connection.rollback();
      await connection.query("SET FOREIGN_KEY_CHECKS = 1");
    }

    return res.status(500).json({
      success: false,
      message: err.message || "Internal Server Error",
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
};