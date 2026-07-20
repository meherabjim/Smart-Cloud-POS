const db = require("../config/db");

const {
  normalizePhone,
  isValidPhone,
} = require("./customerController");

// ========================================
// Loyalty Rules
// ========================================

const POINT_EARN_AMOUNT = 100;
const MIN_REDEEM_POINTS = 100;
const REDEEM_POINT_BLOCK = 100;
const REDEEM_VALUE_PER_BLOCK = 80;

// ========================================
// Safe Number Helper
// ========================================

const toMoney = (value) => {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return 0;
  }

  return Number(number.toFixed(2));
};

// ========================================
// Get All Sales
// Store-wise + phone search
// ========================================

exports.getSales = async (req, res) => {
  try {
    const { phone, store_id } = req.query;

    let sql = `
      SELECT
        sales.*,
        customers.name AS customer_name
      FROM sales

      LEFT JOIN customers
        ON customers.id = sales.customer_id

      WHERE 1 = 1
    `;

    const params = [];

    if (store_id) {
      sql += ` AND sales.store_id = ?`;
      params.push(store_id);
    }

    if (phone) {
      sql += ` AND sales.customer_phone LIKE ?`;
      params.push(`%${phone}%`);
    }

    sql += ` ORDER BY sales.id DESC`;

    const [rows] = await db.query(
      sql,
      params
    );

    return res.json(rows);
  } catch (error) {
    console.error(
      "Get Sales Error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        error.message ||
        "Failed to load sales.",
    });
  }
};

// ========================================
// Get Single Sale Details
// ========================================

exports.getSaleDetails = async (
  req,
  res
) => {
  try {
    const saleId = Number.parseInt(
      req.params.id,
      10
    );

    if (!saleId) {
      return res.status(400).json({
        success: false,
        message: "Invalid sale ID.",
      });
    }

    const [sales] = await db.query(
      `
      SELECT
        sales.*,
        customers.name AS customer_name,
        customers.email AS customer_email
      FROM sales

      LEFT JOIN customers
        ON customers.id = sales.customer_id

      WHERE sales.id = ?
      LIMIT 1
      `,
      [saleId]
    );

    if (sales.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Sale not found.",
      });
    }

    const [items] = await db.query(
      `
      SELECT
        si.id,
        si.sale_id,
        si.product_id,
        si.quantity,
        si.price,
        p.name,
        p.barcode
      FROM sale_items si

      LEFT JOIN products p
        ON p.id = si.product_id

      WHERE si.sale_id = ?
      `,
      [saleId]
    );

    return res.status(200).json({
      success: true,
      sale: sales[0],
      items,
    });
  } catch (error) {
    console.error(
      "Get Sale Details Error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        error.message ||
        "Failed to load sale details.",
    });
  }
};

// ========================================
// Checkout Sale with Loyalty
// ========================================

exports.checkout = async (req, res) => {
  const {
    items,
    store_id,
    customer_phone,
    discount,
    tax,
    payment_method,
    redeem_points,
  } = req.body;

  // ----------------------------------------
  // Basic validation before DB connection
  // ----------------------------------------

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({
      success: false,
      message: "Cart is empty.",
    });
  }

  const storeId = Number(store_id);

  if (!Number.isInteger(storeId) || storeId <= 0) {
    return res.status(400).json({
      success: false,
      message:
        "A valid store_id is required.",
    });
  }

  const normalizedPhone =
    normalizePhone(customer_phone);

  if (!normalizedPhone) {
    return res.status(400).json({
      success: false,
      message:
        "Customer phone number is required.",
    });
  }

  if (!isValidPhone(normalizedPhone)) {
    return res.status(400).json({
      success: false,
      message:
        "Enter a valid Bangladeshi phone number.",
    });
  }

  if (!payment_method) {
    return res.status(400).json({
      success: false,
      message:
        "Payment method is required.",
    });
  }

  const requestedRedeemPoints =
    Number(redeem_points) || 0;

  if (
    !Number.isInteger(requestedRedeemPoints) ||
    requestedRedeemPoints < 0
  ) {
    return res.status(400).json({
      success: false,
      message:
        "Redeem points must be a valid whole number.",
    });
  }

  if (
    requestedRedeemPoints > 0 &&
    requestedRedeemPoints <
      MIN_REDEEM_POINTS
  ) {
    return res.status(400).json({
      success: false,
      message:
        "Minimum redeem amount is 100 points.",
    });
  }

  if (
    requestedRedeemPoints %
      REDEEM_POINT_BLOCK !==
    0
  ) {
    return res.status(400).json({
      success: false,
      message:
        "Points can only be redeemed in multiples of 100.",
    });
  }

  const manualDiscount =
    Math.max(0, toMoney(discount));

  const taxAmount =
    Math.max(0, toMoney(tax));

  let connection;

  try {
    connection = await db.getConnection();

    await connection.beginTransaction();

    // ========================================
    // Check Store
    // ========================================

    const [storeRows] =
      await connection.query(
        `
        SELECT id, name
        FROM stores
        WHERE id = ?
        LIMIT 1
        `,
        [storeId]
      );

    if (storeRows.length === 0) {
      throw new Error(
        "Selected store was not found."
      );
    }

    // ========================================
    // Find and Lock Customer
    // Prevent simultaneous double redemption
    // ========================================

    const [customerRows] =
      await connection.query(
        `
        SELECT
          id,
          name,
          phone,
          points_balance,
          status
        FROM customers
        WHERE phone = ?
        LIMIT 1
        FOR UPDATE
        `,
        [normalizedPhone]
      );

    if (customerRows.length === 0) {
      const error = new Error(
        "This phone number is not registered as a customer."
      );

      error.statusCode = 404;
      throw error;
    }

    const customer =
      customerRows[0];

    if (customer.status !== "Active") {
      const error = new Error(
        "This customer account is inactive."
      );

      error.statusCode = 403;
      throw error;
    }

    const previousPoints =
      Number(customer.points_balance) || 0;

    if (
      requestedRedeemPoints >
      previousPoints
    ) {
      const error = new Error(
        `Customer has only ${previousPoints} available points.`
      );

      error.statusCode = 400;
      throw error;
    }

    // ========================================
    // Verify Products and Calculate Subtotal
    // Backend calculates prices itself
    // ========================================

    const verifiedItems = [];
    let subtotal = 0;

    for (const item of items) {
      const productId =
        Number(item.id);

      const quantity =
        Number(item.quantity);

      if (
        !Number.isInteger(productId) ||
        productId <= 0
      ) {
        const error = new Error(
          "Cart contains an invalid product."
        );

        error.statusCode = 400;
        throw error;
      }

      if (
        !Number.isInteger(quantity) ||
        quantity <= 0
      ) {
        const error = new Error(
          "Product quantity must be at least 1."
        );

        error.statusCode = 400;
        throw error;
      }

      const [productRows] =
        await connection.query(
          `
          SELECT
            id,
            store_id,
            name,
            selling_price,
            discount_percent,
            stock,
            status
          FROM products
          WHERE id = ?
          LIMIT 1
          FOR UPDATE
          `,
          [productId]
        );

      if (productRows.length === 0) {
        const error = new Error(
          `Product #${productId} was not found.`
        );

        error.statusCode = 404;
        throw error;
      }

      const product =
        productRows[0];

      if (
        Number(product.store_id) !==
        storeId
      ) {
        const error = new Error(
          `${product.name} does not belong to the selected store.`
        );

        error.statusCode = 400;
        throw error;
      }

      if (
        product.status &&
        product.status !== "Active"
      ) {
        const error = new Error(
          `${product.name} is currently inactive.`
        );

        error.statusCode = 400;
        throw error;
      }

      const currentStock =
        Number(product.stock) || 0;

      if (currentStock < quantity) {
        const error = new Error(
          `Insufficient stock for ${product.name}. Available: ${currentStock}.`
        );

        error.statusCode = 400;
        throw error;
      }

      const originalPrice =
        toMoney(product.selling_price);

      const productDiscountPercent =
        Math.max(
          0,
          Number(
            product.discount_percent
          ) || 0
        );

      const unitPrice = toMoney(
        originalPrice -
          (originalPrice *
            productDiscountPercent) /
            100
      );

      const lineTotal = toMoney(
        unitPrice * quantity
      );

      subtotal = toMoney(
        subtotal + lineTotal
      );

      verifiedItems.push({
        id: product.id,
        name: product.name,
        quantity,
        unit_price: unitPrice,
        line_total: lineTotal,
      });
    }

    // ========================================
    // Calculate Loyalty Discount
    // ========================================

    const redeemBlocks =
      requestedRedeemPoints /
      REDEEM_POINT_BLOCK;

    const pointsDiscount =
      toMoney(
        redeemBlocks *
          REDEEM_VALUE_PER_BLOCK
      );

    const amountBeforePointDiscount =
      toMoney(
        subtotal -
          manualDiscount +
          taxAmount
      );

    if (amountBeforePointDiscount < 0) {
      const error = new Error(
        "Discount cannot be greater than the bill amount."
      );

      error.statusCode = 400;
      throw error;
    }

    if (
      pointsDiscount >
      amountBeforePointDiscount
    ) {
      const error = new Error(
        "Point discount cannot be greater than the payable bill."
      );

      error.statusCode = 400;
      throw error;
    }

    const finalPayableAmount =
      toMoney(
        amountBeforePointDiscount -
          pointsDiscount
      );

    // Every paid Tk 100 = 1 point
    const pointsEarned =
      Math.floor(
        finalPayableAmount /
          POINT_EARN_AMOUNT
      );

    const pointsAfterRedeem =
      previousPoints -
      requestedRedeemPoints;

    const finalPointsBalance =
      pointsAfterRedeem +
      pointsEarned;

    // ========================================
    // Save Main Sale
    // ========================================

    const [saleResult] =
      await connection.query(
        `
        INSERT INTO sales
        (
          store_id,
          customer_phone,
          customer_id,
          total_amount,
          discount,
          tax,
          payable_amount,
          payment_method,
          points_earned,
          points_redeemed,
          points_discount
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          storeId,
          normalizedPhone,
          customer.id,
          subtotal,
          manualDiscount,
          taxAmount,
          finalPayableAmount,
          payment_method,
          pointsEarned,
          requestedRedeemPoints,
          pointsDiscount,
        ]
      );

    const saleId =
      saleResult.insertId;

    // ========================================
    // Save Sale Items and Update Stock
    // ========================================

    for (const item of verifiedItems) {
      await connection.query(
        `
        INSERT INTO sale_items
        (
          sale_id,
          product_id,
          quantity,
          price
        )
        VALUES (?, ?, ?, ?)
        `,
        [
          saleId,
          item.id,
          item.quantity,
          item.unit_price,
        ]
      );

      await connection.query(
        `
        UPDATE products
        SET stock = stock - ?
        WHERE id = ?
        `,
        [
          item.quantity,
          item.id,
        ]
      );

      await connection.query(
        `
        INSERT INTO inventory_history
        (
          store_id,
          product_id,
          type,
          qty
        )
        VALUES (?, ?, 'OUT', ?)
        `,
        [
          storeId,
          item.id,
          item.quantity,
        ]
      );
    }

    // ========================================
    // Save Redeem Transaction
    // ========================================

    if (requestedRedeemPoints > 0) {
      await connection.query(
        `
        INSERT INTO point_transactions
        (
          customer_id,
          sale_id,
          store_id,
          transaction_type,
          points,
          amount_value,
          balance_after,
          note
        )
        VALUES (?, ?, ?, 'REDEEM', ?, ?, ?, ?)
        `,
        [
          customer.id,
          saleId,
          storeId,
          requestedRedeemPoints,
          pointsDiscount,
          pointsAfterRedeem,
          `${requestedRedeemPoints} points redeemed for Tk ${pointsDiscount.toFixed(
            2
          )} discount.`,
        ]
      );
    }

    // ========================================
    // Save Earn Transaction
    // ========================================

    if (pointsEarned > 0) {
      await connection.query(
        `
        INSERT INTO point_transactions
        (
          customer_id,
          sale_id,
          store_id,
          transaction_type,
          points,
          amount_value,
          balance_after,
          note
        )
        VALUES (?, ?, ?, 'EARN', ?, ?, ?, ?)
        `,
        [
          customer.id,
          saleId,
          storeId,
          pointsEarned,
          finalPayableAmount,
          finalPointsBalance,
          `${pointsEarned} points earned from Tk ${finalPayableAmount.toFixed(
            2
          )} paid.`,
        ]
      );
    }

    // ========================================
    // Update Customer Final Balance
    // ========================================

    await connection.query(
      `
      UPDATE customers
      SET points_balance = ?
      WHERE id = ?
      `,
      [
        finalPointsBalance,
        customer.id,
      ]
    );

    // ========================================
    // Commit Everything
    // ========================================

    await connection.commit();

    return res.status(201).json({
      success: true,
      message:
        "Sale completed successfully.",

      sale_id: saleId,

      customer: {
        id: customer.id,
        name: customer.name,
        phone: customer.phone,
      },

      items: verifiedItems,

      total_amount: subtotal,
      discount: manualDiscount,
      tax: taxAmount,

      points_redeemed:
        requestedRedeemPoints,

      points_discount:
        pointsDiscount,

      payable_amount:
        finalPayableAmount,

      payment_method,

      loyalty: {
        previous_points:
          previousPoints,

        redeemed_points:
          requestedRedeemPoints,

        redeemed_value:
          pointsDiscount,

        points_after_redeem:
          pointsAfterRedeem,

        earned_points:
          pointsEarned,

        remaining_points:
          finalPointsBalance,
      },
    });
  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error(
          "Checkout Rollback Error:",
          rollbackError
        );
      }
    }

    console.error(
      "Checkout Error:",
      error
    );

    return res
      .status(error.statusCode || 500)
      .json({
        success: false,
        message:
          error.message ||
          "Checkout failed.",
      });
  } finally {
    if (connection) {
      connection.release();
    }
  }
};