import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import API_BASE_URL from "../apiConfig";
import "./Suppliers.css";

function Suppliers({ user, activeStoreId }) {
  const storeId = activeStoreId || Number(localStorage.getItem("activeStoreId")) || 1;
  const token = localStorage.getItem("token");
  const headers = { Authorization: `Bearer ${token}` };

  const isViewer = user?.role === "Viewer";
  const isAdmin = user?.role === "Admin";

  const [suppliers, setSuppliers] = useState([]);
  const [totalDue, setTotalDue] = useState(0);
  const [loading, setLoading] = useState(true);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");

  const [active, setActive] = useState(null);
  const [actionType, setActionType] = useState("DUE");
  const [amount, setAmount] = useState("");
  const [ledgerNote, setLedgerNote] = useState("");
  const [txns, setTxns] = useState([]);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API_BASE_URL}/api/suppliers?store_id=${storeId}`, { headers });
      setSuppliers(res.data.suppliers || []);
      setTotalDue(res.data.total_due || 0);
    } catch (err) {
      alert(err.response?.data?.message || "Failed to load suppliers.");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId]);

  useEffect(() => { load(); }, [load]);

  const addSupplier = async (e) => {
    e.preventDefault();
    if (!name.trim()) { alert("Supplier name is required."); return; }
    try {
      await axios.post(`${API_BASE_URL}/api/suppliers`,
        { name, phone, address, store_id: storeId }, { headers });
      setName(""); setPhone(""); setAddress(""); load();
    } catch (err) {
      alert(err.response?.data?.message || "Failed to add supplier.");
    }
  };

  const openPanel = async (supplier, type) => {
    setActive(supplier); setActionType(type); setAmount(""); setLedgerNote("");
    try {
      const res = await axios.get(`${API_BASE_URL}/api/suppliers/${supplier.id}/transactions`, { headers });
      setTxns(res.data.transactions || []);
    } catch (err) {
      setTxns([]);
    }
  };

  const submitLedger = async (e) => {
    e.preventDefault();
    if (!amount || Number(amount) <= 0) { alert("Enter a valid amount."); return; }
    const url = actionType === "DUE"
      ? `${API_BASE_URL}/api/suppliers/${active.id}/due`
      : `${API_BASE_URL}/api/suppliers/${active.id}/payment`;
    try {
      await axios.post(url, { amount: Number(amount), note: ledgerNote }, { headers });
      setActive(null); load();
    } catch (err) {
      alert(err.response?.data?.message || "Failed.");
    }
  };

  const removeSupplier = async (id) => {
    if (!window.confirm("Delete this supplier? (due must be 0)")) return;
    try {
      await axios.delete(`${API_BASE_URL}/api/suppliers/${id}`, { headers });
      load();
    } catch (err) {
      alert(err.response?.data?.message || "Delete failed.");
    }
  };

  return (
    <div className="sup-page">
      <div className="sup-header">
        <div>
          <h2>🚚 Suppliers &amp; Due</h2>
          <p>Track who you buy from and how much you still owe them.</p>
        </div>
        <div className="sup-total">
          <span>Total Due</span>
          <strong>৳ {totalDue.toLocaleString()}</strong>
        </div>
      </div>

      {!isViewer && (
        <div className="sup-card">
          <form className="sup-form" onSubmit={addSupplier}>
            <div className="sup-field">
              <label>Supplier name</label>
              <input value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="sup-field">
              <label>Phone</label>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Optional" />
            </div>
            <div className="sup-field">
              <label>Address</label>
              <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Optional" />
            </div>
            <button type="submit" className="sup-add-btn">+ Add Supplier</button>
          </form>
        </div>
      )}

      <div className="sup-card">
        <div className="sup-table-wrap">
          <table className="sup-table">
            <thead>
              <tr>
                <th>Supplier</th><th>Phone</th>
                <th style={{ textAlign: "right" }}>Due</th>
                <th style={{ textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="4" className="sup-empty">Loading...</td></tr>
              ) : suppliers.length === 0 ? (
                <tr><td colSpan="4" className="sup-empty">No suppliers yet.</td></tr>
              ) : (
                suppliers.map((s) => (
                  <tr key={s.id}>
                    <td className="sup-bold">{s.name}</td>
                    <td>{s.phone || "-"}</td>
                    <td style={{ textAlign: "right" }}>
                      <span className={s.due_balance > 0 ? "sup-due" : "sup-clear"}>
                        ৳ {Number(s.due_balance).toLocaleString()}
                      </span>
                    </td>
                    <td className="sup-actions">
                      <button className="sup-btn view" onClick={() => openPanel(s, "DUE")}>+ Due</button>
                      {!isViewer && (
                        <button className="sup-btn pay" onClick={() => openPanel(s, "PAYMENT")}>Pay</button>
                      )}
                      {isAdmin && (
                        <button className="sup-btn del" onClick={() => removeSupplier(s.id)}>Delete</button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {active && (
        <div className="sup-modal-backdrop" onClick={() => setActive(null)}>
          <div className="sup-modal" onClick={(e) => e.stopPropagation()}>
            <div className="sup-modal-head">
              <h3>{active.name}</h3>
              <button className="sup-close" onClick={() => setActive(null)}>✕</button>
            </div>

            <div className="sup-modal-due">
              Current due: <strong>৳ {Number(active.due_balance).toLocaleString()}</strong>
            </div>

            {!isViewer && (
              <form className="sup-ledger-form" onSubmit={submitLedger}>
                <div className="sup-toggle">
                  <button type="button" className={actionType === "DUE" ? "on" : ""} onClick={() => setActionType("DUE")}>
                    + Add Due (bought on credit)
                  </button>
                  <button type="button" className={actionType === "PAYMENT" ? "on" : ""} onClick={() => setActionType("PAYMENT")}>
                    − Pay Supplier
                  </button>
                </div>
                <input type="number" min="1" placeholder="Amount (৳)" value={amount} onChange={(e) => setAmount(e.target.value)} required />
                <input type="text" placeholder="Note (optional)" value={ledgerNote} onChange={(e) => setLedgerNote(e.target.value)} />
                <button type="submit" className="sup-submit">Save</button>
              </form>
            )}

            <div className="sup-txn-title">History</div>
            <div className="sup-txn-wrap">
              {txns.length === 0 ? (
                <p className="sup-empty">No transactions.</p>
              ) : (
                <table className="sup-table">
                  <thead>
                    <tr>
                      <th>Type</th>
                      <th style={{ textAlign: "right" }}>Amount</th>
                      <th style={{ textAlign: "right" }}>Balance</th>
                      <th>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {txns.map((t) => (
                      <tr key={t.id}>
                        <td><span className={`sup-ttag ${t.type.toLowerCase()}`}>{t.type === "DUE" ? "Due" : "Payment"}</span></td>
                        <td style={{ textAlign: "right" }}>৳ {Number(t.amount).toLocaleString()}</td>
                        <td style={{ textAlign: "right" }}>৳ {Number(t.balance_after).toLocaleString()}</td>
                        <td>{new Date(t.created_at).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Suppliers;