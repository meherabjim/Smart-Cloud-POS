import React, { useCallback, useEffect, useState } from "react";
import axios from "axios";
import API_BASE_URL from "../apiConfig";
import PayoutForm from "../components/PayoutForm";
import "./Settings.css";

const API = axios.create({
  baseURL: API_BASE_URL,
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

function Account({ user, activeStoreId }) {
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  // Salary account + payslips
  const [payout, setPayout] = useState({ active: null, pending: null });
  const [payoutMsg, setPayoutMsg] = useState("");
  const [showChange, setShowChange] = useState(false);
  const [payslips, setPayslips] = useState([]);

  const loadPayout = useCallback(async () => {
    try {
      const [acc, sal] = await Promise.all([
        API.get("/api/payout/me"),
        API.get("/api/payout/my-salary"),
      ]);
      setPayout({ active: acc.data.active, pending: acc.data.pending });
      setPayslips(sal.data.payments || []);
    } catch (err) {
      // table may not be migrated yet — keep page usable
      setPayout({ active: null, pending: null });
    }
  }, []);

  useEffect(() => {
    loadPayout();
  }, [loadPayout]);

  const cancelPending = async () => {
    try {
      await API.delete("/api/payout/me/pending");
      setPayoutMsg("Change request cancelled.");
      loadPayout();
    } catch (err) {
      setPayoutMsg(err.response?.data?.message || "Could not cancel.");
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();

    setMessage("");
    setError("");

    if (!oldPassword.trim()) {
      setError("Current password dite hobe.");
      return;
    }

    if (!newPassword.trim() || newPassword.length < 6) {
      setError("New password kompokkhe 6 character howa lagbe.");
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setError("New password ar Confirm password mile nai.");
      return;
    }

    if (newPassword === oldPassword) {
      setError("New password purano password theke different howa lagbe.");
      return;
    }

    try {
      setLoading(true);

      const res = await API.put("/api/auth/change-password", {
        old_password: oldPassword,
        new_password: newPassword,
      });

      setMessage(res.data.message || "Password changed successfully.");
      setOldPassword("");
      setNewPassword("");
      setConfirmNewPassword("");
    } catch (err) {
      setError(err.response?.data?.message || "Password change failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="settings-page">
      <div className="settings-shell">
        <header className="settings-header">
          <p className="settings-eyebrow">Your account</p>
          <h1 className="settings-title">My Account</h1>
          <p className="settings-subtitle">
            View your account details and update your own login password.
          </p>
        </header>

        <div className="settings-grid">
          <section className="settings-card">
            <div className="settings-card-head">
              <h2>Account Information</h2>
              <p>Your current login details.</p>
            </div>

            <div className="settings-info-list">
              <div className="settings-info-item">
                <span>Username</span>
                <strong>{user?.name || user?.username || "-"}</strong>
              </div>
              <div className="settings-info-item">
                <span>Email</span>
                <strong>{user?.email || "-"}</strong>
              </div>
              <div className="settings-info-item">
                <span>Role</span>
                <strong>{user?.role || "-"}</strong>
              </div>
              <div className="settings-info-item">
                <span>Store</span>
                <strong>
                  {user?.role === "Admin" ? "All Stores" : `Store #${activeStoreId || "-"}`}
                </strong>
              </div>
            </div>
          </section>

          <section className="settings-card">
            <div className="settings-card-head">
              <h2>Change Password</h2>
              <p>Update your own login password. Your current password is required to confirm.</p>
            </div>

            {message ? <div className="settings-alert success">{message}</div> : null}
            {error ? <div className="settings-alert danger">{error}</div> : null}

            <form className="settings-form" onSubmit={handleChangePassword}>
              <div className="form-group">
                <label htmlFor="oldPassword">Current Password</label>
                <input
                  id="oldPassword"
                  type="password"
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  placeholder="Enter your current password"
                  autoComplete="current-password"
                />
              </div>

              <div className="form-group">
                <label htmlFor="newPassword">New Password</label>
                <input
                  id="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  autoComplete="new-password"
                />
              </div>

              <div className="form-group">
                <label htmlFor="confirmNewPassword">Confirm New Password</label>
                <input
                  id="confirmNewPassword"
                  type="password"
                  value={confirmNewPassword}
                  onChange={(e) => setConfirmNewPassword(e.target.value)}
                  placeholder="Re-type new password"
                  autoComplete="new-password"
                />
              </div>

              <button type="submit" className="settings-btn" disabled={loading}>
                {loading ? "Updating..." : "Update Password"}
              </button>
            </form>
          </section>

          <section className="settings-card">
            <div className="settings-card-head">
              <h2>Salary Account</h2>
              <p>Where your monthly salary goes.</p>
            </div>

            {payoutMsg ? <div className="settings-alert success">{payoutMsg}</div> : null}

            <div className="settings-info-list">
              <div className="settings-info-item">
                <span>Current</span>
                <strong>{payout.active ? payout.active.label : "Cash (no account set)"}</strong>
              </div>
              {payout.active?.account_name ? (
                <div className="settings-info-item">
                  <span>Account name</span>
                  <strong>{payout.active.account_name}</strong>
                </div>
              ) : null}
              {payout.pending ? (
                <div className="settings-info-item">
                  <span>Waiting for Admin</span>
                  <strong>
                    {payout.pending.label}{" "}
                    <button
                      type="button"
                      onClick={cancelPending}
                      style={{ marginLeft: 8, border: 0, background: "none", color: "#b91c1c", cursor: "pointer", fontWeight: 700 }}
                    >
                      Cancel
                    </button>
                  </strong>
                </div>
              ) : null}
            </div>

            {user?.role === "Viewer" ? null : showChange || !payout.active ? (
              <div style={{ marginTop: 14 }}>
                <PayoutForm
                  mode={payout.active ? "change" : "setup"}
                  onSaved={(data) => {
                    setPayoutMsg(data?.message || "Saved.");
                    setShowChange(false);
                    loadPayout();
                  }}
                />
              </div>
            ) : (
              <button
                type="button"
                className="settings-btn"
                style={{ marginTop: 14 }}
                onClick={() => {
                  setPayoutMsg("");
                  setShowChange(true);
                }}
              >
                Change salary account
              </button>
            )}
          </section>

          <section className="settings-card">
            <div className="settings-card-head">
              <h2>My Salary</h2>
              <p>Every payment with the absent / late cut and where it went.</p>
            </div>

            {payslips.length === 0 ? (
              <p style={{ color: "#64748b", margin: 0 }}>No salary paid yet.</p>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, fontVariantNumeric: "tabular-nums" }}>
                  <thead>
                    <tr style={{ textAlign: "left", color: "#64748b" }}>
                      <th style={{ padding: "6px 8px" }}>Month</th>
                      <th style={{ padding: "6px 8px" }}>Salary</th>
                      <th style={{ padding: "6px 8px" }}>Absent cut</th>
                      <th style={{ padding: "6px 8px" }}>Late cut</th>
                      <th style={{ padding: "6px 8px" }}>Got</th>
                      <th style={{ padding: "6px 8px" }}>Paid to</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payslips.map((p) => (
                      <tr key={p.id} style={{ borderTop: "1px solid #e2e8f0" }}>
                        <td style={{ padding: "6px 8px" }}>{p.month}/{p.year}</td>
                        <td style={{ padding: "6px 8px" }}>৳ {p.base_salary.toLocaleString()}</td>
                        <td style={{ padding: "6px 8px", color: "#b91c1c" }}>
                          −{p.absent_deduction.toLocaleString()} <small>({p.absent_days}d)</small>
                        </td>
                        <td style={{ padding: "6px 8px", color: "#b45309" }}>
                          −{p.late_deduction.toLocaleString()} <small>({p.late_days} late)</small>
                        </td>
                        <td style={{ padding: "6px 8px", fontWeight: 800 }}>৳ {p.net_paid.toLocaleString()}</td>
                        <td style={{ padding: "6px 8px" }}>
                          {p.paid_to}
                          {p.is_demo ? (
                            <span style={{ marginLeft: 6, padding: "1px 6px", borderRadius: 6, background: "#fef3c7", color: "#92400e", fontSize: 10, fontWeight: 800 }}>
                              DEMO
                            </span>
                          ) : null}
                          <div style={{ fontSize: 11, color: "#94a3b8" }}>{p.txn_ref}</div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

export default Account;