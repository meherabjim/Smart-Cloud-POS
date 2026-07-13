import React, { useState, useEffect, useCallback, useMemo } from "react";
import axios from "axios";
import "./Users.css";

function Users() {
  const activeStoreId = Number(localStorage.getItem("activeStoreId")) || 1;
  const token = localStorage.getItem("token");

  const config = useMemo(
    () => ({
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }),
    [token]
  );

  const [users, setUsers] = useState([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("Manager");
  const [loading, setLoading] = useState(true);

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);

      const res = await axios.get(
        `https://smart-cloud-pos.onrender.com/api/users?store_id=${activeStoreId}`,
        config
      );

      setUsers(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("Error fetching users:", err);
      alert(err.response?.data?.message || "Failed to load users");
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, [activeStoreId, config]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleAddUser = async (e) => {
    e.preventDefault();

    if (!name || !email || !role || !password) {
      alert("Please fill up all required fields!");
      return;
    }

    const payload = {
      name,
      email,
      role,
      password,
      store_id: activeStoreId,
    };

    try {
      const res = await axios.post(
        "https://smart-cloud-pos.onrender.com/api/users/add",
        payload,
        config
      );

      alert(res.data?.message || "User added successfully!");

      setName("");
      setEmail("");
      setPassword("");
      setRole("Manager");

      fetchUsers();
    } catch (err) {
      alert(err.response?.data?.message || "Failed to add user.");
    }
  };

  const handleDeleteUser = async (userId) => {
    if (parseInt(userId) === 1 || parseInt(userId) === 2) {
      alert("Main admin cannot be deleted for system safety!");
      return;
    }

    if (window.confirm("Are you sure you want to delete this staff member?")) {
      try {
        const res = await axios.delete(
          `https://smart-cloud-pos.onrender.com/api/users/${userId}`,
          config
        );

        alert(res.data?.message || "User deleted.");
        fetchUsers();
      } catch (err) {
        alert(err.response?.data?.message || "Failed to delete user");
      }
    }
  };

  const getRoleClass = (userRole) => {
    if (userRole === "Admin") return "admin";
    if (userRole === "Cashier") return "cashier";
    if (userRole === "Store Keeper") return "keeper";
    return "manager";
  };

  return (
    <div className="users-page">
      <div className="users-header">
        <div>
          <p className="users-eyebrow">Staff Control</p>
          <h2 className="users-title">User Management</h2>
          <p className="users-active-store">🏪 Current Store: #{activeStoreId}</p>
          <p className="users-subtitle">
            Manage staff accounts, roles, and permissions.
          </p>
        </div>
      </div>

      <form onSubmit={handleAddUser} className="users-form-card">
        <div className="users-form-header">
          <h3 className="users-section-title">Add New User</h3>
          <p className="users-section-text">
            Create a staff account for the current store.
          </p>
        </div>

        <div className="users-form-grid">
          <input
            type="text"
            placeholder="Full Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="users-input"
            required
          />

          <input
            type="email"
            placeholder="Email Address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="users-input"
            required
          />

          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="users-input"
            required
          />

          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="users-select"
          >
            <option value="Manager">Manager</option>
            <option value="Cashier">Cashier</option>
            <option value="Store Keeper">Store Keeper</option>
            <option value="Viewer">Viewer</option>
          </select>

          <button type="submit" className="users-add-button">
            + Add User
          </button>
        </div>
      </form>

      <div className="users-table-card">
        <div className="users-table-header">
          <div>
            <h3 className="users-section-title">Users List</h3>
            <p className="users-section-text">
              All staff under store #{activeStoreId}
            </p>
          </div>

          <button type="button" onClick={fetchUsers} className="users-refresh-button">
            Refresh
          </button>
        </div>

        <div className="users-table-wrap">
          <table className="users-table">
            <thead>
              <tr>
                <th>User ID</th>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Password</th>
                <th className="users-action-col">Action</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="6" className="users-center-cell">
                    Loading users...
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan="6" className="users-center-cell">
                    No users found.
                  </td>
                </tr>
              ) : (
                users.map((u) => {
                  const isProtected =
                    parseInt(u.id) === 1 || parseInt(u.id) === 2;

                  return (
                    <tr key={u.id}>
                      <td className="users-td mono">#{u.id}</td>

                      <td className="users-td users-td-bold">{u.name}</td>

                      <td className="users-td">{u.email}</td>

                      <td className="users-td">
                        <span className={`users-role-badge ${getRoleClass(u.role)}`}>
                          {u.role || "Manager"}
                        </span>
                      </td>

                      <td className="users-td">
                        <code className="users-code">Hidden</code>
                      </td>

                      <td className="users-td">
                        <button
                          type="button"
                          onClick={() => handleDeleteUser(u.id)}
                          disabled={isProtected}
                          className={`users-delete-button ${
                            isProtected ? "disabled" : ""
                          }`}
                        >
                          🗑 Delete
                        </button>
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

export default Users;