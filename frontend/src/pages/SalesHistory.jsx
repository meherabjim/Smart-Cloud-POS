import React, { useEffect, useState, useCallback } from "react";
import axios from "axios";
import "./SalesHistory.css";

function SalesHistory() {
  const activeStoreId = Number(localStorage.getItem("activeStoreId")) || 1;

  const [sales, setSales] = useState([]);
  const [phone, setPhone] = useState("");
  const [selectedSale, setSelectedSale] = useState(null);
  const [items, setItems] = useState([]);
  const [showModal, setShowModal] = useState(false);

  const loadSales = useCallback(
    async (searchPhone = "") => {
      try {
        const params = new URLSearchParams({ store_id: activeStoreId });
        if (searchPhone.trim() !== "") {
          params.append("phone", searchPhone);
        }

        const res = await axios.get(
          `https://smart-cloud-pos-api.onrender.com/api/sales?${params.toString()}`
        );
        setSales(res.data || []);
      } catch (err) {
        console.log(err);
        alert("Failed to load sales history");
      }
    },
    [activeStoreId]
  );

  useEffect(() => {
    loadSales();
  }, [loadSales]);

  const handleSearch = () => {
    loadSales(phone);
  };

  const handleReset = () => {
    setPhone("");
    loadSales();
  };

  const handleView = async (id) => {
    try {
      const res = await axios.get(`https://smart-cloud-pos-api.onrender.com/api/sales/${id}`);
      setSelectedSale(res.data.sale);
      setItems(res.data.items || []);
      setShowModal(true);
    } catch (err) {
      console.log(err);
      alert("Failed to load invoice");
    }
  };

  return (
    <div className="sales-history-page">
      <div className="sales-history-header">
        <div>
          <p className="sales-history-eyebrow">Sales Records</p>
          <h2 className="sales-history-title">ðŸ“„ Sales History</h2>
          <p className="sales-history-subtitle">
            ðŸª Current Store: #{activeStoreId}
          </p>
        </div>

        <div className="sales-history-stat">
          <span>Total Sales</span>
          <strong>{sales.length}</strong>
        </div>
      </div>

      <div className="sales-history-toolbar-card">
        <div className="sales-history-toolbar">
          <div className="sales-history-search-wrap">
            <input
              type="text"
              placeholder="Search by phone number..."
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSearch();
              }}
              className="sales-history-search"
            />
          </div>

          <button onClick={handleSearch} className="sales-history-btn primary">
            Search
          </button>

          <button onClick={handleReset} className="sales-history-btn secondary">
            Reset
          </button>
        </div>
      </div>

      <div className="sales-history-table-card">
        <div className="sales-history-table-wrap">
          <table className="sales-history-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Phone</th>
                <th>Total</th>
                <th>Discount</th>
                <th>Tax</th>
                <th>Payable</th>
                <th>Payment</th>
                <th>Date</th>
                <th className="action-col">Action</th>
              </tr>
            </thead>
            <tbody>
              {sales.length === 0 ? (
                <tr>
                  <td colSpan="9" className="sales-history-empty">
                    No Sales Found
                  </td>
                </tr>
              ) : (
                sales.map((sale) => (
                  <tr key={sale.id}>
                    <td className="mono">#{sale.id}</td>
                    <td>{sale.customer_phone || "-"}</td>
                    <td className="mono">à§³ {sale.total_amount}</td>
                    <td className="mono">à§³ {sale.discount}</td>
                    <td className="mono">à§³ {sale.tax}</td>
                    <td className="mono strong">à§³ {sale.payable_amount}</td>
                    <td>
                      <span className="payment-badge">
                        {sale.payment_method}
                      </span>
                    </td>
                    <td>
                      {sale.created_at
                        ? new Date(sale.created_at).toLocaleString()
                        : "-"}
                    </td>
                    <td>
                      <button
                        onClick={() => handleView(sale.id)}
                        className="sales-history-btn small primary"
                      >
                        ðŸ‘ View
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && selectedSale && (
        <div className="sales-history-overlay">
          <div className="sales-history-modal">
            <div className="invoice-brand">
              <h2>â˜ Cloud POS</h2>
              <p>Smart POS & Inventory System</p>
            </div>

            <div className="invoice-head">
              <div>
                <h3>Invoice #{selectedSale.id}</h3>
                <p>
                  <strong>Customer:</strong>{" "}
                  {selectedSale.customer_phone || "Walk-in Customer"}
                </p>
                <p>
                  <strong>Date:</strong>{" "}
                  {selectedSale.created_at
                    ? new Date(selectedSale.created_at).toLocaleString()
                    : "-"}
                </p>
              </div>
            </div>

            <div className="invoice-table-wrap">
              <table className="invoice-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Qty</th>
                    <th>Price</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id}>
                      <td>{item.name}</td>
                      <td className="mono">{item.quantity}</td>
                      <td className="mono">à§³ {item.price}</td>
                      <td className="mono strong">
                        à§³ {(Number(item.price) * Number(item.quantity)).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="invoice-summary">
              <div className="invoice-row">
                <span>Total</span>
                <strong>à§³ {selectedSale.total_amount}</strong>
              </div>
              <div className="invoice-row">
                <span>Discount</span>
                <strong>à§³ {selectedSale.discount}</strong>
              </div>
              <div className="invoice-row">
                <span>Tax</span>
                <strong>à§³ {selectedSale.tax}</strong>
              </div>
              <div className="invoice-row grand">
                <span>Grand Total</span>
                <strong>à§³ {selectedSale.payable_amount}</strong>
              </div>
              <div className="invoice-row">
                <span>Payment</span>
                <strong>{selectedSale.payment_method}</strong>
              </div>
            </div>

            <div className="invoice-thanks">
              <h4>Thank You â¤ï¸</h4>
              <p>Please Visit Again</p>
            </div>

            <div className="sales-history-modal-actions">
              <button
                onClick={() => window.print()}
                className="sales-history-btn success"
              >
                ðŸ–¨ Print Invoice
              </button>
              <button
                onClick={() => setShowModal(false)}
                className="sales-history-btn secondary"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default SalesHistory;
