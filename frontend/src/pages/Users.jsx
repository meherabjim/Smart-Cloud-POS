import React, { useState, useEffect, useCallback, useMemo } from "react";
import axios from "axios";
import API_BASE_URL from "../apiConfig";
import "./Users.css";
import { toast } from "../components/Toast";

// ADMIN ONLY: every worker in every store, with store name,
// this month's attendance (present / late / absent / leave),
// face status and salary account.
function Users() {
  const activeStoreId = Number(localStorage.getItem("activeStoreId")) || 1;
  const token = localStorage.getItem("token");
  const now = new Date();

  const config = useMemo(() => ({ headers: { Authorization: `Bearer ${token}` } }), [token]);

  const [users, setUsers] = useState([]);
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);

  // filters
  const [storeFilter, setStoreFilter] = useState("all");
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [search, setSearch] = useState("");

  // edit role/store: { id, role, store_id } while a row is being edited
  const [editing, setEditing] = useState(null);
  // pairs of accounts that hold the same person's face
  const [dupes, setDupes] = useState([]);

  // add form
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("Cashier");
  const [newStore, setNewStore] = useState(activeStoreId);

  useEffect(() => {
    axios
      .get(`${API_BASE_URL}/api/stores`, config)
      .then((res) => setStores(Array.isArray(res.data) ? res.data : []))
      .catch(() => setStores([]));
  }, [config]);

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      const res = await axios.get(
        `${API_BASE_URL}/api/users?store_id=${storeFilter}&year=${year}&month=${month}`,
        config
      );
      setUsers(Array.isArray(res.data) ? res.data : []);
      axios
        .get(`${API_BASE_URL}/api/face/duplicates`, config)
        .then((r) => setDupes(r.data.pairs || []))
        .catch(() => setDupes([]));
    } catch (err) {
      toast(err.response?.data?.message || "Failed to load workers");
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, [storeFilter, year, month, config]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleAddUser = async (e) => {
    e.preventDefault();
    if (!name || !email || !role || !password) {
      toast("Please fill up all required fields!");
      return;
    }
    try {
      const res = await axios.post(
        `${API_BASE_URL}/api/users/add`,
        { name, email, role, password, store_id: Number(newStore) },
        config
      );
      toast(res.data?.message || "User added successfully!");
      setName("");
      setEmail("");
      setPassword("");
      setRole("Cashier");
      fetchUsers();
    } catch (err) {
      toast(err.response?.data?.message || "Failed to add user.");
    }
  };

  const handleDeleteUser = async (userId) => {
    if (parseInt(userId, 10) === 1 || parseInt(userId, 10) === 2) {
      toast("Main admin cannot be deleted for system safety!");
      return;
    }
    if (!window.confirm("Are you sure you want to delete this staff member?")) return;
    try {
      const res = await axios.delete(`${API_BASE_URL}/api/users/${userId}`, config);
      toast(res.data?.message || "User deleted.");
      fetchUsers();
    } catch (err) {
      toast(err.response?.data?.message || "Failed to delete user");
    }
  };

  const handleSaveEdit = async () => {
    try {
      const res = await axios.put(
        `${API_BASE_URL}/api/users/${editing.id}`,
        { role: editing.role, store_id: Number(editing.store_id) },
        config
      );
      toast(res.data?.message || "Worker updated.");
      setEditing(null);
      fetchUsers();
    } catch (err) {
      toast(err.response?.data?.message || "Failed to update worker");
    }
  };

  // user id -> names of other accounts with the same face
  const dupMap = useMemo(() => {
    const map = {};
    dupes.forEach(({ a, b }) => {
      (map[a.id] = map[a.id] || []).push(`${b.name} (${b.role})`);
      (map[b.id] = map[b.id] || []).push(`${a.name} (${a.role})`);
    });
    return map;
  }, [dupes]);

  const handleResetFace = async (u) => {
    if (!window.confirm(`Reset face of ${u.name}? They must register again at next login.`)) return;
    try {
      const res = await axios.post(`${API_BASE_URL}/api/face/reset/${u.id}`, {}, config);
      toast(res.data?.message || "Face reset.");
      fetchUsers();
    } catch (err) {
      toast(err.response?.data?.message || "Failed to reset face");
    }
  };

  const getRoleClass = (userRole) => {
    if (userRole === "Admin") return "admin";
    if (userRole === "Cashier") return "cashier";
    if (userRole === "Store Keeper") return "keeper";
    return "manager";
  };

  const shown = users.filter((u) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      String(u.name || "").toLowerCase().includes(q) ||
      String(u.email || "").toLowerCase().includes(q) ||
      String(u.store_name || "").toLowerCase().includes(q)
    );
  });

  const totals = shown.reduce(
    (a, u) => ({
      present: a.present + u.present_days,
      late: a.late + u.late_days,
      absent: a.absent + u.absent_days,
      leave: a.leave + u.leave_days,
    }),
    { present: 0, late: 0, absent: 0, leave: 0 }
  );

  const storeName = (id) => stores.find((s) => Number(s.id) === Number(id))?.name || `Store #${id}`;

  return (
    <div className="users-page">
      <div className="users-header">
        <div>
          <p className="users-eyebrow">Admin only</p>
          <h2 className="users-title">All Workers</h2>
          <p className="users-subtitle">
            Every staff member in every store — which store they work in, this month's
            attendance and where their salary goes.
          </p>
        </div>
      </div>

      <div className="users-stats">
        <div className="users-stat"><span>Workers</span><strong>{shown.length}</strong></div>
        <div className="users-stat ok"><span>Present days</span><strong>{totals.present}</strong></div>
        <div className="users-stat warn"><span>Late days</span><strong>{totals.late}</strong></div>
        <div className="users-stat bad"><span>Absent days</span><strong>{totals.absent}</strong></div>
        <div className="users-stat"><span>Leave days</span><strong>{totals.leave}</strong></div>
      </div>

      <div className="users-table-card">
        <div className="users-table-header">
          <div>
            <h3 className="users-section-title">Workers List</h3>
            <p className="users-section-text">
              Attendance for {month}/{year} · {storeFilter === "all" ? "all stores" : storeName(storeFilter)}
            </p>
          </div>

          <div className="users-filters">
            <input
              className="users-input"
              placeholder="Search name / email / store"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <select className="users-select" value={storeFilter} onChange={(e) => setStoreFilter(e.target.value)}>
              <option value="all">All stores</option>
              {stores.map((s) => (
                <option key={s.id} value={s.id}>{s.name || `Store #${s.id}`}</option>
              ))}
            </select>
            <select className="users-select" value={month} onChange={(e) => setMonth(Number(e.target.value))}>
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <option key={m} value={m}>Month {m}</option>
              ))}
            </select>
            <input
              className="users-input"
              type="number"
              style={{ width: 90 }}
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
            />
            <button type="button" onClick={fetchUsers} className="users-refresh-button">Refresh</button>
          </div>
        </div>

        {dupes.length > 0 && (
          <div className="users-dup-banner">
            <strong>⚠ Same face on more than one account</strong>
            <span>The attendance camera cannot tell these apart. Reset the face on the old account (or delete it):</span>
            <ul>
              {dupes.map(({ a, b }) => (
                <li key={`${a.id}-${b.id}`}>
                  {a.name} ({a.role}, {a.store_name || "—"}) ⇄ {b.name} ({b.role}, {b.store_name || "—"})
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="users-table-wrap">
          <table className="users-table wide">
            <thead>
              <tr>
                <th>Worker</th>
                <th>Store</th>
                <th>Role</th>
                <th className="num">Present</th>
                <th className="num">Late</th>
                <th className="num">Absent</th>
                <th className="num">Leave</th>
                <th>Face</th>
                <th>Salary account</th>
                <th className="users-action-col">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="10" className="users-center-cell">Loading workers...</td></tr>
              ) : shown.length === 0 ? (
                <tr><td colSpan="10" className="users-center-cell">No workers found.</td></tr>
              ) : (
                shown.map((u) => {
                  const isProtected = parseInt(u.id, 10) === 1 || parseInt(u.id, 10) === 2;
                  const canEdit = !isProtected && u.role !== "Admin";
                  const isEditing = editing && editing.id === u.id;
                  return (
                    <tr key={u.id}>
                      <td className="users-td">
                        <div className="users-td-bold">{u.name}</div>
                        <div className="users-muted">{u.email}</div>
                      </td>
                      <td className="users-td">
                        {isEditing ? (
                          <select
                            className="users-select users-edit-select"
                            value={editing.store_id}
                            onChange={(e) => setEditing({ ...editing, store_id: e.target.value })}
                          >
                            {stores.map((s) => (
                              <option key={s.id} value={s.id}>{s.name || `Store #${s.id}`}</option>
                            ))}
                          </select>
                        ) : (
                          <span className="users-store">{u.store_name || (u.store_id ? `Store #${u.store_id}` : "—")}</span>
                        )}
                      </td>
                      <td className="users-td">
                        {isEditing ? (
                          <select
                            className="users-select users-edit-select"
                            value={editing.role}
                            onChange={(e) => setEditing({ ...editing, role: e.target.value })}
                          >
                            <option value="Manager">Manager</option>
                            <option value="Cashier">Cashier</option>
                            <option value="Store Keeper">Store Keeper</option>
                          </select>
                        ) : (
                          <span className={`users-role-badge ${getRoleClass(u.role)}`}>{u.role}</span>
                        )}
                      </td>
                      <td className="users-td num att-ok">{u.present_days}</td>
                      <td className="users-td num att-warn">{u.late_days}</td>
                      <td className="users-td num att-bad">{u.absent_days}</td>
                      <td className="users-td num">{u.leave_days}</td>
                      <td className="users-td">
                        {u.face_registered ? (
                          <span className="users-pill ok">Registered</span>
                        ) : (
                          <span className="users-pill">Not yet</span>
                        )}
                        {dupMap[u.id] && (
                          <div className="users-dup">⚠ Same face as {dupMap[u.id].join(", ")}</div>
                        )}
                      </td>
                      <td className="users-td">
                        {u.pay_label}
                        {u.pending_change && <div className="users-pending">Change request pending (Salary page)</div>}
                      </td>
                      <td className="users-td users-actions">
                        {isEditing ? (
                          <>
                            <button type="button" className="users-small-button save" onClick={handleSaveEdit}>
                              Save
                            </button>
                            <button type="button" className="users-small-button" onClick={() => setEditing(null)}>
                              Cancel
                            </button>
                          </>
                        ) : (
                          canEdit && (
                            <button
                              type="button"
                              className="users-small-button"
                              onClick={() => setEditing({ id: u.id, role: u.role, store_id: u.store_id || stores[0]?.id })}
                            >
                              ✏ Edit
                            </button>
                          )
                        )}
                        {u.face_registered && (
                          <button type="button" className="users-small-button" onClick={() => handleResetFace(u)}>
                            Reset face
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleDeleteUser(u.id)}
                          disabled={isProtected}
                          className={`users-delete-button ${isProtected ? "disabled" : ""}`}
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

      <form onSubmit={handleAddUser} className="users-form-card">
        <div className="users-form-header">
          <h3 className="users-section-title">Add New Worker</h3>
          <p className="users-section-text">Create a staff account and choose which store they work in.</p>
        </div>

        <div className="users-form-grid">
          <input type="text" placeholder="Full Name" value={name} onChange={(e) => setName(e.target.value)} className="users-input" required />
          <input type="email" placeholder="Email Address" value={email} onChange={(e) => setEmail(e.target.value)} className="users-input" required />
          <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} className="users-input" required />
          <select value={role} onChange={(e) => setRole(e.target.value)} className="users-select">
            <option value="Manager">Manager</option>
            <option value="Cashier">Cashier</option>
            <option value="Store Keeper">Store Keeper</option>
          </select>
          <select value={newStore} onChange={(e) => setNewStore(e.target.value)} className="users-select">
            {stores.length === 0 && <option value={activeStoreId}>Store #{activeStoreId}</option>}
            {stores.map((s) => (
              <option key={s.id} value={s.id}>{s.name || `Store #${s.id}`}</option>
            ))}
          </select>
          <button type="submit" className="users-add-button">+ Add Worker</button>
        </div>
      </form>
    </div>
  );
}

export default Users;
