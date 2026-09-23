import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import API_BASE_URL from "../apiConfig";
import "./Salary.css";

function Salary({ user }) {
  const token = localStorage.getItem("token");
  const headers = { Authorization: `Bearer ${token}` };

  const isAdmin = user?.role === "Admin";
  const now = new Date();

  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  const [staff, setStaff] = useState([]);
  const [totalPayable, setTotalPayable] = useState(0);
  const [loading, setLoading] = useState(true);
  const [salaryEdits, setSalaryEdits] = useState({});

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API_BASE_URL}/api/salary/preview?year=${year}&month=${month}`, { headers });
      setStaff(res.data.staff || []);
      setTotalPayable(res.data.total_unpaid_payable || 0);
      setSalaryEdits({});
    } catch (err) {
      alert(err.response?.data?.message || "Failed to load salary preview.");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, month]);

  useEffect(() => { if (isAdmin) load(); }, [load, isAdmin]);

  const saveSalary = async (userId) => {
    const value = salaryEdits[userId];
    if (value == null || Number(value) < 0) { alert("Enter a valid salary."); return; }
    try {
      await axios.put(`${API_BASE_URL}/api/salary/user/${userId}`, { salary: Number(value) }, { headers });
      load();
    } catch (err) {
      alert(err.response?.data?.message || "Failed to save salary.");
    }
  };

  const payOne = async (userId, name) => {
    if (!window.confirm(`Pay salary to ${name} for ${month}/${year}?`)) return;
    try {
      const res = await axios.post(`${API_BASE_URL}/api/salary/pay/${userId}`, { year, month }, { headers });
      alert(res.data.message || "Paid.");
      load();
    } catch (err) {
      alert(err.response?.data?.message || "Payment failed.");
    }
  };

  const payAll = async () => {
    if (!window.confirm(`Pay ALL unpaid staff for ${month}/${year}?\nTotal: ৳ ${totalPayable.toLocaleString()}`)) return;
    try {
      const res = await axios.post(`${API_BASE_URL}/api/salary/pay-all`, { year, month }, { headers });
      alert(`${res.data.message}\nTotal paid: ৳ ${Number(res.data.total_paid).toLocaleString()}`);
      load();
    } catch (err) {
      alert(err.response?.data?.message || "Payment failed.");
    }
  };

  if (!isAdmin) {
    return (
      <div className="sal-page">
        <div className="sal-card sal-empty">Salary is only available to Admin.</div>
      </div>
    );
  }

  const unpaidCount = staff.filter((s) => !s.already_paid).length;

  return (
    <div className="sal-page">
      <div className="sal-header">
        <div>
          <h2>💵 Salary</h2>
          <p>
            Rule: 1 day = salary ÷ 30. First 3 absents free, then 1 day cut each.
            First 4 lates free, then every 3 lates = 1 day cut.
          </p>
        </div>
        <div className="sal-payable">
          <span>Unpaid payable ({month}/{year})</span>
          <strong>৳ {totalPayable.toLocaleString()}</strong>
        </div>
      </div>

      <div className="sal-card">
        <div className="sal-toolbar">
          <div className="sal-filters">
            <select value={month} onChange={(e) => setMonth(Number(e.target.value))}>
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (<option key={m} value={m}>Month {m}</option>))}
            </select>
            <input type="number" value={year} style={{ width: 90 }} onChange={(e) => setYear(Number(e.target.value))} />
          </div>
          <button className="sal-payall" onClick={payAll} disabled={unpaidCount === 0}>
            💰 Pay all this month ({unpaidCount})
          </button>
        </div>

        <div className="sal-table-wrap">
          <table className="sal-table">
            <thead>
              <tr>
                <th>Staff</th><th>Monthly salary</th><th>Absent</th><th>Late</th>
                <th>Deduction</th><th>Net pay</th>
                <th style={{ textAlign: "right" }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="7" className="sal-empty">Loading...</td></tr>
              ) : staff.length === 0 ? (
                <tr><td colSpan="7" className="sal-empty">No staff found.</td></tr>
              ) : (
                staff.map((s) => {
                  const deduction = Number(s.absent_deduction) + Number(s.late_deduction);
                  return (
                    <tr key={s.user_id}>
                      <td>
                        <div className="sal-name">{s.name}</div>
                        <div className="sal-role">{s.role}</div>
                      </td>
                      <td>
                        <div className="sal-edit">
                          <input
                            type="number" min="0" defaultValue={s.base_salary}
                            onChange={(e) => setSalaryEdits((prev) => ({ ...prev, [s.user_id]: e.target.value }))}
                          />
                          <button className="sal-save" onClick={() => saveSalary(s.user_id)}>Save</button>
                        </div>
                      </td>
                      <td className="sal-absent">{s.absent_days}</td>
                      <td className="sal-late">{s.late_days}</td>
                      <td>৳ {deduction.toLocaleString()}</td>
                      <td className="sal-net">৳ {Number(s.net_paid).toLocaleString()}</td>
                      <td style={{ textAlign: "right" }}>
                        {s.already_paid ? (
                          <span className="sal-paid">Paid ✓</span>
                        ) : (
                          <button className="sal-pay" onClick={() => payOne(s.user_id, s.name)}>Pay</button>
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
    </div>
  );
}

export default Salary;