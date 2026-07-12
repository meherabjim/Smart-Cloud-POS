const db = require("../config/db");

exports.getDashboardStats = async (req, res) => {
  try {

    // ===============================
    // Total Sales
    // ===============================
    const [sales] = await db.query(`
      SELECT IFNULL(SUM(payable_amount),0) AS total_sales
      FROM sales
    `);

    // ===============================
    // Today's Sales
    // ===============================
    const [todaySales] = await db.query(`
      SELECT IFNULL(SUM(payable_amount),0) AS today_sales
      FROM sales
      WHERE DATE(created_at)=CURDATE()
    `);

    // ===============================
    // Today's Profit
    // ===============================
    const [todayProfit] = await db.query(`
      SELECT
      IFNULL(SUM((p.selling_price-p.cost_price)*si.quantity),0) AS today_profit
      FROM sale_items si
      JOIN products p ON p.id=si.product_id
      JOIN sales s ON s.id=si.sale_id
      WHERE DATE(s.created_at)=CURDATE()
    `);

    // ===============================
    // Today's Damaged Loss
    // ===============================
    const [damaged] = await db.query(`
      SELECT
      IFNULL(SUM(d.qty*p.cost_price),0) AS today_damaged_loss
      FROM damaged_items d
      JOIN products p ON p.id=d.product_id
      WHERE DATE(d.created_at)=CURDATE()
    `);

    // ===============================
    // Inventory Value
    // ===============================
    const [inventory] = await db.query(`
      SELECT
      IFNULL(SUM(stock*cost_price),0) AS inventory_value
      FROM products
    `);

    // ===============================
    // Orders
    // ===============================
    const [orders] = await db.query(`
      SELECT COUNT(*) AS total_orders
      FROM sales
    `);

    // ===============================
    // Products
    // ===============================
    const [products] = await db.query(`
      SELECT COUNT(*) AS total_products
      FROM products
    `);

    // ===============================
    // Stores
    // ===============================
    const [stores] = await db.query(`
      SELECT COUNT(*) AS total_stores
      FROM stores
    `);

    // ===============================
    // Users
    // ===============================
    const [users] = await db.query(`
      SELECT COUNT(*) AS total_users
      FROM users
    `);

    // ===============================
    // Low Stock
    // ===============================
    const [lowStock] = await db.query(`
      SELECT COUNT(*) AS low_stock
      FROM products
      WHERE stock>0 AND stock<=5
    `);

    // ===============================
    // Out of Stock
    // ===============================
    const [outStock] = await db.query(`
      SELECT COUNT(*) AS out_stock
      FROM products
      WHERE stock=0
    `);

    // ===============================
    // Payment Summary
    // ===============================
    const [payment] = await db.query(`
      SELECT
      payment_method,
      IFNULL(SUM(payable_amount),0) AS amount
      FROM sales
      GROUP BY payment_method
      ORDER BY amount DESC
    `);

    // ===============================
    // Recent Sales
    // ===============================
    const [recentSales] = await db.query(`
      SELECT
      id,
      customer_phone,
      payable_amount
      FROM sales
      ORDER BY id DESC
      LIMIT 5
    `);

    // ===============================
    // Top Selling Products
    // ===============================
    const [topProducts] = await db.query(`
      SELECT
      p.name,
      SUM(si.quantity) AS total_qty
      FROM sale_items si
      JOIN products p ON p.id=si.product_id
      GROUP BY p.id,p.name
      ORDER BY total_qty DESC
      LIMIT 5
    `);

    // ===============================
    // Net Profit
    // ===============================
    const grossProfit = Number(todayProfit[0]?.today_profit || 0);
    const damagedLoss = Number(damaged[0]?.today_damaged_loss || 0);

    const netProfit = grossProfit - damagedLoss;

    // ===============================
    // Response
    // ===============================
    res.status(200).json({

      total_sales: Number(sales[0]?.total_sales || 0),

      today_sales: Number(todaySales[0]?.today_sales || 0),

      today_profit: grossProfit,

      today_damaged_loss: damagedLoss,

      net_profit: netProfit,

      inventory_value: Number(
        inventory[0]?.inventory_value || 0
      ),

      total_orders: Number(
        orders[0]?.total_orders || 0
      ),

      total_products: Number(
        products[0]?.total_products || 0
      ),

      total_stores: Number(
        stores[0]?.total_stores || 0
      ),

      total_users: Number(
        users[0]?.total_users || 0
      ),

      low_stock: Number(
        lowStock[0]?.low_stock || 0
      ),

      out_stock: Number(
        outStock[0]?.out_stock || 0
      ),

      payment_summary: payment,

      recent_sales: recentSales,

      top_products: topProducts

    });

  } catch (err) {

    console.error("Dashboard Controller Error:", err);

    res.status(500).json({
      message: err.message || "Internal server error"
    });

  }
};