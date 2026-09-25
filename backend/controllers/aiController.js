const db = require("../config/db");

// Admin sees all stores; Manager is locked to their own store.
const isAdmin = (role) => role === "Admin";

// Admin: optional store_id (body or query); none = ALL stores. Manager: own store.
function resolveScope(req) {
  if (isAdmin(req.user.role)) {
    const raw = req.body?.store_id ?? req.query?.store_id;
    const sid = raw ? Number(raw) : null;
    return { storeId: sid, allStores: !sid };
  }
  return { storeId: req.user.store_id, allStores: false };
}

function storeFilter(scope, col = "store_id") {
  if (scope.allStores) return { clause: "", params: [] };
  return { clause: ` AND ${col} = ?`, params: [scope.storeId] };
}

// ======================================================================
// Build a compact business snapshot the AI can reason over.
// ======================================================================
async function buildSnapshot(scope) {
  const sf = storeFilter(scope);

  const [salesRows] = await db.query(
    `
    SELECT
      IFNULL(SUM(CASE WHEN YEAR(created_at)=YEAR(CURDATE()) AND MONTH(created_at)=MONTH(CURDATE()) THEN payable_amount END),0) AS sales_this_month,
      IFNULL(SUM(CASE WHEN created_at >= DATE_FORMAT(CURDATE() - INTERVAL 1 MONTH,'%Y-%m-01')
                       AND created_at <  DATE_FORMAT(CURDATE(),'%Y-%m-01') THEN payable_amount END),0) AS sales_last_month,
      IFNULL(SUM(CASE WHEN DATE(created_at)=CURDATE() THEN payable_amount END),0) AS sales_today,
      COUNT(CASE WHEN DATE(created_at)=CURDATE() THEN 1 END) AS orders_today
    FROM sales
    WHERE 1=1${sf.clause}
    `,
    sf.params
  );

  const [profitRows] = await db.query(
    `
    SELECT IFNULL(SUM((p.selling_price - p.cost_price) * si.quantity),0) AS gross_profit_this_month
    FROM sale_items si
    JOIN sales s   ON s.id = si.sale_id
    JOIN products p ON p.id = si.product_id
    WHERE YEAR(s.created_at)=YEAR(CURDATE()) AND MONTH(s.created_at)=MONTH(CURDATE())
    ${scope.allStores ? "" : " AND s.store_id = ?"}
    `,
    scope.allStores ? [] : [scope.storeId]
  );

  const [expRows] = await db.query(
    `
    SELECT IFNULL(SUM(amount),0) AS expense_this_month
    FROM expenses
    WHERE YEAR(created_at)=YEAR(CURDATE()) AND MONTH(created_at)=MONTH(CURDATE())${sf.clause}
    `,
    sf.params
  );

  const [expCat] = await db.query(
    `
    SELECT category, IFNULL(SUM(amount),0) AS total
    FROM expenses
    WHERE YEAR(created_at)=YEAR(CURDATE()) AND MONTH(created_at)=MONTH(CURDATE())${sf.clause}
    GROUP BY category
    ORDER BY total DESC
    LIMIT 8
    `,
    sf.params
  );

  const [topProducts] = await db.query(
    `
    SELECT p.name, SUM(si.quantity) AS qty,
           IFNULL(SUM(si.quantity * si.price),0) AS revenue
    FROM sale_items si
    JOIN sales s   ON s.id = si.sale_id
    JOIN products p ON p.id = si.product_id
    WHERE YEAR(s.created_at)=YEAR(CURDATE()) AND MONTH(s.created_at)=MONTH(CURDATE())
    ${scope.allStores ? "" : " AND s.store_id = ?"}
    GROUP BY p.id, p.name
    ORDER BY qty DESC
    LIMIT 5
    `,
    scope.allStores ? [] : [scope.storeId]
  );

  const [stockRows] = await db.query(
    `
    SELECT
      SUM(CASE WHEN stock > 0 AND stock <= 5 THEN 1 ELSE 0 END) AS low_stock,
      SUM(CASE WHEN stock = 0 THEN 1 ELSE 0 END) AS out_of_stock
    FROM products
    WHERE 1=1${sf.clause}
    `,
    sf.params
  );

  const [lowNames] = await db.query(
    `
    SELECT name, stock FROM products
    WHERE stock <= 5${sf.clause}
    ORDER BY stock ASC
    LIMIT 8
    `,
    sf.params
  );

  const sales = salesRows[0] || {};
  const expense = Number(expRows[0]?.expense_this_month || 0);
  const grossProfit = Number(profitRows[0]?.gross_profit_this_month || 0);

  return {
    scope: scope.allStores ? "All stores" : `Store #${scope.storeId}`,
    money_note: "All amounts are in BDT (Taka).",
    sales_this_month: Number(sales.sales_this_month || 0),
    sales_last_month: Number(sales.sales_last_month || 0),
    sales_today: Number(sales.sales_today || 0),
    orders_today: Number(sales.orders_today || 0),
    gross_profit_this_month: grossProfit,
    expense_this_month: expense,
    net_profit_this_month: grossProfit - expense,
    expense_by_category: expCat.map((r) => ({ category: r.category, total: Number(r.total) })),
    top_products_this_month: topProducts.map((r) => ({
      name: r.name,
      qty: Number(r.qty),
      revenue: Number(r.revenue),
    })),
    low_stock_count: Number(stockRows[0]?.low_stock || 0),
    out_of_stock_count: Number(stockRows[0]?.out_of_stock || 0),
    low_stock_items: lowNames.map((r) => ({ name: r.name, stock: Number(r.stock) })),
  };
}

// ======================================================================
// POST /api/ai/chat   { question, store_id? }  — Groq
// ======================================================================
exports.chat = async (req, res) => {
  try {
    const question = (req.body?.question || "").toString().trim();
    if (!question) {
      return res.status(400).json({ success: false, message: "Please type a question." });
    }

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      return res.status(500).json({
        success: false,
        message: "AI is not configured. Add GROQ_API_KEY to the backend .env file.",
      });
    }

    const scope = resolveScope(req);
    const snapshot = await buildSnapshot(scope);

    const model = process.env.GROQ_MODEL || "openai/gpt-oss-20b";
    const url = "https://api.groq.com/openai/v1/chat/completions";

    const systemText =
      "You are a helpful business analyst for a retail Point-of-Sale system. " +
      "Answer ONLY using the JSON business data provided. Do not invent numbers. " +
      "If the data does not contain the answer, say so briefly. " +
      "Reply in the SAME language as the user's question (Bengali or English). " +
      "Keep answers short and clear. Amounts are in BDT (Taka), show them with the ৳ sign.";

    const userText =
      `BUSINESS DATA (JSON):\n${JSON.stringify(snapshot)}\n\n` +
      `USER QUESTION:\n${question}`;

    const body = {
      model,
      messages: [
        { role: "system", content: systemText },
        { role: "user", content: userText },
      ],
      temperature: 0.2,
      max_tokens: 800,
    };

    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!resp.ok) {
      const errText = await resp.text().catch(() => "");
      console.error("Groq error:", resp.status, errText);
      return res.status(502).json({
        success: false,
        message: "AI service error. Check the API key / model name and try again.",
      });
    }

    const data = await resp.json();
    const answer =
      data?.choices?.[0]?.message?.content ||
      "Sorry, I couldn't generate an answer.";

    return res.json({ success: true, answer, scope: snapshot.scope });
  } catch (error) {
    console.error("AI Chat Error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ======================================================================
// GET /api/ai/daily-report   (?store_id= for Admin) — Groq
// ======================================================================
exports.dailyReport = async (req, res) => {
  try {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      return res.status(500).json({
        success: false,
        message: "AI is not configured. Add GROQ_API_KEY to the backend .env file.",
      });
    }

    const scope = resolveScope(req);
    const snapshot = await buildSnapshot(scope);

    const model = process.env.GROQ_MODEL || "openai/gpt-oss-20b";
    const url = "https://api.groq.com/openai/v1/chat/completions";

    const systemText =
      "You write a short daily business report for a shop owner, in BENGALI. " +
      "Use ONLY the JSON data provided; never invent numbers. " +
      "Format as a few short bullet points covering: today's sales & orders, this month vs last month, " +
      "net profit, expenses, top-selling products, and any stock warnings. " +
      "Amounts are in BDT — show them with the ৳ sign. End with one short friendly suggestion. " +
      "Keep it under 150 words.";

    const userText =
      `BUSINESS DATA (JSON):\n${JSON.stringify(snapshot)}\n\n` +
      `Write today's report.`;

    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemText },
          { role: "user", content: userText },
        ],
        temperature: 0.3,
        max_tokens: 700,
      }),
    });

    if (!resp.ok) {
      const errText = await resp.text().catch(() => "");
      console.error("Groq error (daily report):", resp.status, errText);
      return res.status(502).json({
        success: false,
        message: "AI service error. Check the API key / model name and try again.",
      });
    }

    const data = await resp.json();
    const report =
      data?.choices?.[0]?.message?.content ||
      "Sorry, I couldn't generate the report.";

    return res.json({ success: true, report, scope: snapshot.scope });
  } catch (error) {
    console.error("Daily Report Error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ======================================================================
// GET /api/ai/forecast   (?store_id= for Admin) — offline, no external AI
// Simple sales forecast + reorder suggestion from the last 30 days.
// ======================================================================
exports.forecast = async (req, res) => {
  try {
    const scope = resolveScope(req);

    const [rows] = await db.query(
      `
      SELECT p.id, p.name, p.stock,
        IFNULL(SUM(CASE WHEN s.id IS NOT NULL THEN si.quantity END),0) AS sold30
      FROM products p
      LEFT JOIN sale_items si ON si.product_id = p.id
      LEFT JOIN sales s
        ON s.id = si.sale_id
       AND s.created_at >= (CURDATE() - INTERVAL 30 DAY)
      WHERE 1=1${scope.allStores ? "" : " AND p.store_id = ?"}
      GROUP BY p.id, p.name, p.stock
      `,
      scope.allStores ? [] : [scope.storeId]
    );

    const items = [];
    for (const r of rows) {
      const sold30 = Number(r.sold30 || 0);
      const stock = Number(r.stock || 0);
      if (sold30 <= 0) continue;

      const avgDaily = sold30 / 30;
      const next7 = Math.round(avgDaily * 7);
      const daysLeft = avgDaily > 0 ? Math.floor(stock / avgDaily) : 999;
      const target = Math.ceil(avgDaily * 14);
      const reorderQty = Math.max(0, target - stock);

      items.push({
        name: r.name,
        stock,
        avgDaily: Number(avgDaily.toFixed(1)),
        next7,
        daysLeft,
        reorderQty,
      });
    }

    items.sort((a, b) => a.daysLeft - b.daysLeft);
    const top = items.slice(0, 15);

    let report;
    if (top.length === 0) {
      report =
        "গত ৩০ দিনে কোন বিক্রি নেই, তাই এখন forecast দেওয়া যাচ্ছে না।\n" +
        "কিছু বিক্রি হলে এখানে কোন পণ্য কবে শেষ হবে ও কতটা কিনতে হবে দেখাবে।";
    } else {
      const lines = top.map((it) => {
        const runOut =
          it.daysLeft >= 999 ? "শেষ হচ্ছে না" : `আনুমানিক ${it.daysLeft} দিনে শেষ`;
        const buy =
          it.reorderQty > 0 ? `→ ~${it.reorderQty} টা কিনুন` : "→ যথেষ্ট আছে";
        return `• ${it.name} — স্টক ${it.stock}, দৈনিক বিক্রি ~${it.avgDaily}, ${runOut} ${buy}`;
      });
      report =
        "📦 বিক্রয় পূর্বাভাস ও Reorder পরামর্শ (গত ৩০ দিনের ভিত্তিতে):\n\n" +
        lines.join("\n") +
        "\n\n(যেগুলো দ্রুত শেষ হচ্ছে সেগুলো আগে আছে।)";
    }

    return res.json({
      success: true,
      scope: scope.allStores ? "All stores" : `Store #${scope.storeId}`,
      count: top.length,
      items: top,
      report,
    });
  } catch (error) {
    console.error("Forecast Error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ======================================================================
// GET /api/ai/anomalies   (?store_id= for Admin) — offline, no external AI
// ======================================================================
exports.anomalies = async (req, res) => {
  try {
    const scope = resolveScope(req);
    const sf = storeFilter(scope);
    const alerts = [];

    // 1) Yesterday's sales vs 30-day daily average
    const [salesAvg] = await db.query(
      `
      SELECT
        IFNULL(SUM(CASE WHEN DATE(created_at)=CURDATE() - INTERVAL 1 DAY THEN payable_amount END),0) AS yday,
        IFNULL(SUM(CASE WHEN created_at >= CURDATE() - INTERVAL 30 DAY
                         AND created_at <  CURDATE() THEN payable_amount END),0) AS last30
      FROM sales
      WHERE 1=1${sf.clause}
      `,
      sf.params
    );
    const yday = Number(salesAvg[0]?.yday || 0);
    const dailyAvg = Number(salesAvg[0]?.last30 || 0) / 30;
    if (dailyAvg > 0) {
      if (yday < dailyAvg * 0.5) {
        alerts.push({
          level: "high",
          title: "Sales dropped yesterday",
          detail: `Yesterday's sales ৳${Math.round(yday)} — well below the 30-day daily average ৳${Math.round(dailyAvg)}.`,
        });
      } else if (yday > dailyAvg * 2) {
        alerts.push({
          level: "info",
          title: "Sales spike yesterday",
          detail: `Yesterday's sales ৳${Math.round(yday)} — more than double the daily average ৳${Math.round(dailyAvg)}.`,
        });
      }
    }

    // 2) Expense category spike: this month vs prev 3-month average
    const [catRows] = await db.query(
      `
      SELECT category,
        IFNULL(SUM(CASE WHEN YEAR(created_at)=YEAR(CURDATE()) AND MONTH(created_at)=MONTH(CURDATE())
                        THEN amount END),0) AS this_month,
        IFNULL(SUM(CASE WHEN created_at >= DATE_FORMAT(CURDATE() - INTERVAL 3 MONTH,'%Y-%m-01')
                         AND created_at <  DATE_FORMAT(CURDATE(),'%Y-%m-01')
                        THEN amount END),0) AS prev_3m
      FROM expenses
      WHERE created_at >= DATE_FORMAT(CURDATE() - INTERVAL 3 MONTH,'%Y-%m-01')${sf.clause}
      GROUP BY category
      `,
      sf.params
    );
    for (const r of catRows) {
      const thisM = Number(r.this_month || 0);
      const avg3 = Number(r.prev_3m || 0) / 3;
      if (avg3 > 0 && thisM > avg3 * 1.5 && thisM - avg3 > 500) {
        alerts.push({
          level: "medium",
          title: `High "${r.category}" expense this month`,
          detail: `৳${Math.round(thisM)} spent so far — vs a monthly average of ৳${Math.round(avg3)}.`,
        });
      }
    }

    // 3) Damage/spoilage loss yesterday vs 30-day average
    const [dmg] = await db.query(
      `
      SELECT
        IFNULL(SUM(CASE WHEN DATE(d.created_at)=CURDATE() - INTERVAL 1 DAY THEN d.qty*p.cost_price END),0) AS yday,
        IFNULL(SUM(CASE WHEN d.created_at >= CURDATE() - INTERVAL 30 DAY
                         AND d.created_at <  CURDATE() THEN d.qty*p.cost_price END),0) AS last30
      FROM damaged_items d
      JOIN products p ON p.id = d.product_id
      WHERE 1=1${scope.allStores ? "" : " AND p.store_id = ?"}
      `,
      scope.allStores ? [] : [scope.storeId]
    );
    const dmgY = Number(dmg[0]?.yday || 0);
    const dmgAvg = Number(dmg[0]?.last30 || 0) / 30;
    if (dmgAvg > 0 && dmgY > dmgAvg * 2 && dmgY > 200) {
      alerts.push({
        level: "medium",
        title: "High damage/spoilage yesterday",
        detail: `Damage loss ৳${Math.round(dmgY)} yesterday — over double the daily average ৳${Math.round(dmgAvg)}.`,
      });
    }

    // 4) Stock warnings
    const [stock] = await db.query(
      `
      SELECT
        SUM(CASE WHEN stock=0 THEN 1 ELSE 0 END) AS out_of_stock,
        SUM(CASE WHEN stock>0 AND stock<=5 THEN 1 ELSE 0 END) AS low_stock
      FROM products
      WHERE 1=1${sf.clause}
      `,
      sf.params
    );
    const outStock = Number(stock[0]?.out_of_stock || 0);
    const lowStock = Number(stock[0]?.low_stock || 0);
    if (outStock > 0) {
      alerts.push({
        level: "high",
        title: `${outStock} product(s) out of stock`,
        detail: "These items cannot be sold right now. Restock soon.",
      });
    }
    if (lowStock > 0) {
      alerts.push({
        level: "medium",
        title: `${lowStock} product(s) low on stock`,
        detail: "Stock is 5 or below — consider reordering.",
      });
    }

    // 5) Today's absentees
    try {
      const [att] = await db.query(
        `
        SELECT COUNT(*) AS absent_today
        FROM attendance a
        JOIN users u ON u.id = a.user_id
        WHERE a.date = CURDATE() AND a.status = 'Absent'
        ${scope.allStores ? "" : " AND u.store_id = ?"}
        `,
        scope.allStores ? [] : [scope.storeId]
      );
      const absent = Number(att[0]?.absent_today || 0);
      if (absent >= 2) {
        alerts.push({
          level: "medium",
          title: `${absent} staff absent today`,
          detail: "More absentees than usual — check staffing.",
        });
      }
    } catch (e) {
      // attendance table may not exist yet — ignore
    }

    const order = { high: 0, medium: 1, info: 2 };
    alerts.sort((a, b) => (order[a.level] ?? 3) - (order[b.level] ?? 3));

    return res.json({
      success: true,
      scope: scope.allStores ? "All stores" : `Store #${scope.storeId}`,
      count: alerts.length,
      alerts,
    });
  } catch (error) {
    console.error("Anomaly Error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};