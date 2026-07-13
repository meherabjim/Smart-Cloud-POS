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

// ========================================
// Basic middleware
// ========================================

app.use(cors());
app.use(express.json());

// Hide passwords from terminal logs
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

// ========================================
// Authentication middleware
// ========================================

const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      message: "Access denied. Please login first.",
    });
  }

  const token = authHeader.split(" ")[1];

  try {
    req.user = jwt.verify(
      token,
      process.env.JWT_SECRET
    );

    return next();
  } catch (error) {
    return res.status(401).json({
      message: "Invalid or expired token.",
    });
  }
};

const allowRoles = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        message: "Unauthorized.",
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        message: "Forbidden",
      });
    }

    return next();
  };
};

// Admin and Viewer can read all-store information
const hasAllStoreReadAccess = (role) => {
  return role === "Admin" || role === "Viewer";
};

// Viewer cannot perform POST, PUT, PATCH or DELETE
const blockViewerWrites = (req, res, next) => {
  const readMethods = [
    "GET",
    "HEAD",
    "OPTIONS",
  ];

  if (
    req.user?.role === "Viewer" &&
    !readMethods.includes(req.method)
  ) {
    return res.status(403).json({
      message: "Demo Viewer has read-only access.",
    });
  }

  return next();
};

// ========================================
// Base route
// ========================================

app.get("/", (req, res) => {
  res.send("Cloud POS Backend Running...");
});

// ========================================
// Login
// ========================================

app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      message: "Email and password are required.",
    });
  }

  try {
    const normalizedEmail = String(email)
      .trim()
      .toLowerCase();

    const [rows] = await db.query(
      "SELECT * FROM users WHERE email = ?",
      [normalizedEmail]
    );

    if (rows.length === 0) {
      return res.status(401).json({
        message: "Invalid Email",
      });
    }

    const user = rows[0];

    const matched = await bcrypt.compare(
      password,
      user.password_hash
    );

    if (!matched) {
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
  } catch (error) {
    console.error("Login Error:", error);

    return res.status(500).json({
      message:
        error.message ||
        "Internal server error",
    });
  }
});

// ========================================
// Current logged-in user
// ========================================

app.get(
  "/api/auth/me",
  verifyToken,
  async (req, res) => {
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
    } catch (error) {
      console.error(
        "Auth Me Error:",
        error
      );

      return res.status(500).json({
        message:
          error.message ||
          "Internal server error",
      });
    }
  }
);

// ========================================
// Change password
// Viewer is blocked
// ========================================

app.put(
  "/api/auth/change-password",
  verifyToken,
  blockViewerWrites,
  async (req, res) => {
    const {
      old_password,
      new_password,
    } = req.body;

    if (!old_password || !new_password) {
      return res.status(400).json({
        message:
          "Old password and new password both required",
      });
    }

    if (String(new_password).length < 6) {
      return res.status(400).json({
        message:
          "New password must be at least 6 characters",
      });
    }

    try {
      const [rows] = await db.query(
        `
        SELECT password_hash
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

      const matched = await bcrypt.compare(
        old_password,
        rows[0].password_hash
      );

      if (!matched) {
        return res.status(401).json({
          message:
            "Old password is incorrect",
        });
      }

      const newHash = await bcrypt.hash(
        new_password,
        10
      );

      await db.query(
        `
        UPDATE users
        SET password_hash = ?
        WHERE id = ?
        `,
        [newHash, req.user.id]
      );

      return res.json({
        message:
          "Password changed successfully",
      });
    } catch (error) {
      console.error(
        "Change Password Error:",
        error
      );

      return res.status(500).json({
        message:
          error.message ||
          "Internal server error",
      });
    }
  }
);

// ========================================
// Dashboard: today's damaged
// ========================================

app.get(
  "/api/dashboard/today-damaged",
  verifyToken,
  async (req, res) => {
    try {
      let where =
        "DATE(di.created_at) = CURDATE()";

      const params = [];

      if (
        !hasAllStoreReadAccess(
          req.user.role
        )
      ) {
        where +=
          " AND di.store_id = ?";

        params.push(
          req.user.store_id
        );
      } else if (req.query.store_id) {
        where +=
          " AND di.store_id = ?";

        params.push(
          req.query.store_id
        );
      }

      const [rows] = await db.query(
        `
        SELECT
          IFNULL(
            SUM(di.qty),
            0
          ) AS today_damaged_qty,

          IFNULL(
            SUM(
              di.qty * p.cost_price
            ),
            0
          ) AS today_damaged_value

        FROM damaged_items di

        LEFT JOIN products p
          ON p.id = di.product_id

        WHERE ${where}
        `,
        params
      );

      return res.json({
        today_damaged_qty:
          Number(
            rows[0]?.today_damaged_qty
          ) || 0,

        today_damaged_value:
          Number(
            rows[0]?.today_damaged_value
          ) || 0,
      });
    } catch (error) {
      console.error(
        "Today Damaged Error:",
        error
      );

      return res.status(500).json({
        message:
          error.message ||
          "Internal server error",
      });
    }
  }
);

// ========================================
// Dashboard: seven-day trend
// ========================================

app.get(
  "/api/dashboard/trend",
  verifyToken,
  async (req, res) => {
    try {
      let where =
        "created_at >= (CURDATE() - INTERVAL 6 DAY)";

      const params = [];

      if (
        !hasAllStoreReadAccess(
          req.user.role
        )
      ) {
        where +=
          " AND store_id = ?";

        params.push(
          req.user.store_id
        );
      } else if (req.query.store_id) {
        where +=
          " AND store_id = ?";

        params.push(
          req.query.store_id
        );
      }

      const [rows] = await db.query(
        `
        SELECT
          DATE_FORMAT(
            created_at,
            '%Y-%m-%d'
          ) AS sale_date,

          COUNT(*) AS order_count,

          IFNULL(
            SUM(payable_amount),
            0
          ) AS total_sales

        FROM sales

        WHERE ${where}

        GROUP BY DATE_FORMAT(
          created_at,
          '%Y-%m-%d'
        )

        ORDER BY sale_date ASC
        `,
        params
      );

      const formatLocalDate = (
        date
      ) => {
        const year =
          date.getFullYear();

        const month = String(
          date.getMonth() + 1
        ).padStart(2, "0");

        const day = String(
          date.getDate()
        ).padStart(2, "0");

        return `${year}-${month}-${day}`;
      };

      const result = [];

      for (
        let i = 6;
        i >= 0;
        i -= 1
      ) {
        const date = new Date();

        date.setDate(
          date.getDate() - i
        );

        const dateString =
          formatLocalDate(date);

        const found = rows.find(
          (row) =>
            row.sale_date ===
            dateString
        );

        result.push({
          date: dateString,

          total_sales: found
            ? Number(
                found.total_sales
              )
            : 0,

          order_count: found
            ? Number(
                found.order_count
              )
            : 0,
        });
      }

      return res.json(result);
    } catch (error) {
      console.error(
        "Dashboard Trend Error:",
        error
      );

      return res.status(500).json({
        message:
          error.message ||
          "Internal server error",
      });
    }
  }
);

// ========================================
// Dashboard: all-store breakdown
// Admin and Viewer can read
// ========================================

app.get(
  "/api/dashboard/store-breakdown",
  verifyToken,
  allowRoles("Admin", "Viewer"),
  async (req, res) => {
    try {
      const [storeRows] =
        await db.query(
          `
          SELECT id, name
          FROM stores
          ORDER BY id ASC
          `
        );

      const stores = [];

      let totalDamagedAllStores = 0;
      let totalDamagedValueAllStores = 0;

      for (const store of storeRows) {
        const [productRows] =
          await db.query(
            `
            SELECT
              COUNT(*) AS product_count
            FROM products
            WHERE store_id = ?
            `,
            [store.id]
          );

        const [salesRows] =
          await db.query(
            `
            SELECT
              IFNULL(
                SUM(payable_amount),
                0
              ) AS total_revenue,

              COUNT(*) AS total_orders

            FROM sales

            WHERE store_id = ?
            `,
            [store.id]
          );

        const [damagedRows] =
          await db.query(
            `
            SELECT
              IFNULL(
                SUM(di.qty),
                0
              ) AS total_damaged_qty,

              IFNULL(
                SUM(
                  di.qty *
                  p.cost_price
                ),
                0
              ) AS total_damaged_value

            FROM damaged_items di

            LEFT JOIN products p
              ON p.id =
              di.product_id

            WHERE di.store_id = ?
            `,
            [store.id]
          );

        const damagedCount =
          Number(
            damagedRows[0]
              ?.total_damaged_qty
          ) || 0;

        const damagedValue =
          Number(
            damagedRows[0]
              ?.total_damaged_value
          ) || 0;

        totalDamagedAllStores +=
          damagedCount;

        totalDamagedValueAllStores +=
          damagedValue;

        stores.push({
          store_id: store.id,
          store_name: store.name,

          product_count:
            Number(
              productRows[0]
                ?.product_count
            ) || 0,

          total_revenue:
            Number(
              salesRows[0]
                ?.total_revenue
            ) || 0,

          total_orders:
            Number(
              salesRows[0]
                ?.total_orders
            ) || 0,

          damaged_count:
            damagedCount,

          damaged_value:
            damagedValue,
        });
      }

      return res.json({
        stores,

        total_damaged_all_stores:
          totalDamagedAllStores,

        total_damaged_value_all_stores:
          totalDamagedValueAllStores,
      });
    } catch (error) {
      console.error(
        "Store Breakdown Error:",
        error
      );

      return res.status(500).json({
        message:
          error.message ||
          "Internal server error",
      });
    }
  }
);

// ========================================
// Users: Viewer can read
// ========================================

app.get(
  "/api/users",
  verifyToken,
  allowRoles(
    "Admin",
    "Manager",
    "Viewer"
  ),
  async (req, res) => {
    try {
      let sql = `
        SELECT
          id,
          name,
          email,
          role,
          store_id
        FROM users
      `;

      const params = [];

      if (
        !hasAllStoreReadAccess(
          req.user.role
        )
      ) {
        sql +=
          " WHERE store_id = ?";

        params.push(
          req.user.store_id
        );
      } else if (
        req.query.store_id
      ) {
        sql +=
          " WHERE store_id = ?";

        params.push(
          req.query.store_id
        );
      }

      sql += " ORDER BY id DESC";

      const [rows] =
        await db.query(
          sql,
          params
        );

      return res.json(rows);
    } catch (error) {
      console.error(
        "Get Users Error:",
        error
      );

      return res.status(500).json({
        message:
          error.message ||
          "Internal server error",
      });
    }
  }
);

// ========================================
// Add user
// Viewer cannot add
// ========================================

app.post(
  "/api/users/add",
  verifyToken,
  allowRoles(
    "Admin",
    "Manager"
  ),
  async (req, res) => {
    try {
      const {
        name,
        email,
        password,
        role,
        store_id,
      } = req.body;

      if (
        !name ||
        !email ||
        !password ||
        !role
      ) {
        return res.status(400).json({
          message:
            "Name, email, password and role are required",
        });
      }

      if (
        String(password).length < 6
      ) {
        return res.status(400).json({
          message:
            "Password must be at least 6 characters",
        });
      }

      const adminAllowedRoles = [
        "Manager",
        "Cashier",
        "Store Keeper",
        "Viewer",
      ];

      const managerAllowedRoles = [
        "Cashier",
        "Store Keeper",
      ];

      const allowedUserRoles =
        req.user.role === "Admin"
          ? adminAllowedRoles
          : managerAllowedRoles;

      if (
        !allowedUserRoles.includes(
          role
        )
      ) {
        return res.status(403).json({
          message:
            "You cannot create a user with this role",
        });
      }

      const normalizedEmail =
        String(email)
          .trim()
          .toLowerCase();

      const [existingUsers] =
        await db.query(
          `
          SELECT id
          FROM users
          WHERE email = ?
          `,
          [normalizedEmail]
        );

      if (
        existingUsers.length > 0
      ) {
        return res.status(400).json({
          message:
            "Email already exists",
        });
      }

      const finalStore =
        req.user.role === "Admin"
          ? Number(store_id)
          : req.user.store_id;

      if (!finalStore) {
        return res.status(400).json({
          message:
            "A valid store is required",
        });
      }

      const passwordHash =
        await bcrypt.hash(
          password,
          10
        );

      await db.query(
        `
        INSERT INTO users
        (
          name,
          email,
          password_hash,
          role,
          store_id
        )
        VALUES (?, ?, ?, ?, ?)
        `,
        [
          String(name).trim(),
          normalizedEmail,
          passwordHash,
          role,
          finalStore,
        ]
      );

      return res.json({
        message:
          "User added successfully",
      });
    } catch (error) {
      console.error(
        "Add User Error:",
        error
      );

      return res.status(500).json({
        message:
          error.message ||
          "Internal server error",
      });
    }
  }
);

// ========================================
// Delete user
// Admin only
// ========================================

app.delete(
  "/api/users/:id",
  verifyToken,
  allowRoles("Admin"),
  async (req, res) => {
    try {
      const targetId = Number(
        req.params.id
      );

      if (
        targetId === 1 ||
        targetId === 2
      ) {
        return res.status(400).json({
          message:
            "Main admin cannot be deleted for system safety!",
        });
      }

      if (
        targetId ===
        Number(req.user.id)
      ) {
        return res.status(400).json({
          message:
            "You cannot delete your own account.",
        });
      }

      const [result] =
        await db.query(
          `
          DELETE FROM users
          WHERE id = ?
          `,
          [targetId]
        );

      if (
        result.affectedRows === 0
      ) {
        return res.status(404).json({
          message: "User not found",
        });
      }

      return res.json({
        message:
          "User Deleted Successfully",
      });
    } catch (error) {
      console.error(
        "Delete User Error:",
        error
      );

      return res.status(500).json({
        message:
          error.message ||
          "Internal server error",
      });
    }
  }
);

// ========================================
// Stores: Viewer can read all stores
// ========================================

app.get(
  "/api/stores",
  verifyToken,
  async (req, res) => {
    try {
      let sql = `
        SELECT *
        FROM stores
      `;

      const params = [];

      if (
        !hasAllStoreReadAccess(
          req.user.role
        )
      ) {
        sql += " WHERE id = ?";

        params.push(
          req.user.store_id
        );
      }

      sql += " ORDER BY id ASC";

      const [rows] =
        await db.query(
          sql,
          params
        );

      return res.json(rows);
    } catch (error) {
      console.error(
        "Get Stores Error:",
        error
      );

      return res.status(500).json({
        message:
          error.message ||
          "Internal server error",
      });
    }
  }
);

// ========================================
// Add store
// Admin only
// ========================================

app.post(
  "/api/stores/add",
  verifyToken,
  allowRoles("Admin"),
  async (req, res) => {
    try {
      const {
        name,
        location,
      } = req.body;

      if (!name || !location) {
        return res.status(400).json({
          message:
            "Name and location are required",
        });
      }

      await db.query(
        `
        INSERT INTO stores
        (name, location)
        VALUES (?, ?)
        `,
        [
          String(name).trim(),
          String(location).trim(),
        ]
      );

      return res.json({
        message:
          "Store Added Successfully",
      });
    } catch (error) {
      console.error(
        "Add Store Error:",
        error
      );

      return res.status(500).json({
        message:
          error.message ||
          "Internal server error",
      });
    }
  }
);

// ========================================
// Update store
// Admin only
// ========================================

app.put(
  "/api/stores/:id",
  verifyToken,
  allowRoles("Admin"),
  async (req, res) => {
    try {
      const {
        name,
        location,
      } = req.body;

      if (!name || !location) {
        return res.status(400).json({
          message:
            "Name and location are required",
        });
      }

      const [result] =
        await db.query(
          `
          UPDATE stores
          SET
            name = ?,
            location = ?
          WHERE id = ?
          `,
          [
            String(name).trim(),
            String(location).trim(),
            req.params.id,
          ]
        );

      if (
        result.affectedRows === 0
      ) {
        return res.status(404).json({
          message: "Store not found",
        });
      }

      return res.json({
        message:
          "Store Updated Successfully",
      });
    } catch (error) {
      console.error(
        "Update Store Error:",
        error
      );

      return res.status(500).json({
        message:
          error.message ||
          "Internal server error",
      });
    }
  }
);

// ========================================
// Delete store
// Admin only
// ========================================

app.delete(
  "/api/stores/:id",
  verifyToken,
  allowRoles("Admin"),
  async (req, res) => {
    try {
      const storeId = Number(
        req.params.id
      );

      if (storeId === 1) {
        return res.status(400).json({
          message:
            "Main Store cannot be deleted",
        });
      }

      const [result] =
        await db.query(
          `
          DELETE FROM stores
          WHERE id = ?
          `,
          [storeId]
        );

      if (
        result.affectedRows === 0
      ) {
        return res.status(404).json({
          message: "Store not found",
        });
      }

      return res.json({
        message:
          "Store Deleted Successfully",
      });
    } catch (error) {
      console.error(
        "Delete Store Error:",
        error
      );

      return res.status(500).json({
        message:
          error.message ||
          "Internal server error",
      });
    }
  }
);

// ========================================
// Reports summary
// ========================================

app.get(
  "/api/reports/summary",
  verifyToken,
  async (req, res) => {
    try {
      let where = "";
      const params = [];

      if (
        !hasAllStoreReadAccess(
          req.user.role
        )
      ) {
        where =
          "WHERE store_id = ?";

        params.push(
          req.user.store_id
        );
      } else if (
        req.query.store_id
      ) {
        where =
          "WHERE store_id = ?";

        params.push(
          req.query.store_id
        );
      }

      const [sales] =
        await db.query(
          `
          SELECT
            COUNT(*) AS total_orders,

            IFNULL(
              SUM(payable_amount),
              0
            ) AS total_sales

          FROM sales

          ${where}
          `,
          params
        );

      const [payments] =
        await db.query(
          `
          SELECT
            payment_method,

            IFNULL(
              SUM(payable_amount),
              0
            ) AS total

          FROM sales

          ${where}

          GROUP BY payment_method
          `,
          params
        );

      let cashSales = 0;
      let bkashSales = 0;
      let cardSales = 0;

      payments.forEach(
        (payment) => {
          if (
            payment.payment_method ===
            "Cash"
          ) {
            cashSales =
              Number(
                payment.total
              ) || 0;
          }

          if (
            payment.payment_method ===
            "Bkash"
          ) {
            bkashSales =
              Number(
                payment.total
              ) || 0;
          }

          if (
            payment.payment_method ===
            "Card"
          ) {
            cardSales =
              Number(
                payment.total
              ) || 0;
          }
        }
      );

      return res.json({
        total_sales:
          Number(
            sales[0]?.total_sales
          ) || 0,

        total_orders:
          Number(
            sales[0]?.total_orders
          ) || 0,

        cash_sales: cashSales,
        bkash_sales: bkashSales,
        card_sales: cardSales,
      });
    } catch (error) {
      console.error(
        "Reports Summary Error:",
        error
      );

      return res.status(500).json({
        message:
          error.message ||
          "Internal server error",
      });
    }
  }
);

// ========================================
// Monthly report
// ========================================

app.get(
  "/api/reports/monthly",
  verifyToken,
  async (req, res) => {
    try {
      const now = new Date();

      const year =
        req.query.year
          ? Number(
              req.query.year
            )
          : now.getFullYear();

      const month =
        req.query.month
          ? Number(
              req.query.month
            )
          : now.getMonth() + 1;

      let salesWhere =
        "YEAR(created_at) = ? AND MONTH(created_at) = ?";

      const salesParams = [
        year,
        month,
      ];

      if (
        !hasAllStoreReadAccess(
          req.user.role
        )
      ) {
        salesWhere +=
          " AND store_id = ?";

        salesParams.push(
          req.user.store_id
        );
      } else if (
        req.query.store_id
      ) {
        salesWhere +=
          " AND store_id = ?";

        salesParams.push(
          req.query.store_id
        );
      }

      const [salesRows] =
        await db.query(
          `
          SELECT
            IFNULL(
              SUM(payable_amount),
              0
            ) AS total_sales,

            COUNT(*) AS total_orders

          FROM sales

          WHERE ${salesWhere}
          `,
          salesParams
        );

      const [paymentRows] =
        await db.query(
          `
          SELECT
            payment_method,

            IFNULL(
              SUM(payable_amount),
              0
            ) AS total

          FROM sales

          WHERE ${salesWhere}

          GROUP BY payment_method
          `,
          salesParams
        );

      let damagedWhere =
        "YEAR(di.created_at) = ? AND MONTH(di.created_at) = ?";

      const damagedParams = [
        year,
        month,
      ];

      if (
        !hasAllStoreReadAccess(
          req.user.role
        )
      ) {
        damagedWhere +=
          " AND di.store_id = ?";

        damagedParams.push(
          req.user.store_id
        );
      } else if (
        req.query.store_id
      ) {
        damagedWhere +=
          " AND di.store_id = ?";

        damagedParams.push(
          req.query.store_id
        );
      }

      const [damagedRows] =
        await db.query(
          `
          SELECT
            IFNULL(
              SUM(di.qty),
              0
            ) AS total_damaged_qty,

            IFNULL(
              SUM(
                di.qty *
                p.cost_price
              ),
              0
            ) AS total_damaged_value

          FROM damaged_items di

          LEFT JOIN products p
            ON p.id =
            di.product_id

          WHERE ${damagedWhere}
          `,
          damagedParams
        );

      const totalSales =
        Number(
          salesRows[0]
            ?.total_sales
        ) || 0;

      const totalDamagedValue =
        Number(
          damagedRows[0]
            ?.total_damaged_value
        ) || 0;

      return res.json({
        year,
        month,

        total_sales:
          totalSales,

        total_orders:
          Number(
            salesRows[0]
              ?.total_orders
          ) || 0,

        payment_summary:
          paymentRows.map(
            (payment) => ({
              payment_method:
                payment.payment_method,

              amount:
                Number(
                  payment.total
                ) || 0,
            })
          ),

        total_damaged_qty:
          Number(
            damagedRows[0]
              ?.total_damaged_qty
          ) || 0,

        total_damaged_value:
          totalDamagedValue,

        net_amount:
          totalSales -
          totalDamagedValue,
      });
    } catch (error) {
      console.error(
        "Monthly Report Error:",
        error
      );

      return res.status(500).json({
        message:
          error.message ||
          "Internal server error",
      });
    }
  }
);

// ========================================
// Existing route files
// ========================================

app.use(
  "/api/products",
  productRoutes
);

app.use(
  "/api/sales",
  salesRoutes
);

// Dashboard stats now requires login
app.use(
  "/api/dashboard",
  verifyToken,
  dashboardRoutes
);

app.use(
  "/api/inventory-history",
  verifyToken,
  inventoryRoutes
);

app.use(
  "/api/damaged",
  verifyToken,
  blockViewerWrites,
  damagedRoutes
);

app.use(
  "/api/settings",
  verifyToken,
  blockViewerWrites,
  settingsRoutes
);

// ========================================
// 404
// ========================================

app.use((req, res) => {
  return res.status(404).json({
    message: "API Not Found",
  });
});

// ========================================
// Start server
// ========================================

const PORT =
  process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(
    `🚀 Server running on port ${PORT}`
  );
});