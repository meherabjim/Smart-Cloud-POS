const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require("../config/db");
const catalog = require("../config/customerCatalog");

// ========================================
// Bangladesh phone number normalization
// ========================================

const normalizePhone = (phone) => {
  let value = String(phone || "")
    .replace(/\s+/g, "")
    .replace(/-/g, "")
    .trim();

  if (value.startsWith("+880")) {
    value = `0${value.slice(4)}`;
  } else if (value.startsWith("880")) {
    value = `0${value.slice(3)}`;
  }

  return value;
};

const isValidPhone = (phone) => {
  return /^01[3-9]\d{8}$/.test(phone);
};

// ========================================
// Customer Registration
// POST /api/customers/register
// ========================================

exports.registerCustomer = async (req, res) => {
  const {
    name,
    phone,
    email,
    password,
  } = req.body;

  const normalizedPhone = normalizePhone(phone);

  if (!name || !normalizedPhone || !password) {
    return res.status(400).json({
      success: false,
      message:
        "Name, phone number and password are required.",
    });
  }

  if (!isValidPhone(normalizedPhone)) {
    return res.status(400).json({
      success: false,
      message:
        "Enter a valid Bangladeshi phone number.",
    });
  }

  if (String(password).length < 6) {
    return res.status(400).json({
      success: false,
      message:
        "Password must be at least 6 characters.",
    });
  }

  const normalizedEmail = email
    ? String(email).trim().toLowerCase()
    : null;

  try {
    const [phoneRows] = await db.query(
      `
      SELECT id
      FROM customers
      WHERE phone = ?
      LIMIT 1
      `,
      [normalizedPhone]
    );

    if (phoneRows.length > 0) {
      return res.status(409).json({
        success: false,
        message:
          "An account already exists with this phone number.",
      });
    }

    if (normalizedEmail) {
      const [emailRows] = await db.query(
        `
        SELECT id
        FROM customers
        WHERE email = ?
        LIMIT 1
        `,
        [normalizedEmail]
      );

      if (emailRows.length > 0) {
        return res.status(409).json({
          success: false,
          message:
            "An account already exists with this email.",
        });
      }
    }

    const passwordHash = await bcrypt.hash(
      password,
      10
    );

    const [result] = await db.query(
      `
      INSERT INTO customers
      (
        name,
        phone,
        email,
        password_hash,
        points_balance,
        status
      )
      VALUES (?, ?, ?, ?, 0, 'Active')
      `,
      [
        String(name).trim(),
        normalizedPhone,
        normalizedEmail,
        passwordHash,
      ]
    );

    return res.status(201).json({
      success: true,
      message:
        "Customer registration completed successfully.",
      customer: {
        id: result.insertId,
        name: String(name).trim(),
        phone: normalizedPhone,
        email: normalizedEmail,
        points_balance: 0,
      },
    });
  } catch (error) {
    console.error(
      "Customer Registration Error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        error.message ||
        "Customer registration failed.",
    });
  }
};

// ========================================
// Customer Login
// POST /api/customers/login
// Customer may login with phone or email
// ========================================

exports.loginCustomer = async (req, res) => {
  const {
    phone,
    email,
    password,
  } = req.body;

  const loginValue = phone || email;

  if (!loginValue || !password) {
    return res.status(400).json({
      success: false,
      message:
        "Phone/email and password are required.",
    });
  }

  try {
    let sql;
    let value;

    const normalizedPhone =
      normalizePhone(loginValue);

    if (isValidPhone(normalizedPhone)) {
      sql = `
        SELECT *
        FROM customers
        WHERE phone = ?
        LIMIT 1
      `;

      value = normalizedPhone;
    } else {
      sql = `
        SELECT *
        FROM customers
        WHERE email = ?
        LIMIT 1
      `;

      value = String(loginValue)
        .trim()
        .toLowerCase();
    }

    const [rows] = await db.query(
      sql,
      [value]
    );

    if (rows.length === 0) {
      return res.status(401).json({
        success: false,
        message:
          "Phone/email or password is incorrect.",
      });
    }

    const customer = rows[0];

    if (customer.status !== "Active") {
      return res.status(403).json({
        success: false,
        message:
          "This customer account is inactive.",
      });
    }

    const passwordMatched =
      await bcrypt.compare(
        password,
        customer.password_hash
      );

    if (!passwordMatched) {
      return res.status(401).json({
        success: false,
        message:
          "Phone/email or password is incorrect.",
      });
    }

    const token = jwt.sign(
      {
        id: customer.id,
        account_type: "customer",
        phone: customer.phone,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "7d",
      }
    );

    return res.json({
      success: true,
      message:
        "Customer login successful.",
      token,
      customer: {
        id: customer.id,
        name: customer.name,
        phone: customer.phone,
        email: customer.email,
        points_balance:
          Number(customer.points_balance) || 0,
      },
    });
  } catch (error) {
    console.error(
      "Customer Login Error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        error.message ||
        "Customer login failed.",
    });
  }
};

// ========================================
// Customer Profile
// GET /api/customers/me
// ========================================

exports.getCustomerProfile = async (
  req,
  res
) => {
  try {
    const [rows] = await db.query(
      `
      SELECT
        id,
        name,
        phone,
        email,
        points_balance,
        status,
        created_at
      FROM customers
      WHERE id = ?
      LIMIT 1
      `,
      [req.customer.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message:
          "Customer account not found.",
      });
    }

    return res.json({
      success: true,
      customer: {
        ...rows[0],
        points_balance:
          Number(
            rows[0].points_balance
          ) || 0,
      },
    });
  } catch (error) {
    console.error(
      "Get Customer Profile Error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        error.message ||
        "Failed to load customer profile.",
    });
  }
};

// ========================================
// Customer point history
// GET /api/customers/points/history
// ========================================

exports.getPointHistory = async (
  req,
  res
) => {
  try {
    const [rows] = await db.query(
      `
      SELECT
        pt.id,
        pt.sale_id,
        pt.store_id,
        s.name AS store_name,
        pt.transaction_type,
        pt.points,
        pt.amount_value,
        pt.balance_after,
        pt.note,
        pt.created_at
      FROM point_transactions pt
      LEFT JOIN stores s
        ON s.id = pt.store_id
      WHERE pt.customer_id = ?
      ORDER BY pt.id DESC
      `,
      [req.customer.id]
    );

    return res.json({
      success: true,
      transactions: rows.map(
        (item) => ({
          ...item,
          points:
            Number(item.points) || 0,
          amount_value:
            Number(
              item.amount_value
            ) || 0,
          balance_after:
            Number(
              item.balance_after
            ) || 0,
        })
      ),
    });
  } catch (error) {
    console.error(
      "Get Point History Error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        error.message ||
        "Failed to load point history.",
    });
  }
};

// ========================================
// Staff lookup customer by phone
// GET /api/customers/by-phone/:phone
// ========================================

exports.getCustomerByPhone = async (
  req,
  res
) => {
  const normalizedPhone =
    normalizePhone(req.params.phone);

  if (!isValidPhone(normalizedPhone)) {
    return res.status(400).json({
      success: false,
      message:
        "Enter a valid Bangladeshi phone number.",
    });
  }

  try {
    const [rows] = await db.query(
      `
      SELECT
        id,
        name,
        phone,
        email,
        points_balance,
        status
      FROM customers
      WHERE phone = ?
      LIMIT 1
      `,
      [normalizedPhone]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message:
          "No registered customer found with this phone number.",
      });
    }

    const customer = rows[0];
    const pointsBalance =
      Number(customer.points_balance) || 0;

    const redeemableBlocks =
      Math.floor(pointsBalance / 100);

    return res.json({
      success: true,
      customer: {
        id: customer.id,
        name: customer.name,
        phone: customer.phone,
        // Only Admin sees customer email; cashier needs name/points only
        email:
          req.user?.role === "Admin"
            ? customer.email
            : undefined,
        status: customer.status,
        points_balance:
          pointsBalance,

        minimum_redeem_points: 100,

        redeemable_points:
          redeemableBlocks * 100,

        redeemable_value:
          redeemableBlocks * 80,

        can_redeem:
          pointsBalance >= 100,
      },
    });
  } catch (error) {
    console.error(
      "Customer Phone Lookup Error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        error.message ||
        "Customer lookup failed.",
    });
  }
};

// ========================================
// Customer catalog (grouped by product name)
// No barcode, no cost price, no exact stock.
// ========================================

// GET /api/customers/products/discounted
exports.getDiscountedProducts = async (req, res) => {
  try {
    const rows = await catalog.findProducts({ discountedOnly: true });
    const groups = catalog.groupByName(rows).sort((a, b) => b.max_discount - a.max_discount);
    return res.json({ success: true, groups });
  } catch (error) {
    console.error("Discounted Products Error:", error);
    return res.status(500).json({ success: false, message: "Failed to load offers." });
  }
};

// GET /api/customers/products?search=&store_id=
exports.getCustomerProducts = async (req, res) => {
  try {
    const rows = await catalog.findProducts({
      search: String(req.query.search || "").slice(0, 60),
      storeId: Number(req.query.store_id) || null,
    });
    return res.json({ success: true, groups: catalog.groupByName(rows) });
  } catch (error) {
    console.error("Customer Products Error:", error);
    return res.status(500).json({ success: false, message: "Failed to load products." });
  }
};

// GET /api/customers/stores
exports.getCustomerStores = async (req, res) => {
  try {
    return res.json({ success: true, stores: await catalog.getStores() });
  } catch (error) {
    console.error("Customer Stores Error:", error);
    return res.status(500).json({ success: false, message: "Failed to load stores." });
  }
};

// GET /api/customers/stores/:id/products
exports.getStoreProducts = async (req, res) => {
  try {
    const storeId = Number(req.params.id);
    const store = (await catalog.getStores()).find((s) => s.id === storeId);
    if (!store) return res.status(404).json({ success: false, message: "Store not found." });

    const products = await catalog.findProducts({ storeId });
    products.sort((a, b) => (a.stock_status === "out") - (b.stock_status === "out") || a.name.localeCompare(b.name));
    return res.json({ success: true, store, products });
  } catch (error) {
    console.error("Store Products Error:", error);
    return res.status(500).json({ success: false, message: "Failed to load store." });
  }
};

// GET /api/customers/purchases
exports.getMyPurchases = async (req, res) => {
  try {
    const purchases = await catalog.getMyPurchases(req.customer.id, { limit: 50 });
    return res.json({ success: true, purchases });
  } catch (error) {
    console.error("My Purchases Error:", error);
    return res.status(500).json({ success: false, message: "Failed to load purchases." });
  }
};

exports.normalizePhone = normalizePhone;
exports.isValidPhone = isValidPhone;

// ========================================
// ADMIN ONLY: all customers
// GET /api/customers/admin/all?search=&store_id=
// Shows every loyalty customer with points, total purchase and
// which store(s) they bought from.
// ========================================

exports.getAllCustomersAdmin = async (
  req,
  res
) => {
  try {
    const search = String(req.query.search || "").trim();
    const storeId = Number(req.query.store_id) || null;

    let sql = `
      SELECT
        c.id,
        c.name,
        c.phone,
        c.email,
        c.points_balance,
        c.status,
        c.created_at,
        COUNT(sl.id) AS total_orders,
        IFNULL(SUM(sl.payable_amount), 0) AS total_spent,
        MAX(sl.created_at) AS last_purchase,
        GROUP_CONCAT(DISTINCT st.name ORDER BY st.name SEPARATOR ', ') AS stores
      FROM customers c
      LEFT JOIN sales sl
        ON sl.customer_id = c.id
      LEFT JOIN stores st
        ON st.id = sl.store_id
      WHERE 1 = 1
    `;
    const params = [];

    if (search) {
      sql += " AND (c.name LIKE ? OR c.phone LIKE ? OR c.email LIKE ?)";
      const like = `%${search}%`;
      params.push(like, like, like);
    }

    if (storeId) {
      sql += `
        AND EXISTS (
          SELECT 1 FROM sales s2
          WHERE s2.customer_id = c.id AND s2.store_id = ?
        )`;
      params.push(storeId);
    }

    sql += `
      GROUP BY c.id, c.name, c.phone, c.email,
               c.points_balance, c.status, c.created_at
      ORDER BY total_spent DESC, c.id DESC
      LIMIT 1000
    `;

    const [rows] = await db.query(sql, params);

    const customers = rows.map((r) => ({
      id: r.id,
      name: r.name,
      phone: r.phone,
      email: r.email,
      status: r.status || "Active",
      points_balance: Number(r.points_balance) || 0,
      total_orders: Number(r.total_orders) || 0,
      total_spent: Number(r.total_spent) || 0,
      last_purchase: r.last_purchase,
      stores: r.stores || "",
      created_at: r.created_at,
    }));

    return res.json({
      success: true,
      count: customers.length,
      total_points: customers.reduce((a, c) => a + c.points_balance, 0),
      customers,
    });
  } catch (error) {
    console.error("Admin Customers Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};