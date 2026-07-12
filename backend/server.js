const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
require("dotenv").config();

const db = require("./config/db");

const productRoutes = require("./routes/productRoutes");
const salesRoutes = require("./routes/salesRoutes");
const inventoryRoutes = require("./routes/inventoryRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");
const damagedRoutes = require("./routes/damagedRoutes");
const settingsRoutes = require("./routes/settingsRoutes");
const app = express();

// ===============================
// Middleware
// ===============================
app.use(cors());
app.use(express.json());

// Debug Middleware
app.use((req, res, next) => {
  const safeBody = { ...req.body };
  ["password", "old_password", "new_password"].forEach((field) => {
    if (safeBody[field] !== undefined) {
      safeBody[field] = "***hidden***";
    }
  });

  console.log("================================");
  console.log("METHOD :", req.method);
  console.log("URL    :", req.originalUrl);
  console.log("BODY   :", safeBody);
  console.log("================================");
  next();
});

// ===============================
// JWT Verify Middleware
// ===============================
const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      message: "Access Denied",
    });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({
      message: "Invalid Token",
    });
  }
};


// ===============================
// Role Middleware
// ===============================
const allowRoles = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        message: "Unauthorized",
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        message: "Forbidden",
      });
    }

    next();
  };
};


// ===============================
// Base Route
// ===============================
app.get("/", (req, res) => {
  res.send("Cloud POS Backend Running...");
});


// ===============================
// API Routes
// ===============================
app.use("/api/products", productRoutes);
app.use("/api/sales", salesRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/inventory-history", inventoryRoutes);
app.use("/api/damaged", verifyToken, damagedRoutes);
app.use("/api/settings", settingsRoutes);
// ===============================
// Login API
// ===============================
app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    const [rows] = await db.query(
      `SELECT * FROM users WHERE email = ?`,
      [email]
    );

    if (rows.length === 0) {
      return res.status(401).json({
        message: "Invalid Email",
      });
    }

    const user = rows[0];

    const match = await bcrypt.compare(password, user.password_hash);

    if (!match) {
      return res.status(401).json({
        message: "Invalid Password",
      });
    }

    const token = jwt.sign(
      {
        id: user.id,
        role: user.role,
        store_id: user.store_id,
        email: user.email,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "1d",
      }
    );

    return res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        store_id: user.store_id,
      },
    });
  } catch (err) {
    console.error("Login Error:", err);
    return res.status(500).json({
      message: err.message || "Internal server error",
    });
  }
});


// ===============================
// Logged In User
// ===============================
app.get("/api/auth/me", verifyToken, async (req, res) => {
  try {
    const [rows] = await db.query(
      `
      SELECT
        id,
        name,
        email,
        role,
        store_id
      FROM users
      WHERE id = ?
      `,
      [req.user.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    return res.json(rows[0]);
  } catch (err) {
    console.error("Auth Me Error:", err);
    return res.status(500).json({
      message: err.message || "Internal server error",
    });
  }
});


// ===============================
// Change Password (self-service, old-password verified)
// ===============================
app.put("/api/auth/change-password", verifyToken, async (req, res) => {
  const { old_password, new_password } = req.body;

  if (!old_password || !new_password) {
    return res.status(400).json({
      message: "Old password and new password both required",
    });
  }

  if (String(new_password).length < 6) {
    return res.status(400).json({
      message: "New password must be at least 6 characters",
    });
  }

  try {
    const [rows] = await db.query(
      "SELECT password_hash FROM users WHERE id = ?",
      [req.user.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    const match = await bcrypt.compare(old_password, rows[0].password_hash);

    if (!match) {
      return res.status(401).json({
        message: "Old password is incorrect",
      });
    }

    const newHash = await bcrypt.hash(new_password, 10);

    await db.query(
      "UPDATE users SET password_hash = ? WHERE id = ?",
      [newHash, req.user.id]
    );

    return res.json({
      message: "Password changed successfully",
    });
  } catch (err) {
    console.error("Change Password Error:", err);
    return res.status(500).json({
      message: err.message || "Internal server error",
    });
  }
});


// ===============================
// Dashboard: Today's Damaged Quantity
// ===============================
app.get("/api/dashboard/today-damaged", verifyToken, async (req, res) => {
  try {
    let where = "DATE(di.created_at) = CURDATE()";
    const params = [];

    if (req.user.role !== "Admin") {
      where += " AND di.store_id = ?";
      params.push(req.user.store_id);
    } else if (req.query.store_id) {
      where += " AND di.store_id = ?";
      params.push(req.query.store_id);
    }

    const [rows] = await db.query(
      `
      SELECT
        IFNULL(SUM(di.qty), 0) AS today_damaged_qty,
        IFNULL(SUM(di.qty * p.cost_price), 0) AS today_damaged_value
      FROM damaged_items di
      LEFT JOIN products p ON p.id = di.product_id
      WHERE ${where}
      `,
      params
    );

    return res.json({
      today_damaged_qty: Number(rows[0]?.today_damaged_qty) || 0,
      today_damaged_value: Number(rows[0]?.today_damaged_value) || 0,
    });
  } catch (err) {
    console.error("Today Damaged Error:", err);
    return res.status(500).json({
      message: err.message || "Internal server error",
    });
  }
});

// ===============================
// Dashboard: 7-Day Sales Trend
// ===============================
app.get("/api/dashboard/trend", verifyToken, async (req, res) => {
  try {
    let where = "created_at >= (CURDATE() - INTERVAL 6 DAY)";
    const params = [];

    if (req.user.role !== "Admin") {
      where += " AND store_id = ?";
      params.push(req.user.store_id);
    } else if (req.query.store_id) {
      where += " AND store_id = ?";
      params.push(req.query.store_id);
    }

    const [rows] = await db.query(
      `
      SELECT
        DATE_FORMAT(created_at, '%Y-%m-%d') AS sale_date,
        COUNT(*) AS order_count,
        IFNULL(SUM(payable_amount), 0) AS total_sales
      FROM sales
      WHERE ${where}
      GROUP BY DATE_FORMAT(created_at, '%Y-%m-%d')
      ORDER BY sale_date ASC
      `,
      params
    );

    // UTC conversion (toISOString) এড়িয়ে সরাসরি local date components দিয়ে
    // date string বানানো হচ্ছে — এতে timezone-এর কারণে দিন এদিক-ওদিক হবে না।
    const formatLocalDate = (date) => {
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, "0");
      const d = String(date.getDate()).padStart(2, "0");
      return `${y}-${m}-${d}`;
    };

    const result = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = formatLocalDate(d);

      const found = rows.find((r) => r.sale_date === dateStr);

      result.push({
        date: dateStr,
        total_sales: found ? Number(found.total_sales) : 0,
        order_count: found ? Number(found.order_count) : 0,
      });
    }

    return res.json(result);
  } catch (err) {
    console.error("Dashboard Trend Error:", err);
    return res.status(500).json({
      message: err.message || "Internal server error",
    });
  }
});

// ===============================
// Dashboard: Store-wise Breakdown (Admin only)
// ===============================
app.get(
  "/api/dashboard/store-breakdown",
  verifyToken,
  allowRoles("Admin"),
  async (req, res) => {
    try {
      const [storeRows] = await db.query(
        "SELECT id, name FROM stores ORDER BY id ASC"
      );

      const breakdown = [];
      let totalDamagedAllStores = 0;
      let totalDamagedValueAllStores = 0;

      for (const store of storeRows) {
        const [productRows] = await db.query(
          "SELECT COUNT(*) AS product_count FROM products WHERE store_id = ?",
          [store.id]
        );

        const [salesRows] = await db.query(
          `
          SELECT
            IFNULL(SUM(payable_amount), 0) AS total_revenue,
            COUNT(*) AS total_orders
          FROM sales
          WHERE store_id = ?
          `,
          [store.id]
        );

        const [damagedRows] = await db.query(
          `
          SELECT
            IFNULL(SUM(di.qty), 0) AS total_damaged_qty,
            IFNULL(SUM(di.qty * p.cost_price), 0) AS total_damaged_value
          FROM damaged_items di
          LEFT JOIN products p ON p.id = di.product_id
          WHERE di.store_id = ?
          `,
          [store.id]
        );

        const damagedCount = Number(damagedRows[0]?.total_damaged_qty) || 0;
        const damagedValue = Number(damagedRows[0]?.total_damaged_value) || 0;

        totalDamagedAllStores += damagedCount;
        totalDamagedValueAllStores += damagedValue;

        breakdown.push({
          store_id: store.id,
          store_name: store.name,
          product_count: Number(productRows[0]?.product_count) || 0,
          total_revenue: Number(salesRows[0]?.total_revenue) || 0,
          total_orders: Number(salesRows[0]?.total_orders) || 0,
          damaged_count: damagedCount,
          damaged_value: damagedValue,
        });
      }

      return res.json({
        stores: breakdown,
        total_damaged_all_stores: totalDamagedAllStores,
        total_damaged_value_all_stores: totalDamagedValueAllStores,
      });
    } catch (err) {
      console.error("Store Breakdown Error:", err);
      return res.status(500).json({
        message: err.message || "Internal server error",
      });
    }
  }
);


// ===============================
// User Management API
// ===============================

// Get Users
app.get("/api/users", verifyToken, allowRoles("Admin", "Manager"), async (req, res) => {
  try {
    let sql = "SELECT id, name, email, role, store_id FROM users";
    const params = [];

    if (req.user.role !== "Admin") {
      sql += " WHERE store_id = ?";
      params.push(req.user.store_id);
    } else if (req.query.store_id) {
      sql += " WHERE store_id = ?";
      params.push(req.query.store_id);
    }

    sql += " ORDER BY id DESC";

    const [rows] = await db.query(sql, params);
    return res.json(rows);
  } catch (err) {
    console.error("Get Users Error:", err);
    return res.status(500).json({
      message: err.message || "Internal server error",
    });
  }
});


// Add User
app.post("/api/users/add", verifyToken, allowRoles("Admin", "Manager"), async (req, res) => {
  try {
    const { name, email, password, role, store_id } = req.body;

    if (!name || !email || !password || !role) {
      return res.status(400).json({
        message: "Name, email, password and role are required",
      });
    }

    const [existingUsers] = await db.query(
      "SELECT id FROM users WHERE email = ?",
      [email]
    );

    if (existingUsers.length > 0) {
      return res.status(400).json({
        message: "Email already exists",
      });
    }

    const hash = await bcrypt.hash(password, 10);

    const finalStore =
      req.user.role === "Admin" ? store_id : req.user.store_id;

    await db.query(
      `
      INSERT INTO users
      (name, email, password_hash, role, store_id)
      VALUES (?, ?, ?, ?, ?)
      `,
      [name, email, hash, role, finalStore]
    );

    return res.json({
      message: "User Added Successfully",
    });
  } catch (err) {
    console.error("Add User Error:", err);
    return res.status(500).json({
      message: err.message || "Internal server error",
    });
  }
});


// Delete User
app.delete("/api/users/:id", verifyToken, allowRoles("Admin"), async (req, res) => {
  try {
    const targetId = parseInt(req.params.id);

    // Main admin account(s) কখনো delete করা যাবে না — শুধু frontend-এ button
    // disable করাই যথেষ্ট না, backend-এও এই সুরক্ষা থাকা জরুরি।
    if (targetId === 1 || targetId === 2) {
      return res.status(400).json({
        message: "Main admin cannot be deleted for system safety!",
      });
    }

    await db.query("DELETE FROM users WHERE id = ?", [req.params.id]);

    return res.json({
      message: "User Deleted Successfully",
    });
  } catch (err) {
    console.error("Delete User Error:", err);
    return res.status(500).json({
      message: err.message || "Internal server error",
    });
  }
});


// ===============================
// Store Management API
// ===============================

// Get Stores
app.get("/api/stores", verifyToken, async (req, res) => {
  try {
    let sql = "SELECT * FROM stores";
    const params = [];

    if (req.user.role !== "Admin") {
      sql += " WHERE id = ?";
      params.push(req.user.store_id);
    }

    sql += " ORDER BY id ASC";

    const [rows] = await db.query(sql, params);
    return res.json(rows);
  } catch (err) {
    console.error("Get Stores Error:", err);
    return res.status(500).json({
      message: err.message || "Internal server error",
    });
  }
});


// Add Store
app.post("/api/stores/add", verifyToken, allowRoles("Admin"), async (req, res) => {
  try {
    const { name, location } = req.body;

    if (!name || !location) {
      return res.status(400).json({
        message: "Name and location are required",
      });
    }

    await db.query(
      `
      INSERT INTO stores (name, location)
      VALUES (?, ?)
      `,
      [name, location]
    );

    return res.json({
      message: "Store Added Successfully",
    });
  } catch (err) {
    console.error("Add Store Error:", err);
    return res.status(500).json({
      message: err.message || "Internal server error",
    });
  }
});


// Update Store
app.put("/api/stores/:id", verifyToken, allowRoles("Admin"), async (req, res) => {
  try {
    const { name, location } = req.body;

    if (!name || !location) {
      return res.status(400).json({
        message: "Name and location are required",
      });
    }

    await db.query(
      `
      UPDATE stores
      SET name = ?, location = ?
      WHERE id = ?
      `,
      [name, location, req.params.id]
    );

    return res.json({
      message: "Store Updated Successfully",
    });
  } catch (err) {
    console.error("Update Store Error:", err);
    return res.status(500).json({
      message: err.message || "Internal server error",
    });
  }
});


// Delete Store
app.delete("/api/stores/:id", verifyToken, allowRoles("Admin"), async (req, res) => {
  try {
    if (Number(req.params.id) === 1) {
      return res.status(400).json({
        message: "Main Store cannot be deleted",
      });
    }

    await db.query("DELETE FROM stores WHERE id = ?", [req.params.id]);

    return res.json({
      message: "Store Deleted Successfully",
    });
  } catch (err) {
    console.error("Delete Store Error:", err);
    return res.status(500).json({
      message: err.message || "Internal server error",
    });
  }
});


// ===============================
// Reports Summary API
// ===============================
app.get("/api/reports/summary", verifyToken, async (req, res) => {
  try {
    let where = "";
    const params = [];

    if (req.user.role !== "Admin") {
      where = "WHERE store_id = ?";
      params.push(req.user.store_id);
    } else if (req.query.store_id) {
      where = "WHERE store_id = ?";
      params.push(req.query.store_id);
    }

    const [sales] = await db.query(
      `
      SELECT
        COUNT(*) AS total_orders,
        IFNULL(SUM(payable_amount), 0) AS total_sales
      FROM sales
      ${where}
      `,
      params
    );

    const [payments] = await db.query(
      `
      SELECT
        payment_method,
        IFNULL(SUM(payable_amount), 0) AS total
      FROM sales
      ${where}
      GROUP BY payment_method
      `,
      params
    );

    let cash_sales = 0;
    let bkash_sales = 0;
    let card_sales = 0;

    payments.forEach((p) => {
      if (p.payment_method === "Cash") cash_sales = Number(p.total);
      if (p.payment_method === "Bkash") bkash_sales = Number(p.total);
      if (p.payment_method === "Card") card_sales = Number(p.total);
    });

    return res.json({
      total_sales: Number(sales[0]?.total_sales || 0),
      total_orders: Number(sales[0]?.total_orders || 0),
      cash_sales,
      bkash_sales,
      card_sales,
    });
  } catch (err) {
    console.error("Reports Summary Error:", err);
    return res.status(500).json({
      message: err.message || "Internal server error",
    });
  }
});


// ===============================
// Reports: Monthly Income/Expense Summary
// ===============================
app.get("/api/reports/monthly", verifyToken, async (req, res) => {
  try {
    const now = new Date();
    const year = req.query.year ? Number(req.query.year) : now.getFullYear();
    const month = req.query.month ? Number(req.query.month) : now.getMonth() + 1;

    let salesWhere = "YEAR(created_at) = ? AND MONTH(created_at) = ?";
    const salesParams = [year, month];

    if (req.user.role !== "Admin") {
      salesWhere += " AND store_id = ?";
      salesParams.push(req.user.store_id);
    } else if (req.query.store_id) {
      salesWhere += " AND store_id = ?";
      salesParams.push(req.query.store_id);
    }

    const [salesRows] = await db.query(
      `SELECT IFNULL(SUM(payable_amount), 0) AS total_sales, COUNT(*) AS total_orders FROM sales WHERE ${salesWhere}`,
      salesParams
    );

    const [paymentRows] = await db.query(
      `SELECT payment_method, IFNULL(SUM(payable_amount), 0) AS total FROM sales WHERE ${salesWhere} GROUP BY payment_method`,
      salesParams
    );

    let damagedWhere = "YEAR(di.created_at) = ? AND MONTH(di.created_at) = ?";
    const damagedParams = [year, month];

    if (req.user.role !== "Admin") {
      damagedWhere += " AND di.store_id = ?";
      damagedParams.push(req.user.store_id);
    } else if (req.query.store_id) {
      damagedWhere += " AND di.store_id = ?";
      damagedParams.push(req.query.store_id);
    }

    const [damagedRows] = await db.query(
      `
      SELECT
        IFNULL(SUM(di.qty), 0) AS total_damaged_qty,
        IFNULL(SUM(di.qty * p.cost_price), 0) AS total_damaged_value
      FROM damaged_items di
      LEFT JOIN products p ON p.id = di.product_id
      WHERE ${damagedWhere}
      `,
      damagedParams
    );

    const totalSales = Number(salesRows[0]?.total_sales) || 0;
    const totalDamagedValue = Number(damagedRows[0]?.total_damaged_value) || 0;

    return res.json({
      year,
      month,
      total_sales: totalSales,
      total_orders: Number(salesRows[0]?.total_orders) || 0,
      payment_summary: paymentRows.map((p) => ({
        payment_method: p.payment_method,
        amount: Number(p.total),
      })),
      total_damaged_qty: Number(damagedRows[0]?.total_damaged_qty) || 0,
      total_damaged_value: totalDamagedValue,
      net_amount: totalSales - totalDamagedValue,
    });
  } catch (err) {
    console.error("Monthly Report Error:", err);
    return res.status(500).json({
      message: err.message || "Internal server error",
    });
  }
});


// ===============================
// 404 Handler
// ===============================
app.use((req, res) => {
  res.status(404).json({
    message: "API Not Found",
  });
});


// ===============================
// Start Server
// ===============================
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});