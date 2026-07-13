import React, { useState } from "react";
import axios from "axios";
import "./Settings.css";

const API = axios.create({
  baseURL: "https://smart-cloud-pos.onrender.com",
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
        </div>
      </div>
    </div>
  );
}

export default Account;

