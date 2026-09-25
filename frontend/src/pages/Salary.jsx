import React, { useState, useEffect, useCallback, useMemo } from "react";
import axios from "axios";
import API_BASE_URL from "../apiConfig";
import "./Salary.css";

const taka = (n) => `৳ ${Number(n || 0).toLocaleString()}`;

function Salary({ user }) {
  const token = localStorage.getItem("token");
  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);

  const isAdmin = user?.role === "Admin";
  const now = new Date();

  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  const [staff, setStaff] = useState([]);
  const [totalPayable, setTotalPayable] = useState(0);
  const [loading, setLoading] = useState(true);
  const [salaryEdits, setSalaryEdits] = useState({});

  const [requests, setRequests] = useState([]);
  const [history, setHistory] = useState([]);

  const [confirm, setConfirm] = useState(null); // { type: 'one', row } | { type: 'all' }
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null); // { kind, text }

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [prev, reqs, hist] = await Promise.all([
        axios.get(`${API_BASE_URL}/api/salary/preview?year=${year}&month=${month}`, { headers }),
        axios.get(`${API_BASE_URL}/api/payout/pending`, { headers }).catch(() => ({ data: { requests: [] } })),
        axios.get(`${API_BASE_URL}/api/salary/history?year=${year}&month=${month}`, { headers }),
      ]);
      setStaff(prev.data.staff || []);
      setTotalPayable(prev.data.total_unpaid_payable || 0);
      setRequests(reqs.data.requests || []);
      setHistory(hist.data.payments || []);
      setSalaryEdits({});
    } catch (err) {
      setNotice({ kind: "bad", text: err.response?.data?.message || "Failed to load salary." });
    } finally {
      setLoading(false);
    }
  }, [year, month, headers]);

  useEffect(() => {
    if (isAdmin) load();
  }, [load, isAdmin]);

  const saveSalary = async (userId) => {
    const value = salaryEdits[userId];
    if (value == null || value === "" || Number(value) < 0) {
      setNotice({ kind: "bad", text: "Enter a valid salary." });
      return;
    }
    try {
      await axios.put(`${API_BASE_URL}/api/salary/user/${userId}`, { salary: Number(value) }, { headers });
      setNotice({ kind: "ok", text: "Salary updated." });
      load();
    } catch (err) {
      setNotice({ kind: "bad", text: err.response?.data?.message || "Failed to save salary." });
    }
  };

  const reviewRequest = async (id, decision) => {
    try {
      const res = await axios.post(`${API_BASE_URL}/api/payout/${id}/${decision}`, {}, { headers });
      setNotice({ kind: "ok", text: res.data.message });
      load();
    } catch (err) {
      setNotice({ kind: "bad", text: err.response?.data?.message || "Failed." });
    }
  };

  const doPay = async () => {
    if (!confirm) return;
    setBusy(true);
    try {
      if (confirm.type === "one") {
        const res = await axios.post(
          `${API_BASE_URL}/api/salary/pay/${confirm.row.user_id}`,
          { year, month },
          { headers }
        );
        const p = res.data.payment || {};
        setNotice({ kind: "ok", text: `${res.data.message} Ref: ${p.txn_ref || "-"}` });
      } else {
        const res = await axios.post(`${API_BASE_URL}/api/salary/pay-all`, { year, month }, { headers });
        setNotice({
          kind: "ok",
          text: `${res.data.message} Total: ${taka(res.data.total_paid)}. Bank / bKash / Nagad / Rocket payments are DEMO records — no real money was sent.`,
        });
      }
      setConfirm(null);
      load();
    } catch (err) {
      setNotice({ kind: "bad", text: err.response?.data?.message || "Payment failed." });
      setConfirm(null);
    } finally {
      setBusy(false);
    }
  };

  const unpaid = staff.filter((s) => !s.already_paid);
  const unpaidByMethod = unpaid.reduce((acc, s) => {
    const m = s.payout?.method || "Cash";
    acc[m] = (acc[m] || 0) + Number(s.net_paid);
    return acc;
  }, {});

  if (!isAdmin) {
    return (
      <div className="sal-page">
        <div className="sal-card sal-empty">Salary is only available to Admin.</div>
      </div>
    );
  }

  return (
    <div className="sal-page">
      <div className="sal-header">
        <div>
          <h2>💵 Salary</h2>
          <p>
            Rule: 1 day = salary ÷ 30. First 3 absents free, then 1 day cut each.
            First 4 lates free, then every 3 lates = 1 day cut. Bank / bKash / Nagad /
            Rocket payouts are <b>demo records</b> — no payment gateway is connected, so
            no real money moves.
          </p>
        </div>
        <div className="sal-payable">
          <span>Unpaid payable ({month}/{year})</span>
          <strong>{taka(totalPayable)}</strong>
        </div>
      </div>

      {notice && (
        <div className={`sal-notice ${notice.kind}`}>
          <span>{notice.text}</span>
          <button type="button" onClick={() => setNotice(null)} aria-label="Close">✕</button>
        </div>
      )}

      {requests.length > 0 && (
        <div className="sal-card">
          <h3 className="sal-sub">🔔 Account change requests ({requests.length})</h3>
          <div className="sal-table-wrap">
            <table className="sal-table">
              <thead>
                <tr>
                  <th>Staff</th>
                  <th>Store</th>
                  <th>Current account</th>
                  <th>Wants to change to</th>
                  <th style={{ textAlign: "right" }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <div className="sal-name">{r.user_name}</div>
                      <div className="sal-role">{r.role}</div>
                    </td>
                    <td>{r.store_name || `#${r.store_id}`}</td>
                    <td>{r.current ? r.current.label : "Cash (no account)"}</td>
                    <td>
                      <b>{r.requested.label}</b>
                      {r.requested.account_name && <div className="sal-role">{r.requested.account_name}</div>}
                      {r.requested.branch && <div className="sal-role">Branch: {r.requested.branch}</div>}
                    </td>
                    <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                      <button className="sal-pay" onClick={() => reviewRequest(r.id, "approve")}>Approve</button>{" "}
                      <button className="sal-reject" onClick={() => reviewRequest(r.id, "reject")}>Reject</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="sal-card">
        <div className="sal-toolbar">
          <div className="sal-filters">
            <select value={month} onChange={(e) => setMonth(Number(e.target.value))}>
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <option key={m} value={m}>Month {m}</option>
              ))}
            </select>
            <input type="number" value={year} style={{ width: 90 }} onChange={(e) => setYear(Number(e.target.value))} />
          </div>
          <button className="sal-payall" onClick={() => setConfirm({ type: "all" })} disabled={unpaid.length === 0}>
            💰 Pay all this month ({unpaid.length})
          </button>
        </div>

        <div className="sal-table-wrap">
          <table className="sal-table">
            <thead>
              <tr>
                <th>Staff</th>
                <th>Store</th>
                <th>Monthly salary</th>
                <th>Absent</th>
                <th>Late</th>
                <th>Deduction</th>
                <th>Net pay</th>
                <th>Pays to</th>
                <th style={{ textAlign: "right" }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="9" className="sal-empty">Loading...</td></tr>
              ) : staff.length === 0 ? (
                <tr><td colSpan="9" className="sal-empty">No staff found.</td></tr>
              ) : (
                staff.map((s) => {
                  const deduction = Number(s.absent_deduction) + Number(s.late_deduction);
                  return (
                    <tr key={s.user_id}>
                      <td>
                        <div className="sal-name">{s.name}</div>
                        <div className="sal-role">{s.role}</div>
                      </td>
                      <td>{s.store_name || (s.store_id ? `#${s.store_id}` : "-")}</td>
                      <td>
                        <div className="sal-edit">
                          <input
                            type="number"
                            min="0"
                            defaultValue={s.base_salary}
                            onChange={(e) => setSalaryEdits((prev) => ({ ...prev, [s.user_id]: e.target.value }))}
                          />
                          <button className="sal-save" onClick={() => saveSalary(s.user_id)}>Save</button>
                        </div>
                      </td>
                      <td className="sal-absent">{s.absent_days}</td>
                      <td className="sal-late">{s.late_days}</td>
                      <td>{taka(deduction)}</td>
                      <td className="sal-net">{taka(s.net_paid)}</td>
                      <td>
                        <span className={`sal-method m-${(s.payout?.method || "cash").toLowerCase()}`}>
                          {s.payout?.label || "Cash"}
                        </span>
                        {s.payout?.pending_change && <div className="sal-warn">Change pending ↑</div>}
                      </td>
                      <td style={{ textAlign: "right" }}>
                        {s.already_paid ? (
                          <span className="sal-paid">Paid ✓</span>
                        ) : (
                          <button className="sal-pay" onClick={() => setConfirm({ type: "one", row: s })}>Pay</button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="sal-card">
        <h3 className="sal-sub">🧾 Paid for {month}/{year}</h3>
        <div className="sal-table-wrap">
          <table className="sal-table">
            <thead>
              <tr>
                <th>Staff</th>
                <th>Store</th>
                <th>Net paid</th>
                <th>Paid to</th>
                <th>Reference</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {history.length === 0 ? (
                <tr><td colSpan="6" className="sal-empty">Nothing paid for this month yet.</td></tr>
              ) : (
                history.map((h) => (
                  <tr key={h.id}>
                    <td className="sal-name">{h.name}</td>
                    <td>{h.store_name || `#${h.store_id}`}</td>
                    <td className="sal-net">{taka(h.net_paid)}</td>
                    <td>
                      {h.paid_to}
                      {h.is_demo && <span className="sal-demo">DEMO</span>}
                    </td>
                    <td className="sal-ref">{h.txn_ref || "-"}</td>
                    <td>{h.created_at ? new Date(h.created_at).toLocaleDateString() : "-"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {confirm && (
        <div className="sal-modal-bg" onClick={() => !busy && setConfirm(null)}>
          <div className="sal-modal" onClick={(e) => e.stopPropagation()}>
            {confirm.type === "one" ? (
              <>
                <h3>Pay {confirm.row.name} — {month}/{year}</h3>
                <div className="sal-break">
                  <div><span>Monthly salary</span><b>{taka(confirm.row.base_salary)}</b></div>
                  <div className="neg">
                    <span>Absent cut ({confirm.row.absent_days} absent, 3 free)</span>
                    <b>− {taka(confirm.row.absent_deduction)}</b>
                  </div>
                  <div className="neg">
                    <span>Late cut ({confirm.row.late_days} late, 4 free)</span>
                    <b>− {taka(confirm.row.late_deduction)}</b>
                  </div>
                  <div className="total"><span>Will be paid</span><b>{taka(confirm.row.net_paid)}</b></div>
                </div>
                <p className="sal-to">
                  To: <b>{confirm.row.payout?.label || "Cash"}</b>
                  {confirm.row.payout?.is_demo && <span className="sal-demo">DEMO</span>}
                </p>
                {confirm.row.payout?.is_demo && (
                  <p className="sal-demo-note">
                    No payment gateway is connected. This only records the payment — no real
                    money is sent to this account.
                  </p>
                )}
                {confirm.row.payout?.pending_change && (
                  <p className="sal-demo-note">This staff member has an account change waiting for approval. Payment goes to the current account shown above.</p>
                )}
              </>
            ) : (
              <>
                <h3>Pay all unpaid staff — {month}/{year}</h3>
                <div className="sal-break">
                  {Object.entries(unpaidByMethod).map(([m, amt]) => (
                    <div key={m}>
                      <span>{m}{m !== "Cash" ? " (demo)" : ""}</span>
                      <b>{taka(amt)}</b>
                    </div>
                  ))}
                  <div className="total"><span>{unpaid.length} staff, total</span><b>{taka(totalPayable)}</b></div>
                </div>
                <p className="sal-demo-note">
                  Bank / bKash / Nagad / Rocket payments are recorded as DEMO — no real money is sent.
                </p>
              </>
            )}
            <div className="sal-modal-actions">
              <button type="button" className="sal-cancel" onClick={() => setConfirm(null)} disabled={busy}>Cancel</button>
              <button type="button" className="sal-payall" onClick={doPay} disabled={busy}>
                {busy ? "Paying…" : "Confirm payment"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Salary;
