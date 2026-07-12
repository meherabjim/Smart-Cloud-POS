import React, { useState, useEffect, useCallback, useMemo } from "react";
import axios from "axios";
import "./Products.css";

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

function Products() {
  const activeStoreId = Number(localStorage.getItem("activeStoreId")) || 1;

  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");

  const [form, setForm] = useState({
    barcode: "",
    name: "",
    category: "",
    cost_price: "",
    selling_price: "",
    stock: "",
  });

  const loadProducts = useCallback(async () => {
    try {
      const res = await API.get(`?store_id=${activeStoreId}`);

      setProducts(
        res.data.map((p) => ({
          ...p,
          tempPrice: p.selling_price,
          tempStock: p.stock,
          printQty: 1,
        }))
      );

      if (res.data.length > 0) {
        const lastBarcode = Math.max(
          ...res.data.map((p) => Number(p.barcode) || 10000)
        );

        setForm((prev) => ({
          ...prev,
          barcode: String(lastBarcode + 1),
        }));
      } else {
        setForm((prev) => ({
          ...prev,
          barcode: "10001",
        }));
      }
    } catch (err) {
      console.log(err);
      setMessage(err.response?.data?.message || "Product load korte problem hocche");
    }
  }, [activeStoreId]);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  const handleChange = (e) => {
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    });
  };

  const filteredProducts = useMemo(() => {
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        String(p.barcode || "").includes(search) ||
        (p.category || "").toLowerCase().includes(search.toLowerCase())
    );
  }, [products, search]);

  const handleAddProduct = async (e) => {
    e.preventDefault();

    try {
      await API.post("/", {
        store_id: activeStoreId,
        barcode: form.barcode,
        name: form.name,
        category: form.category,
        cost_price: Number(form.cost_price),
        selling_price: Number(form.selling_price),
        stock: Number(form.stock),
      });

      setMessage("Product added successfully");

      setForm({
        barcode: String(Number(form.barcode) + 1),
        name: "",
        category: "",
        cost_price: "",
        selling_price: "",
        stock: "",
      });

      loadProducts();
    } catch (err) {
      setMessage(err.response?.data?.message || "Failed to add product");
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete Product?")) return;

    try {
      await API.delete(`/${id}`);
      setMessage("Product deleted successfully");
      loadProducts();
    } catch (err) {
      alert(err.response?.data?.message || "Delete Failed");
    }
  };

  const handleTableChange = (id, field, value) => {
    setProducts((prev) =>
      prev.map((p) =>
        p.id === id
          ? {
              ...p,
              [field]: value,
            }
          : p
      )
    );
  };

  const savePrice = async (id, price) => {
    try {
      await API.put(`/${id}/price`, {
        selling_price: Number(price),
      });
      setMessage("Price updated successfully");
      loadProducts();
    } catch (err) {
      console.log(err);
      alert(err.response?.data?.message || "Price Update Failed");
    }
  };

  const saveStock = async (id, stock) => {
    try {
      await API.put(`/${id}/stock`, {
        stock: Number(stock),
      });
      setMessage("Stock updated successfully");
      loadProducts();
    } catch (err) {
      console.log(err);
      alert(err.response?.data?.message || "Stock Update Failed");
    }
  };

  // Loads JsBarcode from CDN into the new print window, renders one barcode
  // per requested quantity using the product's REAL barcode value, then
  // triggers the browser print dialog. Because the exact same barcode value
  // is encoded, scanning the printed label on the Sales/POS page will match
  // this product automatically — no changes needed on the Sales page.
  const handlePrintBarcode = (product, qty) => {
    const quantity = Math.max(1, Number(qty) || 1);
    const printWindow = window.open("", "_blank", "width=800,height=700");

    if (!printWindow) {
      alert("Popup blocked. Please allow popups for this site to print barcodes.");
      return;
    }

    let barcodesHtml = "";
    for (let i = 0; i < quantity; i++) {
      barcodesHtml += `
        <div class="barcode-item">
          <div class="barcode-name">${product.name}</div>
          <canvas class="barcode" data-barcode="${product.barcode}"></canvas>
          <div class="barcode-price">Tk ${product.selling_price}</div>
          <button class="download-btn" data-index="${i}">⬇ Download PNG</button>
        </div>
      `;
    }

    printWindow.document.write(`
      <html>
        <head>
          <title>Print Barcode - ${product.name}</title>
          <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"></script>
          <style>
            * { box-sizing: border-box; }
            body { font-family: Arial, sans-serif; padding: 16px; }
            .toolbar { margin-bottom: 14px; }
            .toolbar button {
              padding: 8px 14px;
              border: none;
              border-radius: 8px;
              background: #4f46e5;
              color: #fff;
              font-weight: bold;
              cursor: pointer;
              margin-right: 8px;
            }
            .barcode-grid { display: flex; flex-wrap: wrap; gap: 10px; }
            .barcode-item {
              border: 1px dashed #999;
              border-radius: 6px;
              padding: 10px;
              text-align: center;
              width: 220px;
            }
            .barcode-name { font-size: 13px; font-weight: bold; margin-bottom: 4px; }
            .barcode-price { font-size: 12px; margin-top: 2px; margin-bottom: 8px; }
            .download-btn {
              padding: 6px 10px;
              border: none;
              border-radius: 6px;
              background: #16a34a;
              color: #fff;
              font-size: 11px;
              font-weight: bold;
              cursor: pointer;
            }
            @media print {
              .toolbar, .download-btn { display: none; }
              .barcode-item { border: none; page-break-inside: avoid; }
            }
          </style>
        </head>
        <body>
          <div class="toolbar">
            <button onclick="window.print()">🖨 Print All</button>
          </div>
          <div class="barcode-grid">${barcodesHtml}</div>
          <script>
            window.onload = function () {
              var canvases = document.querySelectorAll(".barcode");
              canvases.forEach(function (el) {
                JsBarcode(el, el.getAttribute("data-barcode"), {
                  format: "CODE128",
                  width: 2,
                  height: 55,
                  fontSize: 14,
                  margin: 5,
                });
              });

              document.querySelectorAll(".download-btn").forEach(function (btn) {
                btn.addEventListener("click", function () {
                  var idx = btn.getAttribute("data-index");
                  var canvas = canvases[idx];
                  var link = document.createElement("a");
                  link.download = "barcode_${product.barcode}_" + idx + ".png";
                  link.href = canvas.toDataURL("image/png");
                  link.click();
                });
              });
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const lowStockCount = filteredProducts.filter((p) => Number(p.stock) <= 10).length;

  return (
    <div className="products-page">
      <div className="products-shell">
        <div className="products-header">
          <div>
            <p className="products-eyebrow">Catalog control</p>
            <h1 className="products-title">Product Management</h1>
            <p className="products-subtitle">
              Add products, edit prices, manage stock, and keep your store catalog updated.
            </p>
          </div>

          <div className="products-store-badge">
            <span className="store-dot"></span>
            Current Store #{activeStoreId}
          </div>
        </div>

        <div className="products-summary-grid">
          <div className="products-summary-card total">
            <span className="summary-label">Total Products</span>
            <h3>{filteredProducts.length}</h3>
          </div>

          <div className="products-summary-card low">
            <span className="summary-label">Low Stock</span>
            <h3>{lowStockCount}</h3>
          </div>
        </div>

        {message && <div className="products-message">{message}</div>}

        <div className="products-form-card">
          <div className="section-head">
            <h2>Add New Product</h2>
            <p>Fill in product details for the active store.</p>
          </div>

          <form onSubmit={handleAddProduct} className="products-form-grid">
            <input
              name="barcode"
              placeholder="Barcode"
              value={form.barcode}
              onChange={handleChange}
              required
            />

            <input
              name="name"
              placeholder="Product Name"
              value={form.name}
              onChange={handleChange}
              required
            />

            <input
              name="category"
              placeholder="Category"
              value={form.category}
              onChange={handleChange}
              required
            />

            <input
              type="number"
              name="cost_price"
              placeholder="Cost Price"
              value={form.cost_price}
              onChange={handleChange}
              required
            />

            <input
              type="number"
              name="selling_price"
              placeholder="Selling Price"
              value={form.selling_price}
              onChange={handleChange}
              required
            />

            <input
              type="number"
              name="stock"
              placeholder="Stock"
              value={form.stock}
              onChange={handleChange}
              required
            />

            <button type="submit" className="products-submit-btn">
              Add Product
            </button>
          </form>
        </div>

        <div className="products-toolbar">
          <div className="products-search-wrap">
            <input
              className="products-search"
              placeholder="Search product, barcode, or category..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <button className="products-refresh-btn" onClick={loadProducts}>
            Refresh
          </button>
        </div>

        <div className="products-table-card">
          <div className="products-table-wrap">
            <table className="products-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Barcode</th>
                  <th>Name</th>
                  <th>Category</th>
                  <th>Cost</th>
                  <th>Price</th>
                  <th>Stock</th>
                  <th>Action</th>
                </tr>
              </thead>

              <tbody>
                {filteredProducts.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="products-empty">
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
                      <td data-label="Category">{p.category}</td>
                      <td data-label="Cost">৳ {p.cost_price}</td>

                      <td data-label="Price">
                        <div className="inline-edit-box">
                          <input
                            type="number"
                            value={p.tempPrice ?? ""}
                            onChange={(e) =>
                              handleTableChange(p.id, "tempPrice", e.target.value)
                            }
                          />
                          <button
                            className="mini-btn save"
                            onClick={() => savePrice(p.id, p.tempPrice)}
                          >
                            Save
                          </button>
                        </div>
                      </td>

                      <td data-label="Stock">
                        <div className="inline-edit-box">
                          <input
                            type="number"
                            value={p.tempStock ?? ""}
                            onChange={(e) =>
                              handleTableChange(p.id, "tempStock", e.target.value)
                            }
                          />
                          <button
                            className="mini-btn save"
                            onClick={() => saveStock(p.id, p.tempStock)}
                          >
                            Save
                          </button>
                        </div>
                      </td>

                      <td data-label="Action">
                        <div className="action-cell">
                          <div className="action-row">
                            <button
                              className="mini-btn delete"
                              onClick={() => handleDelete(p.id)}
                            >
                              🗑 Delete
                            </button>

                            <button
                              className="mini-btn print"
                              onClick={() => handlePrintBarcode(p, p.printQty)}
                            >
                              🖨 Print
                            </button>
                          </div>

                          <div className="print-qty-row">
                            <span>Qty:</span>
                            <input
                              type="number"
                              min="1"
                              className="print-qty-input"
                              value={p.printQty ?? 1}
                              onChange={(e) =>
                                handleTableChange(p.id, "printQty", e.target.value)
                              }
                            />
                          </div>
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

export default Products;