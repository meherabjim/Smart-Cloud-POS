import React, { useState, useEffect, useCallback, useMemo } from "react";
import axios from "axios";
import "./Reports.css";

const api = axios.create({
  baseURL: "https://smart-cloud-pos.onrender.com/api",
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function Reports() {
  const activeStoreId = Number(localStorage.getItem("activeStoreId")) || 1;

  const [reportData, setReportData] = useState({
    total_sales: 0,
    total_orders: 0,
    cash_sales: 0,
    bkash_sales: 0,
    card_sales: 0,
  });

  const [viewState, setViewState] = useState("loading");
  const [errorMessage, setErrorMessage] = useState("");

  // ---- Monthly income/expense report ----
  const now = useMemo(() => new Date(), []);
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [monthly, setMonthly] = useState(null);
  const [monthlyLoading, setMonthlyLoading] = useState(true);
  const [monthlyError, setMonthlyError] = useState("");

  const fetchReport = useCallback(async () => {
    try {
      setViewState("loading");
      setErrorMessage("");

      const res = await api.get(`/reports/summary?store_id=${activeStoreId}`);

      setReportData({
        total_sales: Number(res.data.total_sales) || 0,
        total_orders: Number(res.data.total_orders) || 0,
        cash_sales: Number(res.data.cash_sales) || 0,
        bkash_sales: Number(res.data.bkash_sales) || 0,
        card_sales: Number(res.data.card_sales) || 0,
      });

      setViewState("success");
    } catch (err) {
      console.error("Report load error:", err);
      const message =
        err?.response?.data?.message || "Failed to load report data";
      setErrorMessage(message);
      setViewState("error");
    }
  }, [activeStoreId]);

  const fetchMonthly = useCallback(async () => {
    try {
      setMonthlyLoading(true);
      setMonthlyError("");

      const res = await api.get(
        `/reports/monthly?store_id=${activeStoreId}&year=${selectedYear}&month=${selectedMonth}`
      );

      setMonthly(res.data);
    } catch (err) {
      console.error("Monthly report load error:", err);
      setMonthlyError(
        err?.response?.data?.message || "Failed to load monthly report"
      );
    } finally {
      setMonthlyLoading(false);
    }
  }, [activeStoreId, selectedYear, selectedMonth]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  useEffect(() => {
    fetchMonthly();
  }, [fetchMonthly]);

  const formatMoney = (value) => {
    const num = parseFloat(value);
    return isNaN(num) ? "0.00" : num.toFixed(2);
  };

  const totalRevenue = Number(reportData.total_sales) || 0;

  const paymentCards = useMemo(() => {
    const getShare = (value) =>
      totalRevenue > 0 ? ((value / totalRevenue) * 100).toFixed(1) : "0.0";

    return [
      {
        title: "Cash",
        icon: "💵",
        value: reportData.cash_sales,
        share: getShare(reportData.cash_sales),
        tone: "cash",
      },
      {
        title: "bKash / Nagad",
        icon: "📱",
        value: reportData.bkash_sales,
        share: getShare(reportData.bkash_sales),
        tone: "mobile",
      },
      {
        title: "Card",
        icon: "💳",
        value: reportData.card_sales,
        share: getShare(reportData.card_sales),
        tone: "card",
      },
    ];
  }, [reportData, totalRevenue]);

  const handlePrintMonthly = () => {
    window.print();
  };

  const yearOptions = useMemo(() => {
    const y = now.getFullYear();
    return [y - 2, y - 1, y];
  }, [now]);

  if (viewState === "loading") {
    return (
      <div className="reports-page">
        <div className="reports-state-card loading">
          <div className="reports-spinner"></div>
          <h3>Loading report data...</h3>
          <p>Please wait while we prepare your latest summary.</p>
        </div>
      </div>
    );
  }

  if (viewState === "error") {
    return (
      <div className="reports-page">
        <div className="reports-state-card error">
          <div className="state-icon">⚠️</div>
          <h3>Report load failed</h3>
          <p>{errorMessage}</p>
          <button className="reports-btn danger" onClick={fetchReport}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="reports-page">
      <div className="reports-shell">
        <div className="reports-header no-print">
          <div>
            <p className="reports-eyebrow">Reports</p>
            <h1 className="reports-title">Sales & Financial Reports</h1>
            <p className="reports-subtitle">
              Store #{activeStoreId} performance overview with payment insights.
            </p>
          </div>

          <button className="reports-btn primary" onClick={fetchReport}>
            Refresh
          </button>
        </div>

        <div className="reports-hero no-print">
          <div className="reports-hero-main">
            <p className="hero-label">Total Revenue</p>
            <h2 className="hero-amount">৳ {formatMoney(reportData.total_sales)}</h2>
            <p className="hero-subtext">
              Completed Orders <strong>{reportData.total_orders}</strong>
            </p>
          </div>

          <div className="reports-store-badge">Store #{activeStoreId}</div>
        </div>

        <div className="reports-mini-stats no-print">
          <div className="mini-stat-card">
            <span className="mini-stat-label">Average Order Value</span>
            <h3>
              ৳{" "}
              {formatMoney(
                reportData.total_orders > 0
                  ? reportData.total_sales / reportData.total_orders
                  : 0
              )}
            </h3>
          </div>

          <div className="mini-stat-card">
            <span className="mini-stat-label">Payment Methods</span>
            <h3>3 Active Channels</h3>
          </div>
        </div>

        <div className="reports-section-head no-print">
          <h2>Payment Breakdown</h2>
          <p>Revenue split by payment method for the active store.</p>
        </div>

        <div className="payment-donut-card no-print">
          <PaymentDonutChart cards={paymentCards} total={totalRevenue} />
        </div>

        <div className="reports-grid no-print">
          {paymentCards.map((item) => (
            <div key={item.title} className={`payment-card ${item.tone}`}>
              <div className="payment-card-top">
                <div className={`payment-icon ${item.tone}`}>{item.icon}</div>
                <span className="payment-share">{item.share}% of revenue</span>
              </div>

              <p className="payment-title">{item.title}</p>
              <h3 className="payment-amount">৳ {formatMoney(item.value)}</h3>
            </div>
          ))}
        </div>

        {/* ==================== Monthly Income/Expense Report ==================== */}
        <div className="monthly-report-card">
          <div className="monthly-report-head no-print">
            <div>
              <h2 className="reports-section-title">Monthly Income & Expense</h2>
              <p className="reports-section-subtitle">
                Sales as income, damaged stock as expense — printable summary.
              </p>
            </div>

            <div className="monthly-report-controls">
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(Number(e.target.value))}
                className="monthly-select"
              >
                {MONTH_NAMES.map((m, idx) => (
                  <option key={m} value={idx + 1}>
                    {m}
                  </option>
                ))}
              </select>

              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="monthly-select"
              >
                {yearOptions.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>

              <button
                className="reports-btn primary"
                onClick={handlePrintMonthly}
                disabled={monthlyLoading || !monthly}
              >
                🖨 Print Report
              </button>
            </div>
          </div>

          {monthlyLoading ? (
            <p className="monthly-loading-text">Loading monthly report...</p>
          ) : monthlyError ? (
            <p className="monthly-error-text">{monthlyError}</p>
          ) : monthly ? (
            <div className="monthly-print-area">
              <div className="monthly-print-header">
                <h2>☁ Cloud POS</h2>
                <p>Monthly Income &amp; Expense Statement</p>
                <p className="monthly-print-period">
                  {MONTH_NAMES[monthly.month - 1]} {monthly.year} — Store #{activeStoreId}
                </p>
              </div>

              <div className="monthly-summary-grid">
                <div className="monthly-summary-item income">
                  <span>Income (Sales)</span>
                  <strong>৳ {formatMoney(monthly.total_sales)}</strong>
                  <small>{monthly.total_orders} orders</small>
                </div>

                <div className="monthly-summary-item expense">
                  <span>Expense (Damaged Stock)</span>
                  <strong>৳ {formatMoney(monthly.total_damaged_value)}</strong>
                  <small>{monthly.total_damaged_qty} pcs damaged</small>
                </div>

                <div
                  className={`monthly-summary-item net ${
                    monthly.net_amount >= 0 ? "positive" : "negative"
                  }`}
                >
                  <span>Net Amount</span>
                  <strong>৳ {formatMoney(monthly.net_amount)}</strong>
                  <small>{monthly.net_amount >= 0 ? "Profit" : "Loss"}</small>
                </div>
              </div>

              <table className="monthly-payment-table">
                <thead>
                  <tr>
                    <th>Payment Method</th>
                    <th className="text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {monthly.payment_summary.length === 0 ? (
                    <tr>
                      <td colSpan="2" className="monthly-empty-cell">
                        No sales this month
                      </td>
                    </tr>
                  ) : (
                    monthly.payment_summary.map((p, idx) => (
                      <tr key={idx}>
                        <td>{p.payment_method}</td>
                        <td className="text-right">৳ {formatMoney(p.amount)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>

              <p className="monthly-print-footer">
                Generated on {new Date().toLocaleString()}
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

// পেমেন্ট মেথড অনুযায়ী গোল (donut) chart — কোনো external library ছাড়াই, নিজস্ব SVG দিয়ে
function PaymentDonutChart({ cards, total }) {
  const size = 160;
  const strokeWidth = 22;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  const colors = {
    cash: "#16a34a",
    mobile: "#f59e0b",
    card: "#2563eb",
  };

  let cumulative = 0;

  return (
    <div className="payment-donut-wrap">
      <div className="payment-donut-chart">
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="#eef2f7"
            strokeWidth={strokeWidth}
          />
          {total > 0 &&
            cards.map((c) => {
              if (c.value <= 0) return null;
              const fraction = c.value / total;
              const segment = fraction * circumference;
              const dasharray = `${segment} ${circumference - segment}`;
              const dashoffset = -cumulative;
              cumulative += segment;
              return (
                <circle
                  key={c.title}
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  fill="none"
                  stroke={colors[c.tone] || "#94a3b8"}
                  strokeWidth={strokeWidth}
                  strokeDasharray={dasharray}
                  strokeDashoffset={dashoffset}
                  transform={`rotate(-90 ${size / 2} ${size / 2})`}
                >
                  <title>
                    {c.title}: {c.share}%
                  </title>
                </circle>
              );
            })}
        </svg>

        <div className="payment-donut-center">
          <span>Total</span>
          <strong>৳ {total.toFixed(0)}</strong>
        </div>
      </div>

      <div className="payment-donut-legend">
        {cards.map((c) => (
          <div key={c.title} className="payment-donut-legend-item">
            <span
              className="payment-donut-dot"
              style={{ background: colors[c.tone] || "#94a3b8" }}
            ></span>
            <span className="payment-donut-legend-label">{c.title}</span>
            <span className="payment-donut-legend-share">{c.share}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default Reports;