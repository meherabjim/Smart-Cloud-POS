import React, { useEffect, useMemo, useCallback, useState } from "react";
import axios from "axios";
import "./Dashboard.css";

const API = axios.create({
  baseURL: "https://smart-cloud-pos.onrender.com",
});

API.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [stats, setStats] = useState({
    total_sales: 0,
    today_sales: 0,
    today_profit: 0,
    today_damaged_loss: 0,
    net_profit: 0,
    inventory_value: 0,
    total_orders: 0,
    total_products: 0,
    total_stores: 0,
    total_users: 0,
    low_stock: 0,
    out_stock: 0,
    payment_summary: [],
    recent_sales: [],
    top_products: [],
  });

  const [trend, setTrend] = useState([]);
  const [storeBreakdown, setStoreBreakdown] = useState([]);
  const [totalDamagedAllStores, setTotalDamagedAllStores] = useState(0);
  const [totalDamagedValueAllStores, setTotalDamagedValueAllStores] = useState(0);
  const [todayDamagedQty, setTodayDamagedQty] = useState(0);
  const [monthSummary, setMonthSummary] = useState(null);

  const loadDashboard = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const [statsRes, trendRes, breakdownRes, todayDamagedRes, monthlyRes] =
        await Promise.all([
          API.get("/api/dashboard/stats"),
          API.get("/api/dashboard/trend"),
          API.get("/api/dashboard/store-breakdown"),
          API.get("/api/dashboard/today-damaged"),
          API.get("/api/reports/monthly"),
        ]);

      setStats({
        total_sales: statsRes.data.total_sales || 0,
        today_sales: statsRes.data.today_sales || 0,
        today_profit: statsRes.data.today_profit || 0,
        today_damaged_loss: statsRes.data.today_damaged_loss || 0,
        net_profit: statsRes.data.net_profit || 0,
        inventory_value: statsRes.data.inventory_value || 0,
        total_orders: statsRes.data.total_orders || 0,
        total_products: statsRes.data.total_products || 0,
        total_stores: statsRes.data.total_stores || 0,
        total_users: statsRes.data.total_users || 0,
        low_stock: statsRes.data.low_stock || 0,
        out_stock: statsRes.data.out_stock || 0,
        payment_summary: statsRes.data.payment_summary || [],
        recent_sales: statsRes.data.recent_sales || [],
        top_products: statsRes.data.top_products || [],
      });

      setTrend(trendRes.data || []);
      setStoreBreakdown(breakdownRes.data?.stores || []);
      setTotalDamagedAllStores(breakdownRes.data?.total_damaged_all_stores || 0);
      setTotalDamagedValueAllStores(
        breakdownRes.data?.total_damaged_value_all_stores || 0
      );
      setTodayDamagedQty(todayDamagedRes.data?.today_damaged_qty || 0);
      setMonthSummary(monthlyRes.data || null);
    } catch (err) {
      console.error(err);
      setError("Failed to load dashboard.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const statCards = useMemo(
    () => [
      { title: "Total Sales", value: `à§³ ${Number(stats.total_sales).toFixed(2)}`, tone: "success", icon: "ðŸ’°" },
      { title: "Today's Sales", value: `à§³ ${Number(stats.today_sales).toFixed(2)}`, tone: "primary", icon: "ðŸ“…" },
      { title: "Today's Profit", value: `à§³ ${Number(stats.today_profit).toFixed(2)}`, tone: "sky", icon: "ðŸ“ˆ" },
      { title: "Net Profit", value: `à§³ ${Number(stats.net_profit).toFixed(2)}`, tone: "success", icon: "ðŸ’µ" },
      {
        title: "Today's Damaged",
        value: `à§³ ${Number(stats.today_damaged_loss).toFixed(2)} (${todayDamagedQty} pcs)`,
        tone: "danger",
        icon: "ðŸ—‘ï¸",
      },
      { title: "Inventory Value", value: `à§³ ${Number(stats.inventory_value).toFixed(2)}`, tone: "orange", icon: "ðŸ“¦" },
      { title: "Products", value: stats.total_products, tone: "violet", icon: "ðŸ“¦" },
      { title: "Orders", value: stats.total_orders, tone: "sky", icon: "ðŸ§¾" },
      { title: "Stores", value: stats.total_stores, tone: "primary", icon: "ðŸª" },
      { title: "Users", value: stats.total_users, tone: "warning", icon: "ðŸ‘¥" },
      { title: "Low Stock", value: stats.low_stock, tone: "warning", icon: "âš ï¸" },
      { title: "Out of Stock", value: stats.out_stock, tone: "danger", icon: "âŒ" },
    ],
    [stats, todayDamagedQty]
  );

  if (loading) {
    return (
      <div className="dashboard-loader-wrap">
        <div className="dashboard-loader-card">
          <div className="dashboard-spinner"></div>
          <p className="dashboard-loader-text">Loading Dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="dashboard-page">
        <div className="dashboard-state-card">
          <div className="dashboard-state-icon danger">!</div>
          <h2>{error}</h2>
          <p>Please try again after checking your network or login status.</p>
          <button className="dashboard-action-btn" onClick={loadDashboard}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-page">
      <div className="dashboard-shell">
        <div className="dashboard-header">
          <div>
            <p className="dashboard-eyebrow">Business Overview</p>
            <h1 className="dashboard-title">Cloud POS Dashboard</h1>
            <p className="dashboard-subtitle">
              Monitor Sales, Profit, Inventory and Business Performance.
            </p>
          </div>

          <div className="dashboard-header-actions">
            <div className="dashboard-badge">
              <span className="badge-dot"></span>
              Live
            </div>

            <button className="dashboard-refresh-btn" onClick={loadDashboard}>
              Refresh
            </button>
          </div>
        </div>

        <div className="dashboard-stats-grid">
          {statCards.map((card) => (
            <StatCard
              key={card.title}
              title={card.title}
              value={card.value}
              tone={card.tone}
              icon={card.icon}
            />
          ))}
        </div>

        <Section
          title="This Month"
          subtitle={
            monthSummary
              ? `${new Date(monthSummary.year, monthSummary.month - 1).toLocaleDateString("en-US", { month: "long", year: "numeric" })} â€” full printable report available on the Reports page`
              : "Loading..."
          }
        >
          {monthSummary ? (
            <div className="month-summary-grid">
              <div className="month-summary-item income">
                <span>Income (Sales)</span>
                <strong>à§³ {Number(monthSummary.total_sales).toFixed(2)}</strong>
                <small>{monthSummary.total_orders} orders</small>
              </div>
              <div className="month-summary-item expense">
                <span>Expense (Damaged)</span>
                <strong>à§³ {Number(monthSummary.total_damaged_value).toFixed(2)}</strong>
                <small>{monthSummary.total_damaged_qty} pcs</small>
              </div>
              <div
                className={`month-summary-item net ${
                  monthSummary.net_amount >= 0 ? "positive" : "negative"
                }`}
              >
                <span>Net Amount</span>
                <strong>à§³ {Number(monthSummary.net_amount).toFixed(2)}</strong>
                <small>{monthSummary.net_amount >= 0 ? "Profit" : "Loss"}</small>
              </div>
            </div>
          ) : (
            <p className="empty-cell">No data</p>
          )}
        </Section>

        <Section title="Sales Trend" subtitle="Revenue over the last 7 days">
          <TrendChart data={trend} />
        </Section>

        <Section title="Store Sales Comparison" subtitle="Which store is selling more, at a glance">
          <StoreSalesChart data={storeBreakdown} />
        </Section>

        <Section title="Store-wise Performance" subtitle="Products, revenue, and damaged stock per store">
          <div className="store-breakdown-grid">
            {storeBreakdown.length === 0 ? (
              <p className="store-breakdown-empty">No stores found.</p>
            ) : (
              storeBreakdown.map((s) => (
                <div key={s.store_id} className="store-breakdown-card">
                  <div className="store-breakdown-top">
                    <span className="store-breakdown-name">ðŸª {s.store_name}</span>
                    <span className="store-breakdown-id">#{s.store_id}</span>
                  </div>

                  <div className="store-breakdown-stats">
                    <div className="store-breakdown-stat">
                      <span>Products</span>
                      <strong>{s.product_count}</strong>
                    </div>
                    <div className="store-breakdown-stat">
                      <span>Orders</span>
                      <strong>{s.total_orders}</strong>
                    </div>
                    <div className="store-breakdown-stat damaged">
                      <span>Damaged</span>
                      <strong>
                        {s.damaged_count} pcs Â· à§³ {Number(s.damaged_value).toFixed(2)}
                      </strong>
                    </div>
                    <div className="store-breakdown-stat revenue">
                      <span>Revenue</span>
                      <strong>à§³ {Number(s.total_revenue).toFixed(2)}</strong>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          <p className="store-breakdown-total-damaged">
            ðŸ—‘ï¸ All Damaged Products: <strong>{totalDamagedAllStores} pcs</strong> â€” à§³{" "}
            <strong>{totalDamagedValueAllStores.toFixed(2)}</strong>
          </p>
        </Section>

        <Section title="Payment Summary" subtitle="Sales by payment method">
          <div className="table-wrap">
            <table className="dashboard-table">
              <thead>
                <tr>
                  <th>Payment Method</th>
                  <th className="text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {stats.payment_summary.length === 0 ? (
                  <tr>
                    <td colSpan="2" className="empty-cell">
                      No Data
                    </td>
                  </tr>
                ) : (
                  stats.payment_summary.map((item, index) => (
                    <tr key={index}>
                      <td>{item.payment_method}</td>
                      <td className="text-right text-bold">
                        à§³ {Number(item.amount).toFixed(2)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Section>

        <div className="dashboard-bottom-grid">
          <Section title="Recent Sales" subtitle="Latest Transactions">
            <div className="table-wrap">
              <table className="dashboard-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Customer</th>
                    <th className="text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.recent_sales.length === 0 ? (
                    <tr>
                      <td colSpan="3" className="empty-cell">
                        No Sales
                      </td>
                    </tr>
                  ) : (
                    stats.recent_sales.map((sale) => (
                      <tr key={sale.id}>
                        <td>#{sale.id}</td>
                        <td>{sale.customer_phone || "Walk-in"}</td>
                        <td className="text-right text-bold">
                          à§³ {Number(sale.payable_amount).toFixed(2)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Section>

          <Section title="Top Selling Products" subtitle="Best Selling Items">
            <div className="table-wrap">
              <table className="dashboard-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th className="text-right">Sold Qty</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.top_products.length === 0 ? (
                    <tr>
                      <td colSpan="2" className="empty-cell">
                        No Products
                      </td>
                    </tr>
                  ) : (
                    stats.top_products.map((item, index) => (
                      <tr key={index}>
                        <td>{item.name}</td>
                        <td className="text-right text-bold">{item.total_qty}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Section>
        </div>
      </div>
    </div>
  );
}

function Section({ title, subtitle, children }) {
  return (
    <section className="dashboard-section-card">
      <div className="dashboard-section-header">
        <div>
          <h2 className="dashboard-section-title">{title}</h2>
          {subtitle && <p className="dashboard-section-subtitle">{subtitle}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

function StatCard({ title, value, tone, icon }) {
  return (
    <div className={`stat-card tone-${tone}`}>
      <div className="stat-top">
        <div className={`stat-icon-box tone-${tone}`}>{icon}</div>
        <span className="stat-label">{title}</span>
      </div>
      <h3 className="stat-value">{value}</h3>
    </div>
  );
}

// à¦¹à¦¾à¦²à¦•à¦¾, à¦¨à¦¿à¦œà¦¸à§à¦¬ SVG bar chart â€” à¦•à§‹à¦¨à§‹ external charting library à¦²à¦¾à¦—à¦¬à§‡ à¦¨à¦¾
function TrendChart({ data }) {
  if (!data || data.length === 0) {
    return <p className="trend-empty">No trend data available.</p>;
  }

  const maxValue = Math.max(...data.map((d) => d.total_sales), 1);
  const chartHeight = 180;
  const barWidth = 100 / data.length;

  // "YYYY-MM-DD" à¦¸à§à¦Ÿà§à¦°à¦¿à¦‚ à¦¸à¦°à¦¾à¦¸à¦°à¦¿ Date()-à¦ à¦¦à¦¿à¦²à§‡ à¦¸à§‡à¦Ÿà¦¾ UTC à¦¹à¦¿à¦¸à§‡à¦¬à§‡ à¦§à¦°à§‡ à¦¨à§‡à¦¯à¦¼, à¦¯à§‡à¦Ÿà¦¾
  // à¦¬à¦¾à¦‚à¦²à¦¾à¦¦à§‡à¦¶ à¦¸à¦®à¦¯à¦¼à§‡ à¦­à§à¦² à¦¦à¦¿à¦¨ à¦¦à§‡à¦–à¦¾à¦¤à§‡ à¦ªà¦¾à¦°à§‡à¥¤ à¦¤à¦¾à¦‡ à¦®à§à¦¯à¦¾à¦¨à§à¦¯à¦¼à¦¾à¦²à¦¿ local date à¦¬à¦¾à¦¨à¦¾à¦¨à§‹ à¦¹à¦šà§à¦›à§‡à¥¤
  const parseLocalDate = (dateStr) => {
    const [y, m, d] = dateStr.split("-").map(Number);
    return new Date(y, m - 1, d);
  };

  const dayLabel = (dateStr) => {
    const d = parseLocalDate(dateStr);
    return d.toLocaleDateString("en-US", { weekday: "short" });
  };

  const dateLabel = (dateStr) => {
    const d = parseLocalDate(dateStr);
    return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
  };

  return (
    <div className="trend-chart-wrap">
      <svg
        className="trend-chart-svg"
        viewBox={`0 0 100 ${chartHeight + 40}`}
        preserveAspectRatio="none"
      >
        {[0, 0.25, 0.5, 0.75, 1].map((f) => (
          <line
            key={f}
            x1="0"
            x2="100"
            y1={chartHeight - chartHeight * f + 10}
            y2={chartHeight - chartHeight * f + 10}
            stroke="#e2e8f0"
            strokeWidth="0.3"
          />
        ))}

        {data.map((d, i) => {
          const barHeight = (d.total_sales / maxValue) * (chartHeight - 20);
          const x = i * barWidth + barWidth * 0.2;
          const width = barWidth * 0.6;
          const y = chartHeight - barHeight + 10;

          return (
            <g key={d.date}>
              <rect
                x={x}
                y={y}
                width={width}
                height={barHeight}
                rx="1.2"
                className="trend-bar"
              >
                <title>
                  {dateLabel(d.date)}: à§³ {d.total_sales.toFixed(2)} ({d.order_count} orders)
                </title>
              </rect>
            </g>
          );
        })}
      </svg>

      <div className="trend-labels">
        {data.map((d) => (
          <div key={d.date} className="trend-label-item">
            <span className="trend-label-day">{dayLabel(d.date)}</span>
            <span className="trend-label-date">{dateLabel(d.date)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Store-wise revenue comparison â€” horizontal bars, sorted highest to lowest,
// top performer gets a gold highlight so it's obvious at a glance.
function StoreSalesChart({ data }) {
  if (!data || data.length === 0) {
    return <p className="trend-empty">No store data available.</p>;
  }

  const sorted = [...data].sort((a, b) => b.total_revenue - a.total_revenue);
  const maxValue = Math.max(...sorted.map((s) => s.total_revenue), 1);

  return (
    <div className="store-chart-wrap">
      {sorted.map((s, index) => {
        const widthPct = (s.total_revenue / maxValue) * 100;
        return (
          <div key={s.store_id} className="store-chart-row">
            <div className="store-chart-label">
              <span className="store-chart-rank">#{index + 1}</span>
              <span className="store-chart-name">{s.store_name}</span>
            </div>

            <div className="store-chart-track">
              <div
                className={`store-chart-bar ${index === 0 ? "top" : ""}`}
                style={{ width: `${widthPct}%` }}
              />
            </div>

            <div className="store-chart-value">
              à§³ {Number(s.total_revenue).toFixed(2)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default Dashboard;

