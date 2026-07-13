import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import "./Damaged.css";

function Damaged() {
  const activeStoreId = Number(localStorage.getItem("activeStoreId")) || 1;
  const token = localStorage.getItem("token");

  const [products, setProducts] = useState([]);
  const [damagedItems, setDamagedItems] = useState([]);
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("Damaged");
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const headers = { Authorization: `Bearer ${token}` };

      const [productsRes, damagedRes] = await Promise.all([
        axios.get(`https://smart-cloud-pos.onrender.com/api/products?store_id=${activeStoreId}`, { headers }),
        axios.get(`https://smart-cloud-pos.onrender.com/api/damaged?store_id=${activeStoreId}`, { headers }),
      ]);

      setProducts(productsRes.data || []);
      setDamagedItems(damagedRes.data || []);
    } catch (err) {
      console.error(err);
      alert("Failed to load damaged items.");
    } finally {
      setLoading(false);
    }
  }, [activeStoreId, token]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!productId || !quantity) {
      alert("Select product and quantity.");
      return;
    }

    try {
      await axios.post(
        "https://smart-cloud-pos.onrender.com/api/damaged",
        {
          product_id: productId,
          quantity,
          reason,
          store_id: activeStoreId,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      alert("Damaged item added.");
      setProductId("");
      setQuantity("");
      setReason("Damaged");
      fetchData();
    } catch (err) {
      alert(err.response?.data?.message || "Failed");
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this damaged record?")) return;

    try {
      await axios.delete(`https://smart-cloud-pos.onrender.com/api/damaged/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      alert("Record deleted successfully.");
      fetchData();
    } catch (err) {
      alert(err.response?.data?.message || "Delete failed.");
    }
  };

  return (
    <div className="damaged-page">
      <div className="damaged-header">
        <div>
          <h2>📦 Damaged / Spoiled Products</h2>
          <p>Track damaged stock for your current outlet in one place.</p>
        </div>

        <div className="store-badge">
          <span>Current Store</span>
          <strong>#{activeStoreId}</strong>
        </div>
      </div>

      <div className="damaged-card">
        <form onSubmit={handleSubmit} className="damaged-form">
          <div className="field">
            <label>Product</label>
            <select value={productId} onChange={(e) => setProductId(e.target.value)} required>
              <option value="">Select Product</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} (Stock: {p.stock})
                </option>
              ))}
            </select>
          </div>

          <div className="field small">
            <label>Quantity</label>
            <input
              type="number"
              placeholder="Qty"
              value={quantity}
              min="1"
              onChange={(e) => setQuantity(e.target.value)}
              required
            />
          </div>

          <div className="field">
            <label>Reason</label>
            <input
              type="text"
              placeholder="Reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>

          <button type="submit" className="btn-danger">
            + Add Damaged
          </button>
        </form>
      </div>

      <div className="damaged-table-card">
        <div className="table-topbar">
          <h3>Damage Records</h3>
          <span>{damagedItems.length} item(s)</span>
        </div>

        <div className="table-wrap">
          <table className="premium-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Product</th>
                <th>Qty</th>
                <th>Reason</th>
                <th>Date</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="6" className="empty-cell">Loading...</td>
                </tr>
              ) : damagedItems.length === 0 ? (
                <tr>
                  <td colSpan="6" className="empty-cell">No damaged products found.</td>
                </tr>
              ) : (
                damagedItems.map((item) => (
                  <tr key={item.id}>
                    <td>#{item.id}</td>
                    <td className="bold">{item.product_name}</td>
                    <td>{item.quantity}</td>
                    <td>{item.reason}</td>
                    <td>{new Date(item.created_at).toLocaleString()}</td>
                    <td>
                      <button onClick={() => handleDelete(item.id)} className="btn-delete">
                        Delete
                      </button>
                    </td>
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

export default Damaged;