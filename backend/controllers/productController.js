const db = require("../config/db");

exports.getProducts = async (req, res) => {
  try {
    let { store_id } = req.query;

    // Admin ছাড়া বাকি সবাই শুধু নিজের store-এর product দেখতে পারবে —
    // query param দিয়ে অন্য store_id পাঠানোর চেষ্টা করলেও সেটা ignore হবে।
    if (req.user.role !== "Admin") {
      store_id = req.user.store_id;
    }

    let sql = "SELECT * FROM products";
    const params = [];

    if (store_id) {
      sql += " WHERE store_id = ?";
      params.push(store_id);
    }

    sql += " ORDER BY id DESC";

    const [rows] = await db.query(sql, params);
    return res.status(200).json(rows);
  } catch (error) {
    console.error("GET PRODUCTS ERROR:", error);
    return res.status(500).json({ message: error.message });
  }
};

exports.addProduct = async (req, res) => {
  const {
    name,
    barcode,
    category,
    cost_price,
    selling_price,
    discount_percent,
    stock,
    status,
  } = req.body;

  // Admin যেকোনো store-এর জন্য add করতে পারবে (body থেকে store_id নেয়),
  // বাকি সবাই সবসময় শুধু নিজের store-এর জন্যই add করবে — body-তে অন্য
  // store_id পাঠানোর চেষ্টা করলেও সেটা কার্যকর হবে না।
  const store_id =
    req.user.role === "Admin" ? req.body.store_id : req.user.store_id;

  if (!store_id) {
    return res.status(400).json({ message: "Store ID is required" });
  }

  if (!name || selling_price == null) {
    return res.status(400).json({
      message: "Name and Selling Price are required",
    });
  }

  try {
    console.log("Incoming Data:", {
      store_id,
      barcode,
      stock,
      name,
    });

    const [result] = await db.query(
      `INSERT INTO products
      (store_id, name, barcode, category, cost_price, selling_price, discount_percent, stock, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        name = ?,
        category = ?,
        cost_price = ?,
        selling_price = ?,
        discount_percent = ?,
        stock = stock + ?,
        status = ?`,
      [
        store_id,
        name,
        barcode,
        category,
        Number(cost_price) || 0,
        Number(selling_price) || 0,
        Number(discount_percent) || 0,
        Number(stock) || 0,
        status || "Active",

        // UPDATE values
        name,
        category,
        Number(cost_price) || 0,
        Number(selling_price) || 0,
        Number(discount_percent) || 0,
        Number(stock) || 0,
        status || "Active",
      ]
    );

    console.log("MySQL Result:", result);

    const [rows] = await db.query(
      "SELECT * FROM products WHERE store_id = ? AND barcode = ?",
      [store_id, barcode]
    );

    console.log("Product After Save:", rows[0]);

    return res.status(200).json({
      success: true,
      message:
        result.affectedRows === 2
          ? "Same barcode found in this store. Product updated."
          : "Product added successfully.",
      product: rows[0],
    });
  } catch (error) {
    console.error("ADD PRODUCT ERROR:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.updateProduct = async (req, res) => {
  const { id } = req.params;
  const {
    name,
    barcode,
    category,
    cost_price,
    selling_price,
    discount_percent,
    stock,
    status,
  } = req.body;

  try {
    const [existingRows] = await db.query(
      "SELECT store_id FROM products WHERE id = ?",
      [id]
    );

    if (existingRows.length === 0) {
      return res.status(404).json({ message: "Product not found" });
    }

    // Admin ছাড়া বাকি সবাই শুধু নিজের store-এর product-ই edit করতে পারবে
    if (
      req.user.role !== "Admin" &&
      Number(existingRows[0].store_id) !== Number(req.user.store_id)
    ) {
      return res.status(403).json({
        message: "Ei product apnar store-er noy, edit korte parben na",
      });
    }

    const [result] = await db.query(
      `UPDATE products
       SET
         name = ?,
         barcode = ?,
         category = ?,
         cost_price = ?,
         selling_price = ?,
         discount_percent = ?,
         stock = ?,
         status = ?
       WHERE id = ?`,
      [
        name,
        barcode,
        category,
        cost_price,
        selling_price,
        Number(discount_percent) || 0,
        stock,
        status,
        id,
      ]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Product not found" });
    }

    return res.json({
      message: "✅ Product Updated Successfully",
      affectedRows: result.affectedRows,
    });
  } catch (error) {
    console.error("UPDATE PRODUCT ERROR:", error);
    return res.status(500).json({ message: error.message });
  }
};

exports.updatePrice = async (req, res) => {
  const { id } = req.params;
  const { selling_price } = req.body;

  try {
    if (selling_price === undefined || selling_price === null || selling_price === "") {
      return res.status(400).json({ message: "Selling price is required" });
    }

    // শুধু Admin আর Manager প্রাইস পরিবর্তন করতে পারবে, Store Keeper না
    if (!["Admin", "Manager"].includes(req.user.role)) {
      return res.status(403).json({
        message: "Apnar price change korar permission nai",
      });
    }

    const [existingRows] = await db.query(
      "SELECT store_id FROM products WHERE id = ?",
      [id]
    );

    if (existingRows.length === 0) {
      return res.status(404).json({ message: "Product not found" });
    }

    if (
      req.user.role !== "Admin" &&
      Number(existingRows[0].store_id) !== Number(req.user.store_id)
    ) {
      return res.status(403).json({
        message: "Ei product apnar store-er noy, price change korte parben na",
      });
    }

    const [result] = await db.query(
      "UPDATE products SET selling_price = ? WHERE id = ?",
      [selling_price, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Product not found" });
    }

    return res.json({
      message: "✅ Product Price Updated Successfully",
      affectedRows: result.affectedRows,
    });
  } catch (error) {
    console.error("UPDATE PRICE ERROR:", error);
    return res.status(500).json({ message: error.message });
  }
};

exports.updateStock = async (req, res) => {
  const { id } = req.params;
  const { stock } = req.body;

  try {
    const [rows] = await db.query(
      "SELECT store_id, stock FROM products WHERE id = ?",
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: "Product not found" });
    }

    const product = rows[0];

    if (
      req.user.role !== "Admin" &&
      Number(product.store_id) !== Number(req.user.store_id)
    ) {
      return res.status(403).json({
        message: "Ei product apnar store-er noy, stock update korte parben na",
      });
    }

    const oldStock = Number(product.stock);
    const newStock = Number(stock);

    await db.query("UPDATE products SET stock = ? WHERE id = ?", [newStock, id]);

    if (oldStock !== newStock) {
      const type = newStock > oldStock ? "IN" : "OUT";
      const qty = Math.abs(newStock - oldStock);

      await db.query(
        `INSERT INTO inventory_history
         (store_id, product_id, type, qty)
         VALUES (?, ?, ?, ?)`,
        [product.store_id, id, type, qty]
      );
    }

    return res.json({ message: "✅ Stock Updated Successfully" });
  } catch (error) {
    console.error("UPDATE STOCK ERROR:", error);
    return res.status(500).json({ message: error.message });
  }
};

exports.deleteProduct = async (req, res) => {
  const { id } = req.params;

  try {
    const [existingRows] = await db.query(
      "SELECT store_id FROM products WHERE id = ?",
      [id]
    );

    if (existingRows.length === 0) {
      return res.status(404).json({ message: "Product not found" });
    }

    if (
      req.user.role !== "Admin" &&
      Number(existingRows[0].store_id) !== Number(req.user.store_id)
    ) {
      return res.status(403).json({
        message: "Ei product apnar store-er noy, delete korte parben na",
      });
    }

    const [result] = await db.query("DELETE FROM products WHERE id = ?", [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Product not found" });
    }

    return res.json({ message: "✅ Product Deleted Successfully" });
  } catch (error) {
    console.error("DELETE PRODUCT ERROR:", error);
    return res.status(500).json({ message: error.message });
  }
};