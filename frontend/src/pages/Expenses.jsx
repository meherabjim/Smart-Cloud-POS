import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import API_BASE_URL from "../apiConfig";
import "./Expenses.css";

const todayStr = () => new Date().toISOString().slice(0, 10);

const CATEGORIES = ["Rent", "Electricity", "Water", "Internet", "Transport", "Maintenance", "Marketing", "Other"];

function Expenses({ user, activeStoreId }) {
  const storeId = activeStoreId || Number(localStorage.getItem("activeStoreId")) || 1;
  const token = localStorage.getItem("token");
  const headers = { Authorization: `Bearer ${token}` };

  const isViewer = user?.role === "Viewer";
  const now = new Date();

  const [category, setCategory] = useState("Rent");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [expenseDate, setExpenseDate] = useState(todayStr());

  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await axios.get(
        `${API_BASE_URL}/api/expenses?store_id=${storeId}&year=${year}&month=${month}`,
        { headers }
      );
      setRows(res.data.expenses || []);
      setTotal(res.data.total_expense || 0);
    } catch (err) {
      alert(err.response?.data?.message || "Failed to load expenses.");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId, year, month]);

  useEffect(() => { load(); }, [load]);

  const submit = async (e) => {
    e.preventDefault();
    if (!amount || Number(amount) <= 0) { alert("Enter a valid amount."); return; }
    try {
      await axios.post(
        `${API_BASE_URL}/api/expenses`,
        { category, amount: Number(amount), note, expense_date: expenseDate, store_id: storeId },
        { headers }
      );
      setAmount(""); setNote(""); load();
    } catch (err) {
      alert(err.response?.data?.message || "Failed to add expense.");
    }
  };

  const remove = async (id) => {
    if (!window.confirm("Delete this expense?")) return;
    try {
      await axios.delete(`${API_BASE_URL}/api/expenses/${id}`, { headers });
      load();
    } catch (err) {
      alert(err.response?.data?.message || "Delete failed.");
    }
  };

  return (
    <div className="exp-page">
      <div className="exp-header">
        <div>
          <h2>🧾 Expenses</h2>
          <p>Track shop expenses. Salary payouts appear here automatically.</p>
        </div>
        <div className="exp-total">
          <span>Total ({month}/{year})</span>
          <strong>৳ {total.toLocaleString()}</strong>
        </div>
      </div>

      {!isViewer && (
        <div className="exp-card">
          <form className="exp-form" onSubmit={submit}>
            <div className="exp-field">
              <label>Category</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)}>
                {CATEGORIES.map((c) => (<option key={c} value={c}>{c}</option>))}
              </select>
            </div>
            <div className="exp-field small">
              <label>Amount (৳)</label>
              <input type="number" min="1" value={amount} onChange={(e) => setAmount(e.target.value)} required />
            </div>
            <div className="exp-field">
              <label>Note</label>
              <input type="text" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional" />
            </div>
            <div className="exp-field small">
              <label>Date</label>
              <input type="date" value={expenseDate} max={todayStr()} onChange={(e) => setExpenseDate(e.target.value)} />
            </div>
            <button type="submit" className="exp-add-btn">+ Add</button>
          </form>
        </div>
      )}

      <div className="exp-card">
        <div className="exp-filters">
          <h3>Records</h3>
          <div>
            <select value={month} onChange={(e) => setMonth(Number(e.target.value))}>
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (<option key={m} value={m}>Month {m}</option>))}
            </select>
            <input type="number" value={year} style={{ width: 90 }} onChange={(e) => setYear(Number(e.target.value))} />
          </div>
        </div>

        <div className="exp-table-wrap">
          <table className="exp-table">
            <thead>
              <tr>
                <th>Date</th><th>Category</th><th>Note</th>
                <th style={{ textAlign: "right" }}>Amount</th><th></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="5" className="exp-empty">Loading...</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan="5" className="exp-empty">No expenses.</td></tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id}>
                    <td>{String(r.expense_date).slice(0, 10)}</td>
                    <td><span className={`exp-tag ${r.source === "Salary" ? "salary" : ""}`}>{r.category}</span></td>
                    <td className="exp-note">{r.note || "-"}</td>
                    <td style={{ textAlign: "right", fontWeight: 700 }}>৳ {Number(r.amount).toLocaleString()}</td>
                    <td style={{ textAlign: "right" }}>
                      {!isViewer && r.source !== "Salary" ? (
                        <button className="exp-del" onClick={() => remove(r.id)}>Delete</button>
                      ) : (
                        <span className="exp-auto">{r.source === "Salary" ? "auto" : ""}</span>
                      )}
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

export default Expenses;