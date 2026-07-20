import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import API_BASE_URL from "../apiConfig";
import "./Stores.css";

const API = `${API_BASE_URL}/api`;

function Stores() {
  const currentUser = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("user") || "{}");
    } catch (error) {
      console.error("Invalid user information:", error);
      return {};
    }
  }, []);

  const isViewer = currentUser.role === "Viewer";
  const canManageStores = currentUser.role === "Admin";

  const token = localStorage.getItem("token");

  const config = useMemo(
    () => ({
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }),
    [token]
  );

  const [stores, setStores] = useState([]);
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState("");

  const [activeStoreId, setActiveStoreId] = useState(
    localStorage.getItem("activeStoreId") || ""
  );

  const fetchStores = async () => {
    try {
      setLoading(true);
      setError("");

      const res = await axios.get(`${API}/stores`, config);
      const storeList = Array.isArray(res.data) ? res.data : [];

      setStores(storeList);

      const savedStoreId = localStorage.getItem("activeStoreId");

      if (!savedStoreId && storeList.length > 0) {
        const firstStoreId = storeList[0].id;

        localStorage.setItem("activeStoreId", String(firstStoreId));
        setActiveStoreId(String(firstStoreId));
      }
    } catch (err) {
      console.error("Store loading error:", err);

      setError(
        err.response?.data?.message ||
          "Failed to load stores."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStores();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const resetForm = () => {
    setEditingId(null);
    setName("");
    setLocation("");
  };

  const handleAddStore = async (e) => {
    e.preventDefault();

    if (!canManageStores) {
      alert("Viewer has read-only access.");
      return;
    }

    if (!name.trim() || !location.trim()) {
      alert("Fill all fields.");
      return;
    }

    try {
      const res = await axios.post(
        `${API}/stores/add`,
        {
          name: name.trim(),
          location: location.trim(),
        },
        config
      );

      alert(res.data.message || "Store added successfully.");

      resetForm();
      fetchStores();
    } catch (err) {
      alert(
        err.response?.data?.message ||
          "Failed to add store."
      );
    }
  };

  const handleEdit = (store) => {
    if (!canManageStores) {
      return;
    }

    setEditingId(store.id);
    setName(store.name || "");
    setLocation(store.location || "");

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  const handleUpdateStore = async (e) => {
    e.preventDefault();

    if (!canManageStores) {
      alert("Viewer has read-only access.");
      return;
    }

    if (!editingId) {
      return;
    }

    if (!name.trim() || !location.trim()) {
      alert("Fill all fields.");
      return;
    }

    try {
      const res = await axios.put(
        `${API}/stores/${editingId}`,
        {
          name: name.trim(),
          location: location.trim(),
        },
        config
      );

      alert(res.data.message || "Store updated successfully.");

      resetForm();
      fetchStores();
    } catch (err) {
      alert(
        err.response?.data?.message ||
          "Store update failed."
      );
    }
  };

  const handleDeleteStore = async (id) => {
    if (!canManageStores) {
      alert("Viewer has read-only access.");
      return;
    }

    if (Number(id) === 1) {
      alert("Main Store cannot be deleted.");
      return;
    }

    const confirmed = window.confirm(
      "Are you sure you want to delete this store?"
    );

    if (!confirmed) {
      return;
    }

    try {
      const res = await axios.delete(
        `${API}/stores/${id}`,
        config
      );

      alert(res.data.message || "Store deleted successfully.");

      if (Number(activeStoreId) === Number(id)) {
        localStorage.removeItem("activeStoreId");
        setActiveStoreId("");
      }

      fetchStores();
    } catch (err) {
      alert(
        err.response?.data?.message ||
          "Store delete failed."
      );
    }
  };

  const handleSwitchStore = (id) => {
    const selectedStoreId = String(id);

    localStorage.setItem(
      "activeStoreId",
      selectedStoreId
    );

    setActiveStoreId(selectedStoreId);

    window.dispatchEvent(
      new CustomEvent("storeChanged", {
        detail: {
          storeId: Number(id),
        },
      })
    );
  };

  return (
    <div className="stores-page">
      {isViewer && (
        <div
          style={{
            padding: "12px 14px",
            marginBottom: "16px",
            border: "1px solid #bfdbfe",
            borderRadius: "10px",
            background: "#eff6ff",
            color: "#1e40af",
            fontWeight: 600,
          }}
        >
          👁 Demo Viewer mode: You can view and switch stores,
          but you cannot add, edit or delete a store.
        </div>
      )}

      <div className="stores-topbar">
        <div>
          <p className="stores-eyebrow">
            Branch Control
          </p>

          <h2 className="stores-title">
            🏪 Store Management
          </h2>

          <p className="stores-subtitle">
            View branches and switch between stores.
          </p>
        </div>

        <div className="stores-active-badge">
          Active Store: #{activeStoreId || "N/A"}
        </div>
      </div>

      {canManageStores && (
        <form
          onSubmit={
            editingId
              ? handleUpdateStore
              : handleAddStore
          }
          className="stores-form-card"
        >
          <div className="stores-form-header">
            <div>
              <h3 className="stores-card-title">
                {editingId
                  ? "Update Store"
                  : "Add New Store"}
              </h3>

              <p className="stores-card-text">
                {editingId
                  ? "Edit branch name and location."
                  : "Create a new store branch for your business."}
              </p>
            </div>
          </div>

          <div className="stores-form-grid">
            <div className="stores-input-group">
              <label className="stores-label">
                Store Name
              </label>

              <input
                type="text"
                placeholder="Enter store name"
                value={name}
                onChange={(e) =>
                  setName(e.target.value)
                }
                required
                className="stores-input"
              />
            </div>

            <div className="stores-input-group">
              <label className="stores-label">
                Location
              </label>

              <input
                type="text"
                placeholder="Enter location"
                value={location}
                onChange={(e) =>
                  setLocation(e.target.value)
                }
                required
                className="stores-input"
              />
            </div>
          </div>

          <div className="stores-button-row">
            <button
              type="submit"
              className="stores-btn primary"
            >
              {editingId
                ? "💾 Update Store"
                : "+ Add Store"}
            </button>

            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="stores-btn secondary"
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      )}

      <div className="stores-table-card">
        <div className="stores-table-header">
          <div>
            <h3 className="stores-card-title">
              All Stores
            </h3>

            <p className="stores-card-text">
              {isViewer
                ? "View and switch between available stores."
                : "View, edit, delete and switch branch access."}
            </p>
          </div>

          <div className="stores-count-badge">
            Total: {stores.length}
          </div>
        </div>

        {error && (
          <div
            style={{
              padding: "12px",
              margin: "12px",
              borderRadius: "8px",
              background: "#fef2f2",
              color: "#b91c1c",
            }}
          >
            {error}

            <button
              type="button"
              onClick={fetchStores}
              style={{
                marginLeft: "12px",
              }}
            >
              Retry
            </button>
          </div>
        )}

        <div className="stores-table-wrap">
          <table className="stores-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Store Name</th>
                <th>Location</th>
                <th>Status</th>
                <th className="stores-action-col">
                  Action
                </th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan="5"
                    className="stores-state-cell"
                  >
                    Loading stores...
                  </td>
                </tr>
              ) : stores.length === 0 ? (
                <tr>
                  <td
                    colSpan="5"
                    className="stores-state-cell"
                  >
                    No stores found.
                  </td>
                </tr>
              ) : (
                stores.map((store) => {
                  const active =
                    Number(activeStoreId) ===
                    Number(store.id);

                  return (
                    <tr key={store.id}>
                      <td className="stores-td mono">
                        #{store.id}
                      </td>

                      <td className="stores-td">
                        <div className="stores-name-wrap">
                          <span className="stores-name">
                            {store.name}
                          </span>
                        </div>
                      </td>

                      <td className="stores-td">
                        {store.location}
                      </td>

                      <td className="stores-td">
                        {active ? (
                          <span className="stores-status-chip active">
                            ✅ Active
                          </span>
                        ) : (
                          <span className="stores-status-chip inactive">
                            Inactive
                          </span>
                        )}
                      </td>

                      <td className="stores-td">
                        <div className="stores-action-row">
                          <button
                            type="button"
                            onClick={() =>
                              handleSwitchStore(
                                store.id
                              )
                            }
                            disabled={active}
                            className={`stores-action-btn switch ${
                              active
                                ? "disabled"
                                : ""
                            }`}
                          >
                            {active
                              ? "Current"
                              : isViewer
                                ? "View"
                                : "Switch"}
                          </button>

                          {canManageStores && (
                            <>
                              <button
                                type="button"
                                onClick={() =>
                                  handleEdit(store)
                                }
                                className="stores-action-btn edit"
                              >
                                ✏ Edit
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  handleDeleteStore(
                                    store.id
                                  )
                                }
                                disabled={
                                  Number(store.id) === 1
                                }
                                className={`stores-action-btn delete ${
                                  Number(store.id) === 1
                                    ? "disabled"
                                    : ""
                                }`}
                              >
                                🗑 Delete
                              </button>
                            </>
                          )}
                        </div>
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

export default Stores;