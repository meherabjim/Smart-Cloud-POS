import React, { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import API_BASE_URL from "../apiConfig";
import "./Users.css";

// ADMIN ONLY: every loyalty customer, their points, how much they
// bought and from which store(s).
function Customers({ user }) {
  const token = localStorage.getItem("token");
  const config = useMemo(() => ({ headers: { Authorization: `Bearer ${token}` } }), [token]);

  const [rows, setRows] = useState([]);
  const [stores, setStores] = useState([]);
  const [storeFilter, setStoreFilter] = useState("");
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    axios
      .get(`${API_BASE_URL}/api/stores`, config)
      .then((res) => setStores(Array.isArray(res.data) ? res.data : []))
      .catch(() => setStores([]));
  }, [config]);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const params = new URLSearchParams();
      if (query) params.set("search", query);
      if (storeFilter) params.set("store_id", storeFilter);
      const res = await axios.get(`${API_BASE_URL}/api/customers/admin/all?${params}`, config);
      setRows(res.data.customers || []);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load customers.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [query, storeFilter, config]);

  useEffect(() => {
    load();
  }, [load]);

  if (user?.role !== "Admin") {
    return (
      <div className="users-page">
        <div className="users-table-card" style={{ padding: 30, textAlign: "center" }}>
          Customers list is only available to Admin.
        </div>
      </div>
    );
  }

  const totalPoints = rows.reduce((a, c) => a + c.points_balance, 0);
  const totalSpent = rows.reduce((a, c) => a + c.total_spent, 0);

  return (
    <div className="users-page">
      <div className="users-header">
        <p className="users-eyebrow">Admin only</p>
        <h2 className="users-title">All Customers</h2>
        <p className="users-subtitle">Loyalty customers from every store — points, purchases and where they buy.</p>
      </div>

      <div className="users-stats">
        <div className="users-stat"><span>Customers</span><strong>{rows.length}</strong></div>
        <div className="users-stat ok"><span>Total bought</span><strong>৳ {totalSpent.toLocaleString()}</strong></div>
        <div className="users-stat warn"><span>Points outstanding</span><strong>{totalPoints.toLocaleString()}</strong></div>
      </div>

      <div className="users-table-card">
        <div className="users-table-header">
          <div>
            <h3 className="users-section-title">Customer List</h3>
            <p className="users-section-text">Sorted by total purchase</p>
          </div>
          <form
            className="users-filters"
            onSubmit={(e) => {
              e.preventDefault();
              setQuery(search.trim());
            }}
          >
            <input
              className="users-input"
              placeholder="Name / phone / email"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <select className="users-select" value={storeFilter} onChange={(e) => setStoreFilter(e.target.value)}>
              <option value="">All stores</option>
              {stores.map((s) => (
                <option key={s.id} value={s.id}>{s.name || `Store #${s.id}`}</option>
              ))}
            </select>
            <button type="submit" className="users-refresh-button">Search</button>
          </form>
        </div>

        {error && <div style={{ padding: 14, color: "#b91c1c" }}>{error}</div>}

        <div className="users-table-wrap">
          <table className="users-table wide">
            <thead>
              <tr>
                <th>Customer</th>
                <th>Phone</th>
                <th>Bought from</th>
                <th className="num">Orders</th>
                <th className="num">Total bought</th>
                <th className="num">Points</th>
                <th>Last purchase</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="8" className="users-center-cell">Loading customers...</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan="8" className="users-center-cell">No customers found.</td></tr>
              ) : (
                rows.map((c) => (
                  <tr key={c.id}>
                    <td className="users-td">
                      <div className="users-td-bold">{c.name}</div>
                      <div className="users-muted">{c.email || "—"}</div>
                    </td>
                    <td className="users-td" style={{ fontVariantNumeric: "tabular-nums" }}>{c.phone}</td>
                    <td className="users-td">
                      {c.stores ? (
                        c.stores.split(", ").map((s) => (
                          <span key={s} className="users-store" style={{ marginRight: 4 }}>{s}</span>
                        ))
                      ) : (
                        <span className="users-muted">No purchase yet</span>
                      )}
                    </td>
                    <td className="users-td num">{c.total_orders}</td>
                    <td className="users-td num">৳ {c.total_spent.toLocaleString()}</td>
                    <td className="users-td num att-warn">{c.points_balance}</td>
                    <td className="users-td">{c.last_purchase ? new Date(c.last_purchase).toLocaleDateString() : "—"}</td>
                    <td className="users-td">
                      <span className={`users-pill ${c.status === "Active" ? "ok" : ""}`}>{c.status}</span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default Customers;
