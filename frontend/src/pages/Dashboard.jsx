import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import axios from "axios";
import API_BASE_URL from "../apiConfig";
import "./Dashboard.css";

const API = axios.create({
  baseURL: API_BASE_URL,
});

API.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");

    if (token) {
      config.headers.Authorization =
        `Bearer ${token}`;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

const EMPTY_STATS = {
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
};

function Dashboard() {
  const currentUser = useMemo(() => {
    try {
      return JSON.parse(
        localStorage.getItem("user") || "{}"
      );
    } catch (error) {
      console.error(
        "Invalid user information:",
        error
      );

      return {};
    }
  }, []);

  const isViewer =
    currentUser.role === "Viewer";

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const [warning, setWarning] =
    useState("");

  const [stats, setStats] =
    useState(EMPTY_STATS);

  const [trend, setTrend] =
    useState([]);

  const [storeBreakdown, setStoreBreakdown] =
    useState([]);

  const [
    totalDamagedAllStores,
    setTotalDamagedAllStores,
  ] = useState(0);

  const [
    totalDamagedValueAllStores,
    setTotalDamagedValueAllStores,
  ] = useState(0);

  const [
    todayDamagedQty,
    setTodayDamagedQty,
  ] = useState(0);

  const [
    monthSummary,
    setMonthSummary,
  ] = useState(null);

  const getResultData = (result) => {
    if (
      result &&
      result.status === "fulfilled"
    ) {
      return result.value.data;
    }

    return null;
  };

  const loadDashboard = useCallback(
    async () => {
      try {
        setLoading(true);
        setError("");
        setWarning("");

        const results =
          await Promise.allSettled([
            API.get("/api/dashboard/stats"),
            API.get("/api/dashboard/trend"),
            API.get(
              "/api/dashboard/store-breakdown"
            ),
            API.get(
              "/api/dashboard/today-damaged"
            ),
            API.get("/api/reports/monthly"),
          ]);

        const statsData =
          getResultData(results[0]);

        const trendData =
          getResultData(results[1]);

        const breakdownData =
          getResultData(results[2]);

        const damagedData =
          getResultData(results[3]);

        const monthlyData =
          getResultData(results[4]);

        if (!statsData) {
          throw new Error(
            "Dashboard statistics could not be loaded."
          );
        }

        setStats({
          total_sales:
            Number(
              statsData.total_sales
            ) || 0,

          today_sales:
            Number(
              statsData.today_sales
            ) || 0,

          today_profit:
            Number(
              statsData.today_profit
            ) || 0,

          today_damaged_loss:
            Number(
              statsData.today_damaged_loss
            ) || 0,

          net_profit:
            Number(
              statsData.net_profit
            ) || 0,

          inventory_value:
            Number(
              statsData.inventory_value
            ) || 0,

          total_orders:
            Number(
              statsData.total_orders
            ) || 0,

          total_products:
            Number(
              statsData.total_products
            ) || 0,

          total_stores:
            Number(
              statsData.total_stores
            ) || 0,

          total_users:
            Number(
              statsData.total_users
            ) || 0,

          low_stock:
            Number(
              statsData.low_stock
            ) || 0,

          out_stock:
            Number(
              statsData.out_stock
            ) || 0,

          payment_summary:
            Array.isArray(
              statsData.payment_summary
            )
              ? statsData.payment_summary
              : [],

          recent_sales:
            Array.isArray(
              statsData.recent_sales
            )
              ? statsData.recent_sales
              : [],

          top_products:
            Array.isArray(
              statsData.top_products
            )
              ? statsData.top_products
              : [],
        });

        setTrend(
          Array.isArray(trendData)
            ? trendData
            : []
        );

        setStoreBreakdown(
          Array.isArray(
            breakdownData?.stores
          )
            ? breakdownData.stores
            : []
        );

        setTotalDamagedAllStores(
          Number(
            breakdownData
              ?.total_damaged_all_stores
          ) || 0
        );

        setTotalDamagedValueAllStores(
          Number(
            breakdownData
              ?.total_damaged_value_all_stores
          ) || 0
        );

        setTodayDamagedQty(
          Number(
            damagedData
              ?.today_damaged_qty
          ) || 0
        );

        setMonthSummary(
          monthlyData || null
        );

        const failedOptionalRequests =
          results
            .slice(1)
            .filter(
              (result) =>
                result.status === "rejected"
            );

        if (
          failedOptionalRequests.length > 0
        ) {
          setWarning(
            "Some dashboard sections could not be loaded. The available information is shown below."
          );
        }
      } catch (err) {
        console.error(
          "Dashboard loading error:",
          err
        );

        setError(
          err.response?.data?.message ||
            err.message ||
            "Failed to load dashboard."
        );
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const statCards = useMemo(
    () => [
      {
        title: "Total Sales",
        value:
          `৳ ${Number(
            stats.total_sales
          ).toFixed(2)}`,
        tone: "success",
        icon: "💰",
      },
      {
        title: "Today's Sales",
        value:
          `৳ ${Number(
            stats.today_sales
          ).toFixed(2)}`,
        tone: "primary",
        icon: "📅",
      },
      {
        title: "Today's Profit",
        value:
          `৳ ${Number(
            stats.today_profit
          ).toFixed(2)}`,
        tone: "sky",
        icon: "📈",
      },
      {
        title: "Net Profit",
        value:
          `৳ ${Number(
            stats.net_profit
          ).toFixed(2)}`,
        tone: "success",
        icon: "💵",
      },
      {
        title: "Today's Damaged",
        value:
          `৳ ${Number(
            stats.today_damaged_loss
          ).toFixed(2)} (${todayDamagedQty} pcs)`,
        tone: "danger",
        icon: "🗑️",
      },
      {
        title: "Inventory Value",
        value:
          `৳ ${Number(
            stats.inventory_value
          ).toFixed(2)}`,
        tone: "orange",
        icon: "📦",
      },
      {
        title: "Products",
        value: stats.total_products,
        tone: "violet",
        icon: "📦",
      },
      {
        title: "Orders",
        value: stats.total_orders,
        tone: "sky",
        icon: "🧾",
      },
      {
        title: "Stores",
        value: stats.total_stores,
        tone: "primary",
        icon: "🏪",
      },
      {
        title: "Users",
        value: stats.total_users,
        tone: "warning",
        icon: "👥",
      },
      {
        title: "Low Stock",
        value: stats.low_stock,
        tone: "warning",
        icon: "⚠️",
      },
      {
        title: "Out of Stock",
        value: stats.out_stock,
        tone: "danger",
        icon: "❌",
      },
    ],
    [stats, todayDamagedQty]
  );

  if (loading) {
    return (
      <div className="dashboard-loader-wrap">
        <div className="dashboard-loader-card">
          <div className="dashboard-spinner" />

          <p className="dashboard-loader-text">
            Loading Dashboard...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="dashboard-page">
        <div className="dashboard-state-card">
          <div className="dashboard-state-icon danger">
            !
          </div>

          <h2>{error}</h2>

          <p>
            Please try again after checking your
            network or login status.
          </p>

          <button
            type="button"
            className="dashboard-action-btn"
            onClick={loadDashboard}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-page">
      <div className="dashboard-shell">
        {isViewer && (
          <div
            style={{
              padding: "12px 14px",
              marginBottom: "16px",
              border: "1px solid #bfdbfe",
              borderRadius: "10px",
              background: "#eff6ff",
              color: "#1e40af",
              fontWeight: 600,
            }}
          >
            👁 Demo Viewer mode: Dashboard information
            is read-only.
          </div>
        )}

        {warning && (
          <div
            style={{
              padding: "12px 14px",
              marginBottom: "16px",
              border: "1px solid #fde68a",
              borderRadius: "10px",
              background: "#fffbeb",
              color: "#92400e",
            }}
          >
            {warning}
          </div>
        )}

        <div className="dashboard-header">
          <div>
            <p className="dashboard-eyebrow">
              Business Overview
            </p>

            <h1 className="dashboard-title">
              Cloud POS Dashboard
            </h1>

            <p className="dashboard-subtitle">
              Monitor Sales, Profit, Inventory and
              Business Performance.
            </p>
          </div>

          <div className="dashboard-header-actions">
            <div className="dashboard-badge">
              <span className="badge-dot" />
              Live
            </div>

            <button
              type="button"
              className="dashboard-refresh-btn"
              onClick={loadDashboard}
            >
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
              ? `${new Date(
                  monthSummary.year,
                  monthSummary.month - 1
                ).toLocaleDateString(
                  "en-US",
                  {
                    month: "long",
                    year: "numeric",
                  }
                )} — full printable report available on the Reports page`
              : "No monthly information available."
          }
        >
          {monthSummary ? (
            <div className="month-summary-grid">
              <div className="month-summary-item income">
                <span>Income (Sales)</span>

                <strong>
                  ৳{" "}
                  {Number(
                    monthSummary.total_sales
                  ).toFixed(2)}
                </strong>

                <small>
                  {Number(
                    monthSummary.total_orders
                  ) || 0}{" "}
                  orders
                </small>
              </div>

              <div className="month-summary-item expense">
                <span>Expense (Damaged)</span>

                <strong>
                  ৳{" "}
                  {Number(
                    monthSummary
                      .total_damaged_value
                  ).toFixed(2)}
                </strong>

                <small>
                  {Number(
                    monthSummary
                      .total_damaged_qty
                  ) || 0}{" "}
                  pcs
                </small>
              </div>

              <div
                className={`month-summary-item net ${
                  Number(
                    monthSummary.net_amount
                  ) >= 0
                    ? "positive"
                    : "negative"
                }`}
              >
                <span>Net Amount</span>

                <strong>
                  ৳{" "}
                  {Number(
                    monthSummary.net_amount
                  ).toFixed(2)}
                </strong>

                <small>
                  {Number(
                    monthSummary.net_amount
                  ) >= 0
                    ? "Profit"
                    : "Loss"}
                </small>
              </div>
            </div>
          ) : (
            <p className="empty-cell">
              No monthly data
            </p>
          )}
        </Section>

        <Section
          title="Sales Trend"
          subtitle="Revenue over the last 7 days"
        >
          <TrendChart data={trend} />
        </Section>

        <Section
          title="Store Sales Comparison"
          subtitle="Store revenue comparison"
        >
          <StoreSalesChart
            data={storeBreakdown}
          />
        </Section>

        <Section
          title="Store-wise Performance"
          subtitle="Products, revenue and damaged stock per store"
        >
          <div className="store-breakdown-grid">
            {storeBreakdown.length === 0 ? (
              <p className="store-breakdown-empty">
                No store breakdown available.
              </p>
            ) : (
              storeBreakdown.map((store) => (
                <div
                  key={store.store_id}
                  className="store-breakdown-card"
                >
                  <div className="store-breakdown-top">
                    <span className="store-breakdown-name">
                      🏪 {store.store_name}
                    </span>

                    <span className="store-breakdown-id">
                      #{store.store_id}
                    </span>
                  </div>

                  <div className="store-breakdown-stats">
                    <div className="store-breakdown-stat">
                      <span>Products</span>

                      <strong>
                        {Number(
                          store.product_count
                        ) || 0}
                      </strong>
                    </div>

                    <div className="store-breakdown-stat">
                      <span>Orders</span>

                      <strong>
                        {Number(
                          store.total_orders
                        ) || 0}
                      </strong>
                    </div>

                    <div className="store-breakdown-stat damaged">
                      <span>Damaged</span>

                      <strong>
                        {Number(
                          store.damaged_count
                        ) || 0}{" "}
                        pcs · ৳{" "}
                        {Number(
                          store.damaged_value
                        ).toFixed(2)}
                      </strong>
                    </div>

                    <div className="store-breakdown-stat revenue">
                      <span>Revenue</span>

                      <strong>
                        ৳{" "}
                        {Number(
                          store.total_revenue
                        ).toFixed(2)}
                      </strong>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          <p className="store-breakdown-total-damaged">
            🗑️ All Damaged Products:{" "}
            <strong>
              {totalDamagedAllStores} pcs
            </strong>{" "}
            — ৳{" "}
            <strong>
              {Number(
                totalDamagedValueAllStores
              ).toFixed(2)}
            </strong>
          </p>
        </Section>

        <Section
          title="Payment Summary"
          subtitle="Sales by payment method"
        >
          <div className="table-wrap">
            <table className="dashboard-table">
              <thead>
                <tr>
                  <th>Payment Method</th>

                  <th className="text-right">
                    Amount
                  </th>
                </tr>
              </thead>

              <tbody>
                {stats.payment_summary.length === 0 ? (
                  <tr>
                    <td
                      colSpan="2"
                      className="empty-cell"
                    >
                      No Data
                    </td>
                  </tr>
                ) : (
                  stats.payment_summary.map(
                    (item, index) => (
                      <tr key={index}>
                        <td>
                          {item.payment_method}
                        </td>

                        <td className="text-right text-bold">
                          ৳{" "}
                          {Number(
                            item.amount
                          ).toFixed(2)}
                        </td>
                      </tr>
                    )
                  )
                )}
              </tbody>
            </table>
          </div>
        </Section>

        <div className="dashboard-bottom-grid">
          <Section
            title="Recent Sales"
            subtitle="Latest Transactions"
          >
            <div className="table-wrap">
              <table className="dashboard-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Customer</th>

                    <th className="text-right">
                      Amount
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {stats.recent_sales.length === 0 ? (
                    <tr>
                      <td
                        colSpan="3"
                        className="empty-cell"
                      >
                        No Sales
                      </td>
                    </tr>
                  ) : (
                    stats.recent_sales.map(
                      (sale) => (
                        <tr key={sale.id}>
                          <td>
                            #{sale.id}
                          </td>

                          <td>
                            {sale.customer_phone ||
                              "Walk-in"}
                          </td>

                          <td className="text-right text-bold">
                            ৳{" "}
                            {Number(
                              sale.payable_amount
                            ).toFixed(2)}
                          </td>
                        </tr>
                      )
                    )
                  )}
                </tbody>
              </table>
            </div>
          </Section>

          <Section
            title="Top Selling Products"
            subtitle="Best Selling Items"
          >
            <div className="table-wrap">
              <table className="dashboard-table">
                <thead>
                  <tr>
                    <th>Product</th>

                    <th className="text-right">
                      Sold Qty
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {stats.top_products.length === 0 ? (
                    <tr>
                      <td
                        colSpan="2"
                        className="empty-cell"
                      >
                        No Products
                      </td>
                    </tr>
                  ) : (
                    stats.top_products.map(
                      (item, index) => (
                        <tr key={index}>
                          <td>{item.name}</td>

                          <td className="text-right text-bold">
                            {Number(
                              item.total_qty
                            ) || 0}
                          </td>
                        </tr>
                      )
                    )
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

function Section({
  title,
  subtitle,
  children,
}) {
  return (
    <section className="dashboard-section-card">
      <div className="dashboard-section-header">
        <div>
          <h2 className="dashboard-section-title">
            {title}
          </h2>

          {subtitle && (
            <p className="dashboard-section-subtitle">
              {subtitle}
            </p>
          )}
        </div>
      </div>

      {children}
    </section>
  );
}

function StatCard({
  title,
  value,
  tone,
  icon,
}) {
  return (
    <div className={`stat-card tone-${tone}`}>
      <div className="stat-top">
        <div
          className={`stat-icon-box tone-${tone}`}
        >
          {icon}
        </div>

        <span className="stat-label">
          {title}
        </span>
      </div>

      <h3 className="stat-value">
        {value}
      </h3>
    </div>
  );
}

function TrendChart({ data }) {
  if (!data || data.length === 0) {
    return (
      <p className="trend-empty">
        No trend data available.
      </p>
    );
  }

  const maxValue = Math.max(
    ...data.map(
      (item) =>
        Number(item.total_sales) || 0
    ),
    1
  );

  const chartHeight = 180;
  const barWidth = 100 / data.length;

  const parseLocalDate = (dateString) => {
    const [year, month, day] =
      String(dateString)
        .split("-")
        .map(Number);

    return new Date(
      year,
      month - 1,
      day
    );
  };

  const dayLabel = (dateString) => {
    return parseLocalDate(
      dateString
    ).toLocaleDateString(
      "en-US",
      {
        weekday: "short",
      }
    );
  };

  const dateLabel = (dateString) => {
    return parseLocalDate(
      dateString
    ).toLocaleDateString(
      "en-GB",
      {
        day: "2-digit",
        month: "short",
      }
    );
  };

  return (
    <div className="trend-chart-wrap">
      <svg
        className="trend-chart-svg"
        viewBox={`0 0 100 ${chartHeight + 40}`}
        preserveAspectRatio="none"
      >
        {[0, 0.25, 0.5, 0.75, 1].map(
          (fraction) => (
            <line
              key={fraction}
              x1="0"
              x2="100"
              y1={
                chartHeight -
                chartHeight * fraction +
                10
              }
              y2={
                chartHeight -
                chartHeight * fraction +
                10
              }
              stroke="#e2e8f0"
              strokeWidth="0.3"
            />
          )
        )}

        {data.map((item, index) => {
          const saleAmount =
            Number(item.total_sales) || 0;

          const barHeight =
            (saleAmount / maxValue) *
            (chartHeight - 20);

          const x =
            index * barWidth +
            barWidth * 0.2;

          const width =
            barWidth * 0.6;

          const y =
            chartHeight -
            barHeight +
            10;

          return (
            <g key={item.date}>
              <rect
                x={x}
                y={y}
                width={width}
                height={barHeight}
                rx="1.2"
                className="trend-bar"
              >
                <title>
                  {dateLabel(item.date)}: ৳{" "}
                  {saleAmount.toFixed(2)} (
                  {Number(
                    item.order_count
                  ) || 0}{" "}
                  orders)
                </title>
              </rect>
            </g>
          );
        })}
      </svg>

      <div className="trend-labels">
        {data.map((item) => (
          <div
            key={item.date}
            className="trend-label-item"
          >
            <span className="trend-label-day">
              {dayLabel(item.date)}
            </span>

            <span className="trend-label-date">
              {dateLabel(item.date)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function StoreSalesChart({ data }) {
  if (!data || data.length === 0) {
    return (
      <p className="trend-empty">
        No store data available.
      </p>
    );
  }

  const sorted = [...data].sort(
    (first, second) =>
      Number(second.total_revenue) -
      Number(first.total_revenue)
  );

  const maxValue = Math.max(
    ...sorted.map(
      (store) =>
        Number(store.total_revenue) || 0
    ),
    1
  );

  return (
    <div className="store-chart-wrap">
      {sorted.map((store, index) => {
        const revenue =
          Number(
            store.total_revenue
          ) || 0;

        const widthPercentage =
          (revenue / maxValue) * 100;

        return (
          <div
            key={store.store_id}
            className="store-chart-row"
          >
            <div className="store-chart-label">
              <span className="store-chart-rank">
                #{index + 1}
              </span>

              <span className="store-chart-name">
                {store.store_name}
              </span>
            </div>

            <div className="store-chart-track">
              <div
                className={`store-chart-bar ${
                  index === 0 ? "top" : ""
                }`}
                style={{
                  width: `${widthPercentage}%`,
                }}
              />
            </div>

            <div className="store-chart-value">
              ৳ {revenue.toFixed(2)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default Dashboard;