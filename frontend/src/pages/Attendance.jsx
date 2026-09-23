import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import API_BASE_URL from "../apiConfig";
import "./Attendance.css";

const todayStr = () => new Date().toISOString().slice(0, 10);

function Attendance({ user, activeStoreId }) {
  const storeId =
    activeStoreId || Number(localStorage.getItem("activeStoreId")) || 1;
  const token = localStorage.getItem("token");
  const headers = { Authorization: `Bearer ${token}` };

  const isViewer = user?.role === "Viewer";

  const now = new Date();
  const [date, setDate] = useState(todayStr());
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);

  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [summary, setSummary] = useState([]);

  const loadDay = useCallback(async () => {
    try {
      setLoading(true);
      const res = await axios.get(
        `${API_BASE_URL}/api/attendance?date=${date}&store_id=${storeId}`,
        { headers }
      );
      setStaff(res.data.staff || []);
    } catch (err) {
      alert(err.response?.data?.message || "Failed to load attendance.");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, storeId]);

  const loadSummary = useCallback(async () => {
    try {
      const res = await axios.get(
        `${API_BASE_URL}/api/attendance/summary?year=${year}&month=${month}&store_id=${storeId}`,
        { headers }
      );
      setSummary(res.data.staff || []);
    } catch (err) {
      console.error(err);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, month, storeId]);

  useEffect(() => { loadDay(); }, [loadDay]);
  useEffect(() => { loadSummary(); }, [loadSummary]);

  const mark = async (userId, status) => {
    if (isViewer) return;
    try {
      const body = { user_id: userId, date, status };
      if (status === "Late" || status === "Present") {
        body.check_in_time = new Date().toTimeString().slice(0, 8);
      }
      await axios.post(`${API_BASE_URL}/api/attendance`, body, { headers });
      loadDay();
      loadSummary();
    } catch (err) {
      alert(err.response?.data?.message || "Failed to save.");
    }
  };

  const statusOptions = ["Present", "Late", "Absent", "Leave"];

  return (
    <div className="att-page">
      <div className="att-header">
        <div>
          <h2>🕒 Attendance</h2>
          <p>Mark daily attendance. Late / absent days affect salary.</p>
        </div>
        <div className="att-datebox">
          <label>Date</label>
          <input
            type="date"
            value={date}
            max={todayStr()}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
      </div>

      <div className="att-card">
        <div className="att-table-wrap">
          <table className="att-table">
            <thead>
              <tr>
                <th>Staff</th>
                <th>Role</th>
                <th>Status</th>
                <th style={{ textAlign: "right" }}>Mark</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="4" className="att-empty">Loading...</td></tr>
              ) : staff.length === 0 ? (
                <tr><td colSpan="4" className="att-empty">No staff found.</td></tr>
              ) : (
                staff.map((s) => (
                  <tr key={s.user_id}>
                    <td className="att-bold">{s.name}</td>
                    <td>{s.role}</td>
                    <td>
                      {s.status ? (
                        <span className={`att-badge ${s.status.toLowerCase()}`}>{s.status}</span>
                      ) : (
                        <span className="att-badge none">Not marked</span>
                      )}
                    </td>
                    <td className="att-actions">
                      {statusOptions.map((opt) => (
                        <button
                          key={opt}
                          type="button"
                          disabled={isViewer}
                          className={`att-btn ${opt.toLowerCase()} ${s.status === opt ? "on" : ""}`}
                          onClick={() => mark(s.user_id, opt)}
                        >
                          {opt}
                        </button>
                      ))}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="att-card">
        <div className="att-summary-head">
          <h3>Monthly Summary</h3>
          <div className="att-filters">
            <select value={month} onChange={(e) => setMonth(Number(e.target.value))}>
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <option key={m} value={m}>Month {m}</option>
              ))}
            </select>
            <input type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} style={{ width: 90 }} />
          </div>
        </div>

        <div className="att-table-wrap">
          <table className="att-table">
            <thead>
              <tr>
                <th>Staff</th><th>Present</th><th>Late</th><th>Absent</th><th>Leave</th>
              </tr>
            </thead>
            <tbody>
              {summary.length === 0 ? (
                <tr><td colSpan="5" className="att-empty">No data.</td></tr>
              ) : (
                summary.map((s) => (
                  <tr key={s.user_id}>
                    <td className="att-bold">{s.name}</td>
                    <td>{s.present_days}</td>
                    <td className="att-late-txt">{s.late_days}</td>
                    <td className="att-absent-txt">{s.absent_days}</td>
                    <td>{s.leave_days}</td>
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

export default Attendance;