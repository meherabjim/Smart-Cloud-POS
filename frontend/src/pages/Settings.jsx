import React, { useEffect, useState } from "react";
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

function Settings({ user, activeStoreId }) {
  const [stores, setStores] = useState([]);
  const [scope, setScope] = useState("single"); // "single" | "all"
  const [selectedStoreId, setSelectedStoreId] = useState(activeStoreId || "");
  const [confirmEmail, setConfirmEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loadingReset, setLoadingReset] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const adminEmail = (user?.email || "").trim().toLowerCase();

  useEffect(() => {
    const loadStores = async () => {
      try {
        const res = await API.get("/api/stores");
        setStores(res.data || []);
      } catch (err) {
        // Store list only populates the dropdown; if it fails, the
        // current store is still selectable via activeStoreId.
        setStores([]);
      }
    };

    loadStores();
  }, []);

  const handleResetDemo = async (e) => {
    e.preventDefault();

    setMessage("");
    setError("");

    const typedEmail = confirmEmail.trim().toLowerCase();

    if (!typedEmail) {
      setError("Admin email diye confirm korte hobe.");
      return;
    }

    if (typedEmail !== adminEmail) {
      setError("Confirmation email apnar account email er sathe mile nai.");
      return;
    }

    if (!password.trim()) {
      setError("Password dewa lagbe.");
      return;
    }

    if (scope === "single" && !selectedStoreId) {
      setError("Reset korar jonno ekta store select korun.");
      return;
    }

    try {
      setLoadingReset(true);

      const res = await API.post("/api/settings/reset-demo", {
        password,
        store_id: scope === "all" ? "all" : selectedStoreId,
      });

      setMessage(res.data.message);
      setConfirmEmail("");
      setPassword("");
    } catch (err) {
      setError(err.response?.data?.message || "Reset Failed");
    } finally {
      setLoadingReset(false);
    }
  };

  return (
    <div className="settings-page">
      <div className="settings-shell">
        <header className="settings-header">
          <p className="settings-eyebrow">System configuration</p>
          <h1 className="settings-title">Settings</h1>
          <p className="settings-subtitle">
            Store info, reset tools, and account safety controls.
          </p>
        </header>

        {message ? <div className="settings-alert success">{message}</div> : null}
        {error ? <div className="settings-alert danger">{error}</div> : null}

        <div className="settings-grid">
          <section className="settings-card">
            <div className="settings-card-head">
              <h2>Store Information</h2>
              <p>Current logged in account and store details.</p>
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
                <span>Store ID</span>
                <strong>{activeStoreId || "-"}</strong>
              </div>
            </div>
          </section>

          <section className="settings-card">
            <div className="settings-card-head">
              <h2>Reset Instructions</h2>
              <p>Choose a scope, then confirm with your email and password.</p>
            </div>

            <div className="settings-info-list">
              <div className="settings-info-item">
                <span>Required email</span>
                <strong>{user?.email || "-"}</strong>
              </div>
              <div className="settings-info-item">
                <span>Need password</span>
                <strong>Yes</strong>
              </div>
              <div className="settings-info-item">
                <span>Scope options</span>
                <strong>One store / All stores</strong>
              </div>
              <div className="settings-info-item">
                <span>Route</span>
                <strong>/api/settings/reset-demo</strong>
              </div>
            </div>
          </section>
        </div>

        <section className="settings-card danger-zone">
          <div className="settings-card-head">
            <h2>Danger Zone</h2>
            <p>This action permanently deletes sales, products, damaged and inventory-history records.</p>
          </div>

          <form className="settings-form" onSubmit={handleResetDemo}>
            <div className="form-group">
              <label>Reset Scope</label>
              <div className="scope-toggle">
                <button
                  type="button"
                  className={`scope-btn ${scope === "single" ? "active" : ""}`}
                  onClick={() => setScope("single")}
                >
                  This store only
                </button>
                <button
                  type="button"
                  className={`scope-btn ${scope === "all" ? "active" : ""}`}
                  onClick={() => setScope("all")}
                >
                  All stores
                </button>
              </div>
            </div>

            {scope === "single" && (
              <div className="form-group">
                <label htmlFor="storeSelect">Select Store</label>
                <select
                  id="storeSelect"
                  value={selectedStoreId}
                  onChange={(e) => setSelectedStoreId(e.target.value)}
                >
                  <option value="">-- Select a store --</option>
                  {stores.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} (Store #{s.id})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="form-group">
              <label htmlFor="confirmEmail">Confirm Admin Email</label>
              <input
                id="confirmEmail"
                type="email"
                value={confirmEmail}
                onChange={(e) => setConfirmEmail(e.target.value)}
                placeholder={user?.email || "Type your admin email"}
                autoComplete="off"
              />
            </div>

            <div className="form-group">
              <label htmlFor="password">Your Password</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
              />
            </div>

            <button
              type="submit"
              className="settings-btn danger"
              disabled={loadingReset}
            >
              {loadingReset
                ? "Resetting..."
                : scope === "all"
                ? "Reset All Stores"
                : "Reset This Store"}
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}

export default Settings;

