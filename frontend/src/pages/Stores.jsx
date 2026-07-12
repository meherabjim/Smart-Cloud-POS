import React, { useEffect, useState } from "react";
import axios from "axios";
import "./Stores.css";

const API = "http://127.0.0.1:5000/api";

function Stores() {
  const token = localStorage.getItem("token");

  const config = {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  };

  const [stores, setStores] = useState([]);
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);

  const [activeStoreId, setActiveStoreId] = useState(
    localStorage.getItem("activeStoreId") || ""
  );

  const fetchStores = async () => {
    try {
      setLoading(true);

      const res = await axios.get(`${API}/stores`, config);
      setStores(res.data || []);

      if (!localStorage.getItem("activeStoreId") && res.data.length > 0) {
        localStorage.setItem("activeStoreId", res.data[0].id);
        setActiveStoreId(res.data[0].id);
      }
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || "Failed to load stores");
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

    if (!name || !location) {
      alert("Fill all fields");
      return;
    }

    try {
      const res = await axios.post(
        `${API}/stores/add`,
        {
          name,
          location,
        },
        config
      );

      alert(res.data.message);
      resetForm();
      fetchStores();
    } catch (err) {
      alert(err.response?.data?.message || "Error");
    }
  };

  const handleEdit = (store) => {
    setEditingId(store.id);
    setName(store.name);
    setLocation(store.location);
  };

  const handleUpdateStore = async (e) => {
    e.preventDefault();

    try {
      const res = await axios.put(
        `${API}/stores/${editingId}`,
        {
          name,
          location,
        },
        config
      );

      alert(res.data.message);
      resetForm();
      fetchStores();
    } catch (err) {
      alert(err.response?.data?.message || "Update Failed");
    }
  };

  const handleDeleteStore = async (id) => {
    if (parseInt(id) === 1) {
      alert("Main Store can't delete");
      return;
    }

    if (!window.confirm("Delete Store?")) return;

    try {
      const res = await axios.delete(`${API}/stores/${id}`, config);
      alert(res.data.message);

      if (Number(activeStoreId) === Number(id)) {
        localStorage.removeItem("activeStoreId");
        setActiveStoreId("");
      }

      fetchStores();
    } catch (err) {
      alert(err.response?.data?.message || "Delete Failed");
    }
  };

  const handleSwitchStore = (id) => {
    localStorage.setItem("activeStoreId", id);
    window.dispatchEvent(new Event("storeChanged"));
    setActiveStoreId(id);
    alert("Store Switched");
  };

  return (
    <div className="stores-page">
      <div className="stores-topbar">
        <div>
          <p className="stores-eyebrow">Branch Control</p>
          <h2 className="stores-title">🏪 Store Management</h2>
          <p className="stores-subtitle">
            Manage your branches and switch between stores.
          </p>
        </div>

        <div className="stores-active-badge">
          Active Store: #{activeStoreId || "N/A"}
        </div>
      </div>

      <form
        onSubmit={editingId ? handleUpdateStore : handleAddStore}
        className="stores-form-card"
      >
        <div className="stores-form-header">
          <div>
            <h3 className="stores-card-title">
              {editingId ? "Update Store" : "Add New Store"}
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
            <label className="stores-label">Store Name</label>
            <input
              type="text"
              placeholder="Enter store name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="stores-input"
            />
          </div>

          <div className="stores-input-group">
            <label className="stores-label">Location</label>
            <input
              type="text"
              placeholder="Enter location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              required
              className="stores-input"
            />
          </div>
        </div>

        <div className="stores-button-row">
          <button type="submit" className="stores-btn primary">
            {editingId ? "💾 Update Store" : "+ Add Store"}
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

      <div className="stores-table-card">
        <div className="stores-table-header">
          <div>
            <h3 className="stores-card-title">All Stores</h3>
            <p className="stores-card-text">
              View, edit, delete, and switch branch access.
            </p>
          </div>

          <div className="stores-count-badge">Total: {stores.length}</div>
        </div>

        <div className="stores-table-wrap">
          <table className="stores-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Store Name</th>
                <th>Location</th>
                <th>Status</th>
                <th className="stores-action-col">Action</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="5" className="stores-state-cell">
                    Loading stores...
                  </td>
                </tr>
              ) : stores.length === 0 ? (
                <tr>
                  <td colSpan="5" className="stores-state-cell">
                    No stores found.
                  </td>
                </tr>
              ) : (
                stores.map((store) => {
                  const active = Number(activeStoreId) === Number(store.id);

                  return (
                    <tr key={store.id}>
                      <td className="stores-td mono">#{store.id}</td>

                      <td className="stores-td">
                        <div className="stores-name-wrap">
                          <span className="stores-name">{store.name}</span>
                        </div>
                      </td>

                      <td className="stores-td">{store.location}</td>

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
                            onClick={() => handleSwitchStore(store.id)}
                            disabled={active}
                            className={`stores-action-btn switch ${
                              active ? "disabled" : ""
                            }`}
                          >
                            {active ? "Current" : "Switch"}
                          </button>

                          <button
                            onClick={() => handleEdit(store)}
                            className="stores-action-btn edit"
                          >
                            ✏ Edit
                          </button>

                          <button
                            onClick={() => handleDeleteStore(store.id)}
                            disabled={Number(store.id) === 1}
                            className={`stores-action-btn delete ${
                              Number(store.id) === 1 ? "disabled" : ""
                            }`}
                          >
                            🗑 Delete
                          </button>
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