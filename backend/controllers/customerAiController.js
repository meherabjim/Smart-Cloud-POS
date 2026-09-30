// Customer AI chat (separate from the Admin/Manager AI).
// The model never sees cost price, barcode, exact stock or other customers.
// All numbers come from the database through the tools below.
const db = require("../config/db");
const catalog = require("../config/customerCatalog");

const DAILY_LIMIT = 30;
const MAX_QUESTION = 300;
const usage = new Map(); // customerId -> { day, count }  (resets if server restarts)

const today = () => new Date().toISOString().slice(0, 10);

function takeQuota(customerId) {
  const u = usage.get(customerId);
  if (!u || u.day !== today()) { usage.set(customerId, { day: today(), count: 1 }); return true; }
  if (u.count >= DAILY_LIMIT) return false;
  u.count += 1;
  return true;
}

// ---------- tools ----------
const TOOLS = [
  { name: "search_products", description: "Find a product by name or category in all stores. Returns each store's price, cheapest store first. Product names are mostly English, so translate Bengali/Banglish words first (chal->rice, dal->lentil, tel->oil, chini->sugar, lobon->salt, dim->egg, dudh->milk).", parameters: { type: "object", properties: { query: { type: "string" } }, required: ["query"] } },
  { name: "get_offers", description: "Products with a discount right now, biggest discount first. Optional store_name.", parameters: { type: "object", properties: { store_name: { type: "string" } } } },
  { name: "shopping_list", description: "For several products, find the single store that has the most of them at the lowest total.", parameters: { type: "object", properties: { items: { type: "array", items: { type: "string" } } }, required: ["items"] } },
  { name: "get_my_points", description: "The customer's loyalty points and how much discount they are worth.", parameters: { type: "object", properties: {} } },
  { name: "get_my_purchases", description: "The customer's own recent purchases. this_month=true for only this month's total.", parameters: { type: "object", properties: { this_month: { type: "boolean" } } } },
  { name: "get_stores", description: "All stores with location and how many products are in stock.", parameters: { type: "object", properties: {} } },
];

const slimGroup = (g) => ({
  name: g.name,
  category: g.category,
  available_stores: g.available_stores,
  save_amount: g.save_amount,
  stores: g.stores.slice(0, 6).map((s) => ({
    store: s.store_name, location: s.store_location, price: s.price,
    discount_percent: s.discount_percent, final_price: s.final_price, stock: s.stock_status,
  })),
});

const toCard = (g) => ({
  name: g.name,
  category: g.category,
  available_stores: g.available_stores,
  best: g.cheapest || g.stores[0],
});

async function runTool(name, args, customer, cards) {
  if (name === "search_products") {
    const groups = catalog.groupByName(await catalog.findProducts({ search: String(args.query || "").slice(0, 60), limit: 200 })).slice(0, 5);
    groups.forEach((g) => cards.push(toCard(g)));
    return groups.length ? groups.map(slimGroup) : { found: false, note: "No product matched. Try a synonym or English name." };
  }

  if (name === "get_offers") {
    let groups = catalog.groupByName(await catalog.findProducts({ discountedOnly: true }));
    if (args.store_name) {
      const q = catalog.normalizeName(args.store_name);
      groups = groups
        .map((g) => ({ ...g, stores: g.stores.filter((s) => catalog.normalizeName(s.store_name).includes(q)) }))
        .filter((g) => g.stores.length)
        .map((g) => ({ ...g, cheapest: g.stores[0] }));
    }
    groups = groups.sort((a, b) => b.max_discount - a.max_discount).slice(0, 8);
    groups.slice(0, 4).forEach((g) => cards.push(toCard(g)));
    return groups.map(slimGroup);
  }

  if (name === "shopping_list") return catalog.shoppingList(args.items);

  if (name === "get_my_points") {
    const [rows] = await db.query("SELECT points_balance FROM customers WHERE id = ? LIMIT 1", [customer.id]);
    const points = Number(rows[0]?.points_balance) || 0;
    const usable = Math.floor(points / 100) * 100;
    return {
      points, usable_points: usable, discount_value_taka: (usable / 100) * 80,
      rules: "Earn 1 point per 100 Taka paid. Redeem from 100 points, in blocks of 100. 100 points = 80 Taka.",
      points_needed_for_next_100: points >= 100 ? 0 : 100 - points,
    };
  }

  if (name === "get_my_purchases") {
    const list = await catalog.getMyPurchases(customer.id, { limit: args.this_month ? 100 : 5, thisMonthOnly: !!args.this_month });
    const total = list.reduce((a, s) => a + s.payable_amount, 0);
    return {
      count: list.length,
      total_paid: Math.round(total * 100) / 100,
      purchases: list.slice(0, 5).map((s) => ({
        date: String(s.created_at).slice(0, 16), store: s.store_name, paid: s.payable_amount,
        items: s.items.map((i) => `${i.name} x${i.quantity}`).join(", "),
      })),
    };
  }

  if (name === "get_stores") return catalog.getStores();

  return { error: "Unknown tool" };
}

// ---------- Groq ----------
async function groq(messages) {
  const resp = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.GROQ_API_KEY}` },
    body: JSON.stringify({
      model: process.env.GROQ_MODEL || "openai/gpt-oss-20b",
      messages,
      tools: TOOLS.map((t) => ({ type: "function", function: t })),
      tool_choice: "auto",
      temperature: 0.2,
      max_tokens: 700,
    }),
  });
  if (!resp.ok) throw new Error(`Groq ${resp.status}: ${(await resp.text()).slice(0, 200)}`);
  return (await resp.json()).choices?.[0]?.message;
}

const SYSTEM = `You are the shopping assistant of a retail chain, talking to a logged-in loyalty customer.
- Reply in the SAME language/style as the customer (Bengali, English or Banglish). Keep it short and friendly.
- ALWAYS use the tools for prices, stores, offers, points and purchases. Never invent numbers or products.
- Money is BDT, write it like ৳450. Mention the cheapest store first and how much the customer saves.
- If a product is out of stock everywhere, say so and suggest similar in-stock products (search by category).
- Stock is only "in", "low" (few left) or "out". Never give exact stock counts.
- You cannot know restock dates; say the store will restock soon and suggest checking again.
- Never discuss cost price, profit, staff, other customers or anything unrelated to shopping here. Politely refuse.`;

// Keyword fallback when AI is off or fails.
async function fallback(question, cards) {
  const words = question.replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter((w) => w.length > 2);
  for (const w of words) {
    const groups = catalog.groupByName(await catalog.findProducts({ search: w, limit: 100 })).slice(0, 5);
    if (groups.length) {
      groups.forEach((g) => cards.push(toCard(g)));
      return "AI এখন ব্যস্ত, তবে এগুলো পেয়েছি 👇";
    }
  }
  return "AI এখন ব্যস্ত। Product-এর নাম (যেমন Rice) লিখে আবার চেষ্টা করুন।";
}

// POST /api/customers/ai/chat   { question, history?: [{role:'user'|'ai', text}] }
exports.customerAiChat = async (req, res) => {
  const question = String(req.body?.question || "").trim().slice(0, MAX_QUESTION);
  if (!question) return res.status(400).json({ success: false, message: "প্রশ্ন লিখুন।" });

  if (!takeQuota(req.customer.id)) {
    return res.status(429).json({ success: false, message: `আজকের ${DAILY_LIMIT}টা প্রশ্ন শেষ। কাল আবার চেষ্টা করুন।` });
  }

  const cards = [];
  try {
    if (!process.env.GROQ_API_KEY) throw new Error("GROQ_API_KEY missing");

    const history = (Array.isArray(req.body.history) ? req.body.history : [])
      .slice(-6)
      .map((m) => ({ role: m.role === "user" ? "user" : "assistant", content: String(m.text || "").slice(0, 500) }));

    const messages = [{ role: "system", content: SYSTEM }, ...history, { role: "user", content: question }];

    for (let round = 0; round < 4; round += 1) {
      const msg = await groq(messages);
      if (!msg) break;

      if (!msg.tool_calls?.length) {
        return res.json({ success: true, answer: msg.content || "দুঃখিত, উত্তর দিতে পারলাম না।", cards: dedupe(cards) });
      }

      messages.push({ role: "assistant", content: msg.content || "", tool_calls: msg.tool_calls });
      for (const call of msg.tool_calls) {
        let args = {};
        try { args = JSON.parse(call.function.arguments || "{}"); } catch (e) { /* ignore */ }
        // eslint-disable-next-line no-await-in-loop
        const result = await runTool(call.function.name, args, req.customer, cards);
        messages.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify(result).slice(0, 6000) });
      }
    }
    throw new Error("Too many tool rounds");
  } catch (error) {
    console.error("Customer AI Error:", error.message);
    const answer = await fallback(question, cards).catch(() => "দুঃখিত, এখন উত্তর দিতে পারছি না।");
    return res.json({ success: true, answer, cards: dedupe(cards), fallback: true });
  }
};

function dedupe(cards) {
  const seen = new Set();
  return cards.filter((c) => {
    const k = catalog.normalizeName(c.name);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  }).slice(0, 6);
}