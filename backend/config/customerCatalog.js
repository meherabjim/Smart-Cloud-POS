// Customer-safe product/store/purchase queries.
// Used by the customer portal AND the customer AI chat.
// Never returns cost_price, barcode or exact stock numbers.
const db = require("./db");

const LOW_STOCK = 5;

const normalizeName = (s) =>
  String(s || "").toLowerCase().replace(/\s+/g, " ").trim();

const stockStatus = (stock) => {
  const n = Number(stock) || 0;
  if (n <= 0) return "out";
  if (n <= LOW_STOCK) return "low";
  return "in";
};

const round2 = (v) => Math.round((Number(v) + Number.EPSILON) * 100) / 100;

const toPublic = (p) => {
  const price = Number(p.selling_price) || 0;
  const discount = Number(p.discount_percent) || 0;
  return {
    product_id: p.id,
    name: p.name,
    category: p.category || "General",
    store_id: p.store_id,
    store_name: p.store_name,
    store_location: p.store_location,
    price,
    discount_percent: discount,
    final_price: round2(price - (price * discount) / 100),
    stock_status: stockStatus(p.stock),
  };
};

// Raw product rows (Active only). Out-of-stock rows are included.
async function findProducts({ search = "", storeId = null, discountedOnly = false, limit = 500 } = {}) {
  let sql = `
    SELECT p.id, p.name, p.category, p.store_id, p.selling_price,
           p.discount_percent, p.stock,
           s.name AS store_name, s.location AS store_location
    FROM products p
    JOIN stores s ON s.id = p.store_id
    WHERE (p.status IS NULL OR p.status = 'Active')`;
  const params = [];

  const words = String(search).trim().split(/\s+/).filter(Boolean).slice(0, 5);
  for (const w of words) {
    sql += " AND (p.name LIKE ? OR p.category LIKE ?)";
    params.push(`%${w}%`, `%${w}%`);
  }
  if (storeId) { sql += " AND p.store_id = ?"; params.push(Number(storeId)); }
  if (discountedOnly) sql += " AND p.discount_percent > 0 AND p.stock > 0";

  sql += " ORDER BY p.name ASC LIMIT ?";
  params.push(Number(limit));

  const [rows] = await db.query(sql, params);
  return rows.map(toPublic);
}

// Same product name in many stores -> one group, cheapest in-stock store first.
function groupByName(items) {
  const map = new Map();
  for (const it of items) {
    const key = normalizeName(it.name);
    if (!map.has(key)) map.set(key, { key, name: it.name, category: it.category, stores: [] });
    map.get(key).stores.push(it);
  }

  return [...map.values()].map((g) => {
    g.stores.sort((a, b) =>
      (a.stock_status === "out") - (b.stock_status === "out") || a.final_price - b.final_price
    );
    const available = g.stores.filter((s) => s.stock_status !== "out");
    const cheapest = available[0] || null;
    const costliest = available.length ? Math.max(...available.map((s) => s.final_price)) : null;
    return {
      ...g,
      cheapest,
      save_amount: cheapest && costliest != null ? round2(costliest - cheapest.final_price) : 0,
      available_stores: available.length,
      max_discount: Math.max(0, ...g.stores.map((s) => s.discount_percent)),
    };
  });
}

async function getStores() {
  const [rows] = await db.query(`
    SELECT s.id, s.name, s.location,
      SUM(CASE WHEN p.id IS NOT NULL AND p.stock > 0 THEN 1 ELSE 0 END) AS in_stock_products,
      SUM(CASE WHEN p.id IS NOT NULL AND p.discount_percent > 0 AND p.stock > 0 THEN 1 ELSE 0 END) AS offers
    FROM stores s
    LEFT JOIN products p ON p.store_id = s.id AND (p.status IS NULL OR p.status = 'Active')
    GROUP BY s.id, s.name, s.location
    ORDER BY s.name ASC`);
  return rows.map((r) => ({
    id: r.id, name: r.name, location: r.location,
    in_stock_products: Number(r.in_stock_products) || 0,
    offers: Number(r.offers) || 0,
  }));
}

// Only the logged-in customer's own sales.
async function getMyPurchases(customerId, { limit = 20, thisMonthOnly = false } = {}) {
  let sql = `
    SELECT sl.id, sl.created_at, sl.store_id, st.name AS store_name,
           sl.total_amount, sl.discount, sl.points_discount, sl.payable_amount,
           sl.payment_method, sl.points_earned, sl.points_redeemed
    FROM sales sl
    LEFT JOIN stores st ON st.id = sl.store_id
    WHERE sl.customer_id = ?`;
  if (thisMonthOnly) sql += " AND YEAR(sl.created_at) = YEAR(CURDATE()) AND MONTH(sl.created_at) = MONTH(CURDATE())";
  sql += " ORDER BY sl.id DESC LIMIT ?";

  const [sales] = await db.query(sql, [customerId, Number(limit)]);
  if (sales.length === 0) return [];

  const ids = sales.map((s) => s.id);
  const [items] = await db.query(
    `SELECT si.sale_id, si.quantity, si.price, p.name
     FROM sale_items si LEFT JOIN products p ON p.id = si.product_id
     WHERE si.sale_id IN (${ids.map(() => "?").join(",")})`,
    ids
  );

  return sales.map((s) => ({
    ...s,
    total_amount: Number(s.total_amount) || 0,
    discount: Number(s.discount) || 0,
    points_discount: Number(s.points_discount) || 0,
    payable_amount: Number(s.payable_amount) || 0,
    items: items
      .filter((i) => i.sale_id === s.id)
      .map((i) => ({ name: i.name || "Removed product", quantity: i.quantity, price: Number(i.price) || 0 })),
  }));
}

// "chal, dal, tel" -> which single store has most items at the lowest total.
async function shoppingList(names) {
  const list = (names || []).map((n) => String(n).trim()).filter(Boolean).slice(0, 10);
  const perItem = [];
  for (const n of list) {
    const found = (await findProducts({ search: n, limit: 100 })).filter((p) => p.stock_status !== "out");
    perItem.push({ item: n, found });
  }

  const stores = new Map();
  for (const { item, found } of perItem) {
    const bestPerStore = new Map();
    for (const p of found) {
      const cur = bestPerStore.get(p.store_id);
      if (!cur || p.final_price < cur.final_price) bestPerStore.set(p.store_id, p);
    }
    for (const [sid, p] of bestPerStore) {
      if (!stores.has(sid)) stores.set(sid, { store_id: sid, store_name: p.store_name, items: [], total: 0 });
      const s = stores.get(sid);
      s.items.push({ item, name: p.name, final_price: p.final_price });
      s.total = round2(s.total + p.final_price);
    }
  }

  const ranked = [...stores.values()].sort((a, b) => b.items.length - a.items.length || a.total - b.total);
  return {
    requested: list,
    not_found_anywhere: perItem.filter((x) => x.found.length === 0).map((x) => x.item),
    best_store: ranked[0] || null,
    other_stores: ranked.slice(1, 4),
  };
}

module.exports = { normalizeName, stockStatus, findProducts, groupByName, getStores, getMyPurchases, shoppingList };