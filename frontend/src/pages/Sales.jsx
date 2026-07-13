import React, { useEffect, useMemo, useState, useRef } from "react";
import axios from "axios";
import Receipt from "../components/Receipt";
import BarcodeScanner from "../components/BarcodeScanner";
import SalesHistory from "./SalesHistory";
import "./Sales.css";

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

function Sales() {
  const activeStoreId = Number(localStorage.getItem("activeStoreId")) || 1;

  const [searchInput, setSearchInput] = useState("");
  const [cart, setCart] = useState([]);
  const [allProducts, setAllProducts] = useState([]);
  const [message, setMessage] = useState("");

  const [discount, setDiscount] = useState(0);
  const [tax, setTax] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState("Cash");
  const [amountReceived, setAmountReceived] = useState("");
  const [showReceipt, setShowReceipt] = useState(false);
  const [customerPhone, setCustomerPhone] = useState("");
  const [receiptData, setReceiptData] = useState(null);

  const [showScanner, setShowScanner] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const [heldSales, setHeldSales] = useState(
    JSON.parse(localStorage.getItem("heldSales") || "[]")
  );
  const [showHeldPanel, setShowHeldPanel] = useState(false);

  // ফোন স্ক্যানারের ইনপুট ধরার জন্য হিডেন রেফারেন্স
  const hiddenInputRef = useRef(null);

  const loadProducts = async () => {
    try {
      const res = await API.get(
        `/api/products?store_id=${activeStoreId}`
      );
      setAllProducts(res.data || []);
    } catch (err) {
      console.error("Error loading products:", err);
      setMessage("❌ Product load korte problem hocche.");
    }
  };

  useEffect(() => {
    loadProducts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const handleStoreSwitch = () => {
      const currentStoreId = Number(localStorage.getItem("activeStoreId")) || 1;

      API.get(`/api/products?store_id=${currentStoreId}`)
        .then((res) => setAllProducts(res.data || []))
        .catch((err) => {
          console.error("Error loading products:", err);
          setMessage("❌ Product load korte problem hocche.");
        });
    };

    window.addEventListener("storage", handleStoreSwitch);
    window.addEventListener("storeChanged", handleStoreSwitch);

    return () => {
      window.removeEventListener("storage", handleStoreSwitch);
      window.removeEventListener("storeChanged", handleStoreSwitch);
    };
  }, []);

  // ==================== ফোন/USB স্ক্যানার ক্যাচার ====================
  // হিডেন ইনপুট সবসময় ফোকাসড রাখা হয় (কোনো ক্লিক/ট্যাপ ছাড়াই), যাতে
  // extension/network-based scanner app সবসময় ডেটা বসানোর জায়গা পায়।
  // ইউজার real field (search/qty/tax/phone/amount/payment) ব্যবহার করলে
  // সেখানেই focus থাকতে দেওয়া হয়, বাকি সব সময় hidden input-এই ফোকাস ফিরে আসে।
  useEffect(() => {
    const focusHidden = () => {
      if (hiddenInputRef.current) {
        hiddenInputRef.current.focus();
      }
    };

    const isRealFieldFocused = () => {
      const el = document.activeElement;
      if (!el || el === hiddenInputRef.current) return false;
      const tag = el.tagName;
      return tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA";
    };

    const refocusIfIdle = () => {
      if (document.activeElement === hiddenInputRef.current) return;
      if (isRealFieldFocused()) return; // ইউজার ইচ্ছাকৃতভাবে অন্য field ব্যবহার করছে
      focusHidden();
    };

    focusHidden();

    const intervalId = setInterval(refocusIfIdle, 300);
    window.addEventListener("click", refocusIfIdle);

    return () => {
      clearInterval(intervalId);
      window.removeEventListener("click", refocusIfIdle);
    };
  }, []);

  const handleHiddenKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const code = e.target.value.trim();
      e.target.value = "";
      if (code) {
        handleScanSuccess(code);
      }
    }
  };
  // ====================================================================

  const handleScanSuccess = (scannedCode) => {
    console.log("Scanned Barcode Received:", scannedCode);
    const code = String(scannedCode).trim().toLowerCase();

    const matchedProduct = allProducts.find(
      (p) => String(p.barcode || "").trim().toLowerCase() === code
    );

    if (!matchedProduct) {
      setMessage(`❌ "${scannedCode}" barcode-er kono product paoa jayni ei store-e!`);
      return;
    }

    if (
      matchedProduct.store_id !== undefined &&
      Number(matchedProduct.store_id) !== Number(activeStoreId)
    ) {
      setMessage(
        `❌ Ei barcode Store #${matchedProduct.store_id}-er product, current store #${activeStoreId} noy!`
      );
      return;
    }

    addToCart(matchedProduct);
    setMessage("");
  };

  const addToCart = (matchedProduct) => {
    const originalPrice = parseFloat(matchedProduct.selling_price) || 0;
    const discountPercent = Number(matchedProduct.discount_percent) || 0;
    const discountedPrice =
      discountPercent > 0
        ? originalPrice - (originalPrice * discountPercent) / 100
        : originalPrice;

    setCart((prevCart) => {
      const existingItem = prevCart.find((item) => item.id === matchedProduct.id);

      if (existingItem) {
        return prevCart.map((item) =>
          item.id === matchedProduct.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }

      return [
        ...prevCart,
        {
          id: matchedProduct.id,
          name: matchedProduct.name,
          barcode: matchedProduct.barcode,
          original_price: originalPrice,
          discount_percent: discountPercent,
          selling_price: discountedPrice,
          quantity: 1,
        },
      ];
    });

    setSearchInput("");
    setMessage("");
  };

  const filteredSuggestions = useMemo(() => {
    const keyword = searchInput.trim().toLowerCase();
    if (!keyword) return [];

    return allProducts
      .filter(
        (p) =>
          p.name?.toLowerCase().includes(keyword) ||
          String(p.barcode || "").toLowerCase().includes(keyword)
      )
      .slice(0, 8);
  }, [searchInput, allProducts]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setMessage("");

    const keyword = searchInput.trim().toLowerCase();
    if (!keyword) return;

    const exactBarcodeMatch = allProducts.find(
      (p) => String(p.barcode || "").trim().toLowerCase() === keyword
    );

    if (exactBarcodeMatch) {
      addToCart(exactBarcodeMatch);
      return;
    }

    const exactNameMatch = allProducts.find(
      (p) => p.name?.trim().toLowerCase() === keyword
    );

    if (exactNameMatch) {
      addToCart(exactNameMatch);
      return;
    }

    if (filteredSuggestions.length === 1) {
      addToCart(filteredSuggestions[0]);
      return;
    }

    if (filteredSuggestions.length > 1) {
      setMessage("একাধিক product পাওয়া গেছে — নিচ থেকে select করুন।");
      return;
    }

    setMessage("❌ প্রোডাক্ট পাওয়া যায়নি!");
    setSearchInput("");
  };

  const handleQuantityChange = (id, value) => {
    const qty = Math.max(1, parseInt(value) || 1);
    setCart(cart.map((item) => (item.id === id ? { ...item, quantity: qty } : item)));
  };

  const handleRemoveItem = (id) => {
    setCart(cart.filter((item) => item.id !== id));
  };

  const subtotal = cart.reduce(
    (sum, item) => sum + item.selling_price * item.quantity,
    0
  );

  const discountPercent = Number(discount || 0);
  const discountAmount = subtotal * (discountPercent / 100);

  const taxPercent = Number(tax || 0);
  const taxAmount = (subtotal - discountAmount) * (taxPercent / 100);

  const totalPayable = subtotal - discountAmount + taxAmount;
  const paidAmount = Number(amountReceived || totalPayable || 0);
  const changeAmount = paidAmount - totalPayable;

  const handleCompleteSale = async () => {
    if (cart.length === 0) return;

    try {
      const res = await API.post("/api/sales/checkout", {
        items: cart,
        store_id: activeStoreId,
        customer_phone: customerPhone,
        total_amount: subtotal,
        discount: discountAmount,
        tax: taxAmount,
        payable_amount: totalPayable,
        payment_method: paymentMethod,
      });

      setReceiptData({
        sale_id: res.data.sale_id || res.data.invoice_id,
        date: new Date().toLocaleString(),
        payment_method: paymentMethod,
        customer_phone: customerPhone,
        items: cart,
        subtotal,
        discount: discountAmount,
        discountPercent,
        tax: taxAmount,
        taxPercent,
        total: totalPayable,
        received: paidAmount,
        change: paidAmount - totalPayable,
      });

      setShowReceipt(true);
      setCart([]);
      setAmountReceived("");
      setDiscount(0);
      setTax(0);
      setCustomerPhone("");
      setSearchInput("");
      setMessage("");

      loadProducts();
    } catch (err) {
      alert("❌ চেকআউট ব্যর্থ হয়েছে: " + (err.response?.data?.message || err.message));
    }
  };

  const handleHoldSale = () => {
    if (cart.length === 0) return;

    const held = {
      id: Date.now(),
      customer_phone: customerPhone,
      cart,
      discount,
      tax,
      held_at: new Date().toLocaleString(),
    };

    const updated = [...heldSales, held];
    setHeldSales(updated);
    localStorage.setItem("heldSales", JSON.stringify(updated));

    setCart([]);
    setCustomerPhone("");
    setDiscount(0);
    setTax(0);
    setAmountReceived("");
    setSearchInput("");
    setMessage("");

    alert("✅ Sale held! Pore abar resume korte parbe.");
  };

  const handleResumeSale = (heldId) => {
    if (cart.length > 0) {
      const ok = window.confirm(
        "Current cart-e item ache. Held sale load korle current cart replace hoye jabe. Continue?"
      );
      if (!ok) return;
    }

    const held = heldSales.find((h) => h.id === heldId);
    if (!held) return;

    setCart(held.cart || []);
    setCustomerPhone(held.customer_phone || "");
    setDiscount(held.discount || 0);
    setTax(held.tax || 0);

    const updated = heldSales.filter((h) => h.id !== heldId);
    setHeldSales(updated);
    localStorage.setItem("heldSales", JSON.stringify(updated));
    setShowHeldPanel(false);
  };

  const handleDeleteHeldSale = (heldId) => {
    if (!window.confirm("Ei held sale delete korte chao?")) return;

    const updated = heldSales.filter((h) => h.id !== heldId);
    setHeldSales(updated);
    localStorage.setItem("heldSales", JSON.stringify(updated));
  };

  if (showHistory) {
    return (
      <div className="sales-page">
        <div className="sales-history-back-bar">
          <button
            type="button"
            className="sales-history-back-btn"
            onClick={() => setShowHistory(false)}
          >
            ← Back to POS {cart.length > 0 ? `(${cart.length} item cart safe)` : ""}
          </button>
        </div>

        <SalesHistory />
      </div>
    );
  }

  return (
    <div className="sales-page">
      <input
        ref={hiddenInputRef}
        type="text"
        autoComplete="off"
        onKeyDown={handleHiddenKeyDown}
        style={{
          position: "absolute",
          opacity: 0,
          left: "-9999px",
          width: "1px",
          height: "1px",
        }}
      />

      <div className="sales-header">
        <div>
          <p className="sales-eyebrow">Point of Sale</p>
          <h2 className="sales-title">🧾 POS / Sales</h2>
          <p className="sales-subtitle">
            🏪 Store #{activeStoreId} • Billing Terminal
          </p>
          <small style={{ color: "#22c55e", fontWeight: "bold", display: "block", marginTop: "4px" }}>
            🟢 Phone Scanner Mode Active. (Just scan barcodes anytime)
          </small>
        </div>

        <button
          type="button"
          className="sales-camera-btn"
          onClick={() => setShowHistory(true)}
        >
          📄 Sales History
        </button>
      </div>

      <div className="sales-search-card">
        <form onSubmit={handleSearchSubmit} className="sales-search-form">
          <span className="sales-search-icon">🔍</span>
          <input
            type="text"
            placeholder="Scan barcode or search by product name..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="sales-search-input"
          />
          <button type="submit" className="sales-search-btn">
            Scan / Search
          </button>
          <button
            type="button"
            className="sales-camera-btn"
            onClick={() => setShowScanner(true)}
          >
            📷 Camera Scan
          </button>
        </form>

        {message && <p className="sales-message">{message}</p>}

        {filteredSuggestions.length > 0 && searchInput.trim() && (
          <div className="sales-suggestions">
            {filteredSuggestions.map((product) => (
              <button
                key={product.id}
                type="button"
                className="sales-suggestion-item"
                onClick={() => addToCart(product)}
              >
                <div className="sales-suggestion-top">
                  <span className="sales-suggestion-name">{product.name}</span>
                  <span className="sales-suggestion-price">
                    ৳{Number(product.selling_price).toFixed(2)}
                  </span>
                </div>
                <div className="sales-suggestion-meta">
                  #{product.barcode || "N/A"}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="sales-main-grid">
        <div className="sales-cart-area">
          <div className="sales-table-card">
            <div className="sales-table-wrap">
              <table className="sales-table">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Price</th>
                    <th className="w-qty">Qty</th>
                    <th>Total</th>
                    <th className="w-action"></th>
                  </tr>
                </thead>
                <tbody>
                  {cart.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="sales-empty">
                        <div className="sales-empty-icon">🛒</div>
                        Cart is empty. Scan barcode or type product name.
                      </td>
                    </tr>
                  ) : (
                    cart.map((item) => (
                      <tr key={item.id}>
                        <td>
                          <div className="sales-item-name">{item.name}</div>
                          <div className="sales-item-sub">#{item.barcode}</div>
                        </td>
                        <td>
                          {item.discount_percent > 0 ? (
                            <div className="sales-price-discounted">
                              <span className="sales-price-original">
                                ৳{Number(item.original_price).toFixed(2)}
                              </span>
                              <span className="sales-price-final">
                                ৳{item.selling_price.toFixed(2)}
                              </span>
                              <span className="sales-discount-badge">
                                {item.discount_percent}% off
                              </span>
                            </div>
                          ) : (
                            <span>৳{item.selling_price.toFixed(2)}</span>
                          )}
                        </td>
                        <td>
                          <input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(e) =>
                              handleQuantityChange(item.id, e.target.value)
                            }
                            className="sales-qty-input"
                          />
                        </td>
                        <td className="sales-item-total">
                          ৳{(item.selling_price * item.quantity).toFixed(2)}
                        </td>
                        <td>
                          <button
                            onClick={() => handleRemoveItem(item.id)}
                            className="sales-icon-btn danger"
                          >
                            🗑️
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="sales-actions">
            <button onClick={() => setCart([])} className="sales-btn danger">
              🗑 Clear Cart
            </button>

            <button
              onClick={handleHoldSale}
              disabled={cart.length === 0}
              className="sales-btn warning"
            >
              ⏸ Hold Sale
            </button>

            <button
              onClick={() => setShowHeldPanel(true)}
              className="sales-btn purple"
            >
              📋 Held Sales
              {heldSales.length > 0 && (
                <span className="sales-badge-count">{heldSales.length}</span>
              )}
            </button>

            <div className="sales-inline-box">
              <label>Discount %</label>
              <input
                type="number"
                value={discount}
                onChange={(e) => setDiscount(Number(e.target.value))}
              />
            </div>
          </div>
        </div>

        <div className="sales-summary-card">
          <h3 className="sales-summary-title">💳 Billing Summary</h3>

          <SummaryRow label="Subtotal" value={`৳${subtotal.toFixed(2)}`} />
          <SummaryRow
            label="Discount"
            value={`-৳${discountAmount.toFixed(2)}`}
            color="var(--sales-danger)"
          />
          <SummaryRow label="Tax" value={`৳${taxAmount.toFixed(2)}`} />

          <div className="sales-field">
            <label>Tax %</label>
            <input
              type="number"
              value={tax}
              onChange={(e) => setTax(Number(e.target.value))}
              className="sales-input"
            />
          </div>

          <div className="sales-divider" />

          <div className="sales-total-box">
            <span>Total Payable</span>
            <strong>৳{totalPayable.toFixed(2)}</strong>
          </div>

          <div className="sales-field">
            <label>Customer Phone</label>
            <input
              type="text"
              placeholder="01XXXXXXXXX"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              className="sales-input"
            />
          </div>

          <div className="sales-field">
            <label>Payment Method</label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="sales-input"
            >
              <option value="Cash">💵 Cash</option>
              <option value="Card">💳 Card</option>
              <option value="Bkash">📱 bKash / Wallet</option>
            </select>
          </div>

          <div className="sales-field">
            <label>Amount Received</label>
            <input
              type="number"
              placeholder="Enter given amount"
              value={amountReceived}
              onChange={(e) => setAmountReceived(e.target.value)}
              className="sales-input"
            />
          </div>

          <div className={`sales-change ${changeAmount >= 0 ? "ok" : "due"}`}>
            <span>Change / Due</span>
            <strong>৳{changeAmount.toFixed(2)}</strong>
          </div>

          <button
            onClick={handleCompleteSale}
            disabled={cart.length === 0}
            className="sales-complete-btn"
          >
            ✔ Complete Sale
          </button>
        </div>
      </div>

      {showHeldPanel && (
        <div className="sales-overlay">
          <div className="sales-modal">
            <h3 className="sales-modal-title">📋 Held Sales</h3>

            {heldSales.length === 0 ? (
              <p className="sales-modal-empty">Kono sale hold-e nai।</p>
            ) : (
              heldSales.map((h) => {
                const total = h.cart.reduce(
                  (sum, item) => sum + item.selling_price * item.quantity,
                  0
                );

                return (
                  <div key={h.id} className="sales-held-card">
                    <div className="sales-held-top">
                      <strong>{h.customer_phone || "Walk-in Customer"}</strong>
                      <span>{h.held_at}</span>
                    </div>
                    <p className="sales-held-text">
                      {h.cart.length} item(s) — ৳{total.toFixed(2)}
                    </p>
                    <div className="sales-held-actions">
                      <button
                        onClick={() => handleResumeSale(h.id)}
                        className="sales-btn success small"
                      >
                        ▶ Resume
                      </button>
                      <button
                        onClick={() => handleDeleteHeldSale(h.id)}
                        className="sales-btn danger small"
                      >
                        🗑️ Delete
                      </button>
                    </div>
                  </div>
                );
              })
            )}

            <button
              onClick={() => setShowHeldPanel(false)}
              className="sales-close-btn"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {showReceipt && (
        <Receipt
          sale={receiptData}
          onClose={() => {
            setShowReceipt(false);
            setReceiptData(null);
          }}
        />
      )}

      <BarcodeScanner
        open={showScanner}
        onClose={() => setShowScanner(false)}
        onScanSuccess={handleScanSuccess}
        title="Scan Product to Add"
      />
    </div>
  );
}

function SummaryRow({ label, value, color }) {
  return (
    <div className="sales-summary-row">
      <span>{label}</span>
      <strong style={{ color: color || "var(--sales-text)" }}>{value}</strong>
    </div>
  );
}

export default Sales;