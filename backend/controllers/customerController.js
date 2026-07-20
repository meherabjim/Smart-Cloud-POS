const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require("../config/db");

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
          "Customer account not found.",
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
          "Incorrect password.",
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
        email: customer.email,
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
// Customer: discounted products
// GET /api/customers/products/discounted
// ========================================

exports.getDiscountedProducts = async (
  req,
  res
) => {
  try {
    const [rows] = await db.query(
      `
      SELECT
        p.id,
        p.store_id,
        s.name AS store_name,
        s.location AS store_location,
        p.name,
        p.barcode,
        p.category,
        p.selling_price,
        p.discount_percent,
        p.stock,
        p.status,

        ROUND(
          p.selling_price -
          (
            p.selling_price *
            p.discount_percent / 100
          ),
          2
        ) AS discounted_price

      FROM products p

      LEFT JOIN stores s
        ON s.id = p.store_id

      WHERE
        p.status = 'Active'
        AND p.stock > 0
        AND p.discount_percent > 0

      ORDER BY
        p.discount_percent DESC,
        p.name ASC
      `
    );

    return res.json({
      success: true,
      products: rows.map((product) => ({
        ...product,
        selling_price:
          Number(product.selling_price) || 0,

        discount_percent:
          Number(product.discount_percent) || 0,

        discounted_price:
          Number(product.discounted_price) || 0,

        stock:
          Number(product.stock) || 0,
      })),
    });
  } catch (error) {
    console.error(
      "Discounted Products Error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        error.message ||
        "Failed to load discounted products.",
    });
  }
};

// ========================================
// Customer: all available products
// GET /api/customers/products
// Optional: ?store_id=1&search=rice
// ========================================

exports.getCustomerProducts = async (
  req,
  res
) => {
  try {
    const {
      store_id,
      search,
    } = req.query;

    let sql = `
      SELECT
        p.id,
        p.store_id,
        s.name AS store_name,
        s.location AS store_location,
        p.name,
        p.barcode,
        p.category,
        p.selling_price,
        p.discount_percent,
        p.stock,
        p.status,

        ROUND(
          p.selling_price -
          (
            p.selling_price *
            p.discount_percent / 100
          ),
          2
        ) AS final_price

      FROM products p

      LEFT JOIN stores s
        ON s.id = p.store_id

      WHERE
        p.status = 'Active'
        AND p.stock > 0
    `;

    const params = [];

    if (store_id) {
      sql += ` AND p.store_id = ?`;
      params.push(Number(store_id));
    }

    if (search) {
      sql += `
        AND (
          p.name LIKE ?
          OR p.category LIKE ?
          OR p.barcode LIKE ?
          OR s.name LIKE ?
        )
      `;

      const keyword =
        `%${String(search).trim()}%`;

      params.push(
        keyword,
        keyword,
        keyword,
        keyword
      );
    }

    sql += `
      ORDER BY
        s.name ASC,
        p.name ASC
    `;

    const [rows] = await db.query(
      sql,
      params
    );

    return res.json({
      success: true,
      products: rows.map((product) => ({
        ...product,
        selling_price:
          Number(product.selling_price) || 0,

        discount_percent:
          Number(product.discount_percent) || 0,

        final_price:
          Number(product.final_price) || 0,

        stock:
          Number(product.stock) || 0,
      })),
    });
  } catch (error) {
    console.error(
      "Customer Products Error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        error.message ||
        "Failed to load products.",
    });
  }
};

// ========================================
// Customer: available stores
// GET /api/customers/stores
// ========================================

exports.getCustomerStores = async (
  req,
  res
) => {
  try {
    const [rows] = await db.query(
      `
      SELECT
        s.id,
        s.name,
        s.location,
        COUNT(p.id) AS available_products

      FROM stores s

      LEFT JOIN products p
        ON p.store_id = s.id
        AND p.status = 'Active'
        AND p.stock > 0

      GROUP BY
        s.id,
        s.name,
        s.location

      ORDER BY s.name ASC
      `
    );

    return res.json({
      success: true,
      stores: rows.map((store) => ({
        ...store,
        available_products:
          Number(
            store.available_products
          ) || 0,
      })),
    });
  } catch (error) {
    console.error(
      "Customer Stores Error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        error.message ||
        "Failed to load stores.",
    });
  }
};

exports.normalizePhone = normalizePhone;
exports.isValidPhone = isValidPhone;