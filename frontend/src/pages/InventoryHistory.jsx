import React, { useState, useEffect, useCallback, useMemo } from "react";
import axios from "axios";
import "./InventoryHistory.css";

const API = axios.create({
  baseURL: "https://smart-cloud-pos.onrender.com/api/inventory-history",
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

function InventoryHistory() {
  const activeStoreId = Number(localStorage.getItem("activeStoreId")) || 1;

  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState("");
  const [search, setSearch] = useState("");

  const loadHistory = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ store_id: activeStoreId });
      if (typeFilter) params.append("type", typeFilter);

      const res = await API.get(`?${params.toString()}`);
      setHistory(res.data || []);
    } catch (err) {
      console.error("Error loading inventory history:", err);
    } finally {
      setLoading(false);
    }
  }, [activeStoreId, typeFilter]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const filtered = useMemo(() => {
    return history.filter(
      (h) =>
        (h.product_name || "").toLowerCase().includes(search.toLowerCase()) ||
        (h.barcode || "").toString().includes(search)
    );
  }, [history, search]);

  const formatDate = (iso) => {
    if (!iso) return "â€”";
    return new Date(iso).toLocaleString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const stockInCount = filtered.filter((item) => item.type === "IN").length;
  const stockOutCount = filtered.filter((item) => item.type === "OUT").length;

  return (
    <div className="inventory-history-page">
      <div className="inventory-history-shell">
        <div className="inventory-history-header">
          <div>
            <p className="inventory-history-eyebrow">Movement log</p>
            <h1 className="inventory-history-title">Inventory History</h1>
            <p className="inventory-history-subtitle">
              Review stock movement records, filter by type, and search product activity by name or barcode.
            </p>
          </div>

          <div className="inventory-history-store-badge">
            <span className="store-dot"></span>
            Current Store #{activeStoreId}
          </div>
        </div>

        <div className="inventory-history-summary-grid">
          <div className="ih-summary-card total">
            <span className="ih-summary-label">Total Records</span>
            <h3>{filtered.length}</h3>
          </div>

          <div className="ih-summary-card in">
            <span className="ih-summary-label">Stock In</span>
            <h3>{stockInCount}</h3>
          </div>

          <div className="ih-summary-card out">
            <span className="ih-summary-label">Stock Out</span>
            <h3>{stockOutCount}</h3>
          </div>
        </div>

        <div className="inventory-history-toolbar">
          <div className="inventory-history-search-wrap">
            <input
              className="inventory-history-search"
              placeholder="Search product or barcode..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <select
            className="inventory-history-select"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
          >
            <option value="">All Types</option>
            <option value="IN">Stock In</option>
            <option value="OUT">Stock Out</option>
          </select>

          <button className="inventory-history-refresh-btn" onClick={loadHistory}>
            Refresh
          </button>
        </div>

        <div className="inventory-history-table-card">
          <div className="inventory-history-table-wrap">
            <table className="inventory-history-table">
              <thead>
                <tr>
                  <th>Date/Time</th>
                  <th>Product</th>
                  <th>Barcode</th>
                  <th>Type</th>
                  <th>Quantity</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="5" className="inventory-history-empty">
                      Loading history...
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="inventory-history-empty">
                      No history found.
                    </td>
                  </tr>
                ) : (
                  filtered.map((h) => (
                    <tr key={h.id}>
                      <td data-label="Date/Time">{formatDate(h.created_at)}</td>
                      <td data-label="Product" className="ih-product-cell">
                        {h.product_name || "Deleted Product"}
                      </td>
                      <td data-label="Barcode">{h.barcode || "â€”"}</td>
                      <td data-label="Type">
                        <span className={`ih-type-badge ${h.type === "IN" ? "in" : "out"}`}>
                          {h.type === "IN" ? "Stock In" : "Stock Out"}
                        </span>
                      </td>
                      <td data-label="Quantity" className="ih-qty-cell">
                        {h.qty}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

export default InventoryHistory;

