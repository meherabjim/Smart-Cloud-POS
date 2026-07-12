import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import InventoryHistory from "./InventoryHistory";
import "./Inventory.css";

const API = axios.create({
  baseURL: "http://127.0.0.1:5000/api/products",
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

function Inventory() {
  const activeStoreId = Number(localStorage.getItem("activeStoreId")) || 1;

  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const loadInventory = useCallback(async () => {
    try {
      setLoading(true);
      const res = await API.get(`?store_id=${activeStoreId}`);
      const data = res.data.map((p) => ({
        ...p,
        tempStock: p.stock,
        actionQty: 1,
      }));
      setProducts(data);
    } catch (err) {
      console.log(err);
    } finally {
      setLoading(false);
    }
  }, [activeStoreId]);

  useEffect(() => {
    loadInventory();
  }, [loadInventory]);

  const filteredProducts = products.filter(
    (p) =>
      (p.name || "").toLowerCase().includes(search.toLowerCase()) ||
      String(p.barcode || "").includes(search)
  );

  const handleStockChange = (id, value) => {
    setProducts((prev) =>
      prev.map((p) =>
        p.id === id
          ? {
              ...p,
              tempStock: value,
            }
          : p
      )
    );
  };

  const handleQtyChange = (id, value) => {
    setProducts((prev) =>
      prev.map((p) =>
        p.id === id
          ? {
              ...p,
              actionQty: value,
            }
          : p
      )
    );
  };

  // একটাই request পাঠায় — তাই একবারে যত quantity দেওয়া হোক, inventory_history-তে
  // একটাই entry হবে (আগে +1 বারবার ক্লিক করলে আলাদা আলাদা entry হয়ে যেত)।
  const stockIn = async (id, currentStock, qty) => {
    const quantity = Number(qty);
    if (isNaN(quantity) || quantity <= 0) {
      alert("Enter valid quantity");
      return;
    }

    try {
      await API.put(`/${id}/stock`, {
        stock: Number(currentStock) + quantity,
      });
      loadInventory();
    } catch (err) {
      console.log(err);
      alert(err.response?.data?.message || "Stock In Failed");
    }
  };

  const stockOut = async (id, currentStock, qty) => {
    const quantity = Number(qty);
    if (isNaN(quantity) || quantity <= 0) {
      alert("Enter valid quantity");
      return;
    }

    if (quantity > Number(currentStock)) {
      alert("Not enough stock");
      return;
    }

    try {
      await API.put(`/${id}/stock`, {
        stock: Number(currentStock) - quantity,
      });
      loadInventory();
    } catch (err) {
      console.log(err);
      alert(err.response?.data?.message || "Stock Out Failed");
    }
  };

  const saveStock = async (id, stock) => {
    try {
      await API.put(`/${id}/stock`, {
        stock: Number(stock),
      });
      loadInventory();
    } catch (err) {
      console.log(err);
      alert(err.response?.data?.message || "Update Failed");
    }
  };

  const lowStock = filteredProducts.filter((p) => Number(p.stock) <= 10).length;
  const availableStock = filteredProducts.filter((p) => Number(p.stock) > 10).length;

  if (showHistory) {
    return (
      <div className="inventory-page">
        <div className="inventory-history-back-bar">
          <button
            type="button"
            className="inventory-history-back-btn"
            onClick={() => setShowHistory(false)}
          >
            ← Back to Inventory
          </button>
        </div>

        <InventoryHistory />
      </div>
    );
  }

  return (
    <div className="inventory-page">
      <div className="inventory-shell">
        <div className="inventory-header">
          <div>
            <p className="inventory-eyebrow">Stock overview</p>
            <h1 className="inventory-title">Inventory Management</h1>
            <p className="inventory-subtitle">
              Manage product stock, search items fast, and update store inventory in one place.
            </p>
          </div>

          <div className="inventory-header-right">
            <button
              type="button"
              className="inventory-history-btn"
              onClick={() => setShowHistory(true)}
            >
              📜 Inventory History
            </button>

            <div className="inventory-store-badge">
              <span className="store-dot"></span>
              Current Store #{activeStoreId}
            </div>
          </div>
        </div>

        <div className="inventory-summary-grid">
          <div className="summary-card summary-total">
            <span className="summary-label">Total Products</span>
            <h3>{filteredProducts.length}</h3>
          </div>

          <div className="summary-card summary-low">
            <span className="summary-label">Low Stock</span>
            <h3>{lowStock}</h3>
          </div>

          <div className="summary-card summary-available">
            <span className="summary-label">Available</span>
            <h3>{availableStock}</h3>
          </div>
        </div>

        <div className="inventory-toolbar">
          <div className="inventory-search-wrap">
            <input
              className="inventory-search"
              placeholder="Search product or barcode..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <button className="inventory-refresh-btn" onClick={loadInventory}>
            Refresh
          </button>
        </div>

        <div className="inventory-table-card">
          <div className="inventory-table-wrap">
            <table className="inventory-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Barcode</th>
                  <th>Name</th>
                  <th>Cost</th>
                  <th>Sell</th>
                  <th>Stock</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="8" className="inventory-empty">
                      Loading inventory...
                    </td>
                  </tr>
                ) : filteredProducts.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="inventory-empty">
                      No products found
                    </td>
                  </tr>
                ) : (
                  filteredProducts.map((p) => (
                    <tr key={p.id}>
                      <td data-label="ID">{p.id}</td>
                      <td data-label="Barcode">{p.barcode}</td>
                      <td data-label="Name" className="product-name-cell">
                        {p.name}
                      </td>
                      <td data-label="Cost">৳ {p.cost_price}</td>
                      <td data-label="Sell">৳ {p.selling_price}</td>
                      <td data-label="Stock">
                        <input
                          type="number"
                          className="stock-input"
                          value={p.tempStock}
                          onChange={(e) => handleStockChange(p.id, e.target.value)}
                        />
                      </td>
                      <td data-label="Status">
                        {Number(p.stock) <= 10 ? (
                          <span className="status-badge low">Low Stock</span>
                        ) : (
                          <span className="status-badge ok">Available</span>
                        )}
                      </td>
                      <td data-label="Action">
                        <div className="action-group">
                          <input
                            type="number"
                            min="1"
                            className="qty-action-input"
                            value={p.actionQty ?? 1}
                            onChange={(e) => handleQtyChange(p.id, e.target.value)}
                          />

                          <button
                            className="action-btn in"
                            onClick={() => stockIn(p.id, p.stock, p.actionQty)}
                          >
                            + In
                          </button>

                          <button
                            className="action-btn out"
                            onClick={() => stockOut(p.id, p.stock, p.actionQty)}
                          >
                            - Out
                          </button>

                          <button
                            className="action-btn save"
                            onClick={() => saveStock(p.id, p.tempStock)}
                          >
                            Save
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Inventory;