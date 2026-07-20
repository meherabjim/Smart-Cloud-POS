import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
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
    const token =
      localStorage.getItem("token");

    if (token) {
      config.headers.Authorization =
        `Bearer ${token}`;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

function Sales({
  activeStoreId: activeStoreIdProp,
}) {
  const currentUser = useMemo(() => {
    try {
      return JSON.parse(
        localStorage.getItem("user") || "{}"
      );
    } catch (error) {
      console.error(
        "Invalid user information:",
        error
      );

      return {};
    }
  }, []);

  const isViewer =
    currentUser.role === "Viewer";

  const initialStoreId =
    Number(activeStoreIdProp) ||
    Number(
      localStorage.getItem("activeStoreId")
    ) ||
    1;

  const [
    activeStoreId,
    setActiveStoreId,
  ] = useState(initialStoreId);

  const [searchInput, setSearchInput] =
    useState("");

  const [cart, setCart] =
    useState([]);

  const [allProducts, setAllProducts] =
    useState([]);

  const [message, setMessage] =
    useState("");

  const [discount, setDiscount] =
    useState(0);

  const [tax, setTax] =
    useState(0);

  const [
    paymentMethod,
    setPaymentMethod,
  ] = useState("Cash");

  const [
    amountReceived,
    setAmountReceived,
  ] = useState("");

  const [
    showReceipt,
    setShowReceipt,
  ] = useState(false);

  const [
    customerPhone,
    setCustomerPhone,
  ] = useState("");

  const [
    customer,
    setCustomer,
  ] = useState(null);

  const [
    customerLookupLoading,
    setCustomerLookupLoading,
  ] = useState(false);

  const [
    customerLookupMessage,
    setCustomerLookupMessage,
  ] = useState("");

  const [
    redeemPoints,
    setRedeemPoints,
  ] = useState(0);

  const [
    receiptData,
    setReceiptData,
  ] = useState(null);

  const [
    showScanner,
    setShowScanner,
  ] = useState(false);

  const [
    showHistory,
    setShowHistory,
  ] = useState(false);

  const [heldSales, setHeldSales] =
    useState(() => {
      try {
        return JSON.parse(
          localStorage.getItem(
            "heldSales"
          ) || "[]"
        );
      } catch (error) {
        return [];
      }
    });

  const [
    showHeldPanel,
    setShowHeldPanel,
  ] = useState(false);

  const hiddenInputRef =
    useRef(null);

  const loadProducts = useCallback(
    async (storeId = activeStoreId) => {
      try {
        const res = await API.get(
          `/api/products?store_id=${storeId}`
        );

        setAllProducts(
          Array.isArray(res.data)
            ? res.data
            : []
        );

        setMessage("");
      } catch (err) {
        console.error(
          "Error loading products:",
          err
        );

        setAllProducts([]);

        setMessage(
          err.response?.data?.message ||
            "❌ Product load korte problem hocche."
        );
      }
    },
    [activeStoreId]
  );

  useEffect(() => {
    const nextStoreId =
      Number(activeStoreIdProp);

    if (
      nextStoreId &&
      nextStoreId !== activeStoreId
    ) {
      setActiveStoreId(nextStoreId);
    }
  }, [
    activeStoreIdProp,
    activeStoreId,
  ]);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  useEffect(() => {
    const handleStoreSwitch = (event) => {
      const eventStoreId =
        Number(
          event?.detail?.storeId
        );

      const savedStoreId =
        Number(
          localStorage.getItem(
            "activeStoreId"
          )
        );

      const nextStoreId =
        eventStoreId ||
        savedStoreId ||
        1;

      setActiveStoreId(nextStoreId);
      setCart([]);
      setSearchInput("");
      setMessage("");
    };

    window.addEventListener(
      "storage",
      handleStoreSwitch
    );

    window.addEventListener(
      "storeChanged",
      handleStoreSwitch
    );

    return () => {
      window.removeEventListener(
        "storage",
        handleStoreSwitch
      );

      window.removeEventListener(
        "storeChanged",
        handleStoreSwitch
      );
    };
  }, []);

  useEffect(() => {
    if (isViewer) {
      return undefined;
    }

    const focusHiddenInput = () => {
      if (hiddenInputRef.current) {
        hiddenInputRef.current.focus();
      }
    };

    const isNormalFieldFocused = () => {
      const element =
        document.activeElement;

      if (
        !element ||
        element === hiddenInputRef.current
      ) {
        return false;
      }

      return [
        "INPUT",
        "SELECT",
        "TEXTAREA",
      ].includes(element.tagName);
    };

    const refocusWhenIdle = () => {
      if (
        document.activeElement ===
        hiddenInputRef.current
      ) {
        return;
      }

      if (isNormalFieldFocused()) {
        return;
      }

      focusHiddenInput();
    };

    focusHiddenInput();

    const intervalId = setInterval(
      refocusWhenIdle,
      300
    );

    window.addEventListener(
      "click",
      refocusWhenIdle
    );

    return () => {
      clearInterval(intervalId);

      window.removeEventListener(
        "click",
        refocusWhenIdle
      );
    };
  }, [isViewer]);

  useEffect(() => {
    const phone = customerPhone
      .replace(/\s+/g, "")
      .replace(/-/g, "")
      .trim();

    setCustomer(null);
    setRedeemPoints(0);

    if (!phone) {
      setCustomerLookupMessage("");
      setCustomerLookupLoading(false);
      return undefined;
    }

    if (!/^01[3-9]\d{8}$/.test(phone)) {
      setCustomerLookupMessage(
        "Enter a valid registered phone number."
      );
      setCustomerLookupLoading(false);
      return undefined;
    }

    const timer = setTimeout(async () => {
      try {
        setCustomerLookupLoading(true);
        setCustomerLookupMessage("");

        const res = await API.get(
          `/api/customers/by-phone/${phone}`
        );

        setCustomer(res.data.customer);
      } catch (error) {
        setCustomer(null);
        setCustomerLookupMessage(
          error.response?.data?.message ||
            "Registered customer was not found."
        );
      } finally {
        setCustomerLookupLoading(false);
      }
    }, 450);

    return () => clearTimeout(timer);
  }, [customerPhone]);

  const preventViewerAction = () => {
    if (!isViewer) {
      return false;
    }

    setMessage(
      "👁 Demo Viewer has read-only access."
    );

    return true;
  };

  const handleHiddenKeyDown = (event) => {
    if (isViewer) {
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();

      const code =
        event.target.value.trim();

      event.target.value = "";

      if (code) {
        handleScanSuccess(code);
      }
    }
  };

  const handleScanSuccess = (
    scannedCode
  ) => {
    if (preventViewerAction()) {
      return;
    }

    const code = String(
      scannedCode
    )
      .trim()
      .toLowerCase();

    const matchedProduct =
      allProducts.find(
        (product) =>
          String(
            product.barcode || ""
          )
            .trim()
            .toLowerCase() === code
      );

    if (!matchedProduct) {
      setMessage(
        `❌ "${scannedCode}" barcode-er kono product paoa jayni ei store-e!`
      );

      return;
    }

    if (
      matchedProduct.store_id !==
        undefined &&
      Number(
        matchedProduct.store_id
      ) !== Number(activeStoreId)
    ) {
      setMessage(
        `❌ Ei barcode Store #${matchedProduct.store_id}-er product.`
      );

      return;
    }

    addToCart(matchedProduct);
  };

  const addToCart = (product) => {
    if (preventViewerAction()) {
      return;
    }

    const originalPrice =
      Number(
        product.selling_price
      ) || 0;

    const productDiscount =
      Number(
        product.discount_percent
      ) || 0;

    const finalPrice =
      productDiscount > 0
        ? originalPrice -
          (originalPrice *
            productDiscount) /
            100
        : originalPrice;

    setCart((previousCart) => {
      const existingItem =
        previousCart.find(
          (item) =>
            Number(item.id) ===
            Number(product.id)
        );

      if (existingItem) {
        return previousCart.map(
          (item) =>
            Number(item.id) ===
            Number(product.id)
              ? {
                  ...item,
                  quantity:
                    item.quantity + 1,
                }
              : item
        );
      }

      return [
        ...previousCart,
        {
          id: product.id,
          name: product.name,
          barcode: product.barcode,
          original_price:
            originalPrice,
          discount_percent:
            productDiscount,
          selling_price:
            finalPrice,
          quantity: 1,
        },
      ];
    });

    setSearchInput("");
    setMessage("");
  };

  const filteredSuggestions =
    useMemo(() => {
      const keyword =
        searchInput
          .trim()
          .toLowerCase();

      if (!keyword) {
        return [];
      }

      return allProducts
        .filter(
          (product) =>
            product.name
              ?.toLowerCase()
              .includes(keyword) ||
            String(
              product.barcode || ""
            )
              .toLowerCase()
              .includes(keyword)
        )
        .slice(0, 8);
    }, [searchInput, allProducts]);

  const handleSearchSubmit = (
    event
  ) => {
    event.preventDefault();

    if (preventViewerAction()) {
      return;
    }

    setMessage("");

    const keyword =
      searchInput
        .trim()
        .toLowerCase();

    if (!keyword) {
      return;
    }

    const exactBarcodeMatch =
      allProducts.find(
        (product) =>
          String(
            product.barcode || ""
          )
            .trim()
            .toLowerCase() ===
          keyword
      );

    if (exactBarcodeMatch) {
      addToCart(
        exactBarcodeMatch
      );

      return;
    }

    const exactNameMatch =
      allProducts.find(
        (product) =>
          product.name
            ?.trim()
            .toLowerCase() ===
          keyword
      );

    if (exactNameMatch) {
      addToCart(exactNameMatch);

      return;
    }

    if (
      filteredSuggestions.length === 1
    ) {
      addToCart(
        filteredSuggestions[0]
      );

      return;
    }

    if (
      filteredSuggestions.length > 1
    ) {
      setMessage(
        "একাধিক product পাওয়া গেছে — নিচ থেকে select করুন।"
      );

      return;
    }

    setMessage(
      "❌ প্রোডাক্ট পাওয়া যায়নি!"
    );

    setSearchInput("");
  };

  const handleQuantityChange = (
    id,
    value
  ) => {
    if (preventViewerAction()) {
      return;
    }

    const quantity = Math.max(
      1,
      Number.parseInt(value, 10) || 1
    );

    setCart((previousCart) =>
      previousCart.map((item) =>
        Number(item.id) === Number(id)
          ? {
              ...item,
              quantity,
            }
          : item
      )
    );
  };

  const handleRemoveItem = (id) => {
    if (preventViewerAction()) {
      return;
    }

    setCart((previousCart) =>
      previousCart.filter(
        (item) =>
          Number(item.id) !==
          Number(id)
      )
    );
  };

  const subtotal = cart.reduce(
    (sum, item) =>
      sum +
      Number(item.selling_price) *
        Number(item.quantity),
    0
  );

  const discountPercent =
    Number(discount) || 0;

  const discountAmount =
    subtotal *
    (discountPercent / 100);

  const taxPercent =
    Number(tax) || 0;

  const taxAmount =
    (subtotal - discountAmount) *
    (taxPercent / 100);

  const pointDiscount =
    (Number(redeemPoints) / 100) * 80;

  const totalPayable = Math.max(
    0,
    subtotal -
      discountAmount +
      taxAmount -
      pointDiscount
  );

  const paidAmount =
    amountReceived === ""
      ? totalPayable
      : Number(amountReceived) || 0;

  const changeAmount =
    paidAmount - totalPayable;

  const maximumRedeemablePoints = customer
    ? Math.min(
        Math.floor(
          Number(customer.points_balance || 0) / 100
        ) * 100,
        Math.floor(
          Math.max(
            0,
            subtotal - discountAmount + taxAmount
          ) / 80
        ) * 100
      )
    : 0;

  const estimatedEarnedPoints = Math.floor(
    totalPayable / 100
  );

  const handleCompleteSale =
    async () => {
      if (preventViewerAction()) {
        return;
      }

      if (cart.length === 0) {
        return;
      }

      if (!customerPhone.trim()) {
        alert("Customer phone number is required.");
        return;
      }

      if (!customer) {
        alert(
          "Please enter a valid registered customer phone number."
        );
        return;
      }

      if (Number(redeemPoints) > maximumRedeemablePoints) {
        alert(
          `Maximum redeemable points for this bill: ${maximumRedeemablePoints}`
        );
        return;
      }

      try {
        const res = await API.post(
          "/api/sales/checkout",
          {
            items: cart,
            store_id: activeStoreId,
            customer_phone:
              customerPhone,
            total_amount: subtotal,
            discount:
              discountAmount,
            tax: taxAmount,
            payable_amount:
              totalPayable,
            payment_method:
              paymentMethod,
            redeem_points:
              Number(redeemPoints) || 0,
          }
        );

        setReceiptData({
          sale_id:
            res.data.sale_id ||
            res.data.invoice_id,
          date:
            new Date().toLocaleString(),
          payment_method:
            paymentMethod,
          customer_phone:
            customerPhone,
          customer_name:
            res.data.customer?.name ||
            customer?.name ||
            "",
          items: cart,
          subtotal,
          discount:
            discountAmount,
          discountPercent,
          tax: taxAmount,
          taxPercent,
          points_redeemed:
            res.data.loyalty?.redeemed_points || 0,
          points_discount:
            res.data.loyalty?.redeemed_value || 0,
          points_earned:
            res.data.loyalty?.earned_points || 0,
          previous_points:
            res.data.loyalty?.previous_points || 0,
          remaining_points:
            res.data.loyalty?.remaining_points || 0,
          total:
            Number(res.data.payable_amount) ||
            totalPayable,
          received: paidAmount,
          change:
            paidAmount -
            (Number(res.data.payable_amount) ||
              totalPayable),
        });

        setShowReceipt(true);
        setCart([]);
        setAmountReceived("");
        setDiscount(0);
        setTax(0);
        setCustomerPhone("");
        setCustomer(null);
        setCustomerLookupMessage("");
        setRedeemPoints(0);
        setSearchInput("");
        setMessage("");

        loadProducts();
      } catch (err) {
        alert(
          "❌ Checkout failed: " +
            (err.response?.data
              ?.message ||
              err.message)
        );
      }
    };

  const handleHoldSale = () => {
    if (preventViewerAction()) {
      return;
    }

    if (cart.length === 0) {
      return;
    }

    const heldSale = {
      id: Date.now(),
      customer_phone:
        customerPhone,
      cart,
      discount,
      tax,
      redeem_points: redeemPoints,
      held_at:
        new Date().toLocaleString(),
    };

    const updatedHeldSales = [
      ...heldSales,
      heldSale,
    ];

    setHeldSales(
      updatedHeldSales
    );

    localStorage.setItem(
      "heldSales",
      JSON.stringify(
        updatedHeldSales
      )
    );

    setCart([]);
    setCustomerPhone("");
    setCustomer(null);
    setRedeemPoints(0);
    setDiscount(0);
    setTax(0);
    setAmountReceived("");
    setSearchInput("");
    setMessage("");
  };

  const handleResumeSale = (
    heldId
  ) => {
    if (preventViewerAction()) {
      return;
    }

    if (cart.length > 0) {
      const confirmed =
        window.confirm(
          "Current cart will be replaced. Continue?"
        );

      if (!confirmed) {
        return;
      }
    }

    const heldSale =
      heldSales.find(
        (item) =>
          item.id === heldId
      );

    if (!heldSale) {
      return;
    }

    setCart(heldSale.cart || []);
    setCustomerPhone(
      heldSale.customer_phone || ""
    );
    setDiscount(
      heldSale.discount || 0
    );
    setTax(
      heldSale.tax || 0
    );
    setRedeemPoints(
      heldSale.redeem_points || 0
    );

    const updatedHeldSales =
      heldSales.filter(
        (item) =>
          item.id !== heldId
      );

    setHeldSales(
      updatedHeldSales
    );

    localStorage.setItem(
      "heldSales",
      JSON.stringify(
        updatedHeldSales
      )
    );

    setShowHeldPanel(false);
  };

  const handleDeleteHeldSale = (
    heldId
  ) => {
    if (preventViewerAction()) {
      return;
    }

    const confirmed =
      window.confirm(
        "Delete this held sale?"
      );

    if (!confirmed) {
      return;
    }

    const updatedHeldSales =
      heldSales.filter(
        (item) =>
          item.id !== heldId
      );

    setHeldSales(
      updatedHeldSales
    );

    localStorage.setItem(
      "heldSales",
      JSON.stringify(
        updatedHeldSales
      )
    );
  };

  if (showHistory) {
    return (
      <div className="sales-page">
        <div className="sales-history-back-bar">
          <button
            type="button"
            className="sales-history-back-btn"
            onClick={() =>
              setShowHistory(false)
            }
          >
            ← Back to POS
          </button>
        </div>

        {isViewer && (
          <div
            style={{
              marginBottom: "16px",
              padding: "12px 14px",
              border: "1px solid #bfdbfe",
              borderRadius: "10px",
              background: "#eff6ff",
              color: "#1e40af",
              fontWeight: 600,
            }}
          >
            👁 Demo Viewer mode: Sales history is
            read-only.
          </div>
        )}

        <SalesHistory />
      </div>
    );
  }

  return (
    <div className="sales-page">
      {isViewer && (
        <div
          style={{
            marginBottom: "16px",
            padding: "12px 14px",
            border: "1px solid #bfdbfe",
            borderRadius: "10px",
            background: "#eff6ff",
            color: "#1e40af",
            fontWeight: 600,
          }}
        >
          👁 Demo Viewer mode: You can see the full POS
          interface and sales history, but all selling
          actions are disabled.
        </div>
      )}

      {!isViewer && (
        <input
          ref={hiddenInputRef}
          type="text"
          autoComplete="off"
          onKeyDown={
            handleHiddenKeyDown
          }
          aria-hidden="true"
          style={{
            position: "absolute",
            opacity: 0,
            left: "-9999px",
            width: "1px",
            height: "1px",
          }}
        />
      )}

      <div className="sales-header">
        <div>
          <p className="sales-eyebrow">
            Point of Sale
          </p>

          <h2 className="sales-title">
            🧾 POS / Sales
          </h2>

          <p className="sales-subtitle">
            🏪 Store #{activeStoreId} • Billing
            Terminal
          </p>

          {!isViewer && (
            <small
              style={{
                color: "#22c55e",
                fontWeight: "bold",
                display: "block",
                marginTop: "4px",
              }}
            >
              🟢 Phone Scanner Mode Active
            </small>
          )}
        </div>

        <button
          type="button"
          className="sales-camera-btn"
          onClick={() =>
            setShowHistory(true)
          }
        >
          📄 Sales History
        </button>
      </div>

      <div className="sales-search-card">
        <form
          onSubmit={handleSearchSubmit}
          className="sales-search-form"
        >
          <span className="sales-search-icon">
            🔍
          </span>

          <input
            type="text"
            placeholder={
              isViewer
                ? "Search disabled in Viewer mode"
                : "Scan barcode or search by product name..."
            }
            value={searchInput}
            onChange={(event) =>
              setSearchInput(
                event.target.value
              )
            }
            className="sales-search-input"
            disabled={isViewer}
          />

          <button
            type="submit"
            className="sales-search-btn"
            disabled={isViewer}
          >
            Scan / Search
          </button>

          <button
            type="button"
            className="sales-camera-btn"
            onClick={() =>
              setShowScanner(true)
            }
            disabled={isViewer}
          >
            📷 Camera Scan
          </button>
        </form>

        {message && (
          <p className="sales-message">
            {message}
          </p>
        )}

        {filteredSuggestions.length >
          0 &&
          searchInput.trim() && (
            <div className="sales-suggestions">
              {filteredSuggestions.map(
                (product) => (
                  <button
                    key={product.id}
                    type="button"
                    className="sales-suggestion-item"
                    onClick={() =>
                      addToCart(product)
                    }
                    disabled={isViewer}
                  >
                    <div className="sales-suggestion-top">
                      <span className="sales-suggestion-name">
                        {product.name}
                      </span>

                      <span className="sales-suggestion-price">
                        ৳
                        {Number(
                          product.selling_price
                        ).toFixed(2)}
                      </span>
                    </div>

                    <div className="sales-suggestion-meta">
                      #
                      {product.barcode ||
                        "N/A"}
                    </div>
                  </button>
                )
              )}
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

                    <th className="w-qty">
                      Qty
                    </th>

                    <th>Total</th>

                    <th className="w-action" />
                  </tr>
                </thead>

                <tbody>
                  {cart.length === 0 ? (
                    <tr>
                      <td
                        colSpan="5"
                        className="sales-empty"
                      >
                        <div className="sales-empty-icon">
                          🛒
                        </div>

                        {isViewer
                          ? "Viewer mode — cart actions are disabled."
                          : "Cart is empty. Scan barcode or type product name."}
                      </td>
                    </tr>
                  ) : (
                    cart.map((item) => (
                      <tr key={item.id}>
                        <td>
                          <div className="sales-item-name">
                            {item.name}
                          </div>

                          <div className="sales-item-sub">
                            #{item.barcode}
                          </div>
                        </td>

                        <td>
                          {Number(
                            item.discount_percent
                          ) > 0 ? (
                            <div className="sales-price-discounted">
                              <span className="sales-price-original">
                                ৳
                                {Number(
                                  item.original_price
                                ).toFixed(2)}
                              </span>

                              <span className="sales-price-final">
                                ৳
                                {Number(
                                  item.selling_price
                                ).toFixed(2)}
                              </span>

                              <span className="sales-discount-badge">
                                {
                                  item.discount_percent
                                }
                                % off
                              </span>
                            </div>
                          ) : (
                            <span>
                              ৳
                              {Number(
                                item.selling_price
                              ).toFixed(2)}
                            </span>
                          )}
                        </td>

                        <td>
                          <input
                            type="number"
                            min="1"
                            value={
                              item.quantity
                            }
                            onChange={(event) =>
                              handleQuantityChange(
                                item.id,
                                event.target
                                  .value
                              )
                            }
                            className="sales-qty-input"
                            disabled={isViewer}
                          />
                        </td>

                        <td className="sales-item-total">
                          ৳
                          {(
                            Number(
                              item.selling_price
                            ) *
                            Number(
                              item.quantity
                            )
                          ).toFixed(2)}
                        </td>

                        <td>
                          <button
                            type="button"
                            onClick={() =>
                              handleRemoveItem(
                                item.id
                              )
                            }
                            className="sales-icon-btn danger"
                            disabled={isViewer}
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
            <button
              type="button"
              onClick={() =>
                setCart([])
              }
              className="sales-btn danger"
              disabled={
                isViewer ||
                cart.length === 0
              }
            >
              🗑 Clear Cart
            </button>

            <button
              type="button"
              onClick={handleHoldSale}
              disabled={
                isViewer ||
                cart.length === 0
              }
              className="sales-btn warning"
            >
              ⏸ Hold Sale
            </button>

            <button
              type="button"
              onClick={() =>
                setShowHeldPanel(true)
              }
              className="sales-btn purple"
              disabled={isViewer}
            >
              📋 Held Sales

              {heldSales.length > 0 && (
                <span className="sales-badge-count">
                  {heldSales.length}
                </span>
              )}
            </button>

            <div className="sales-inline-box">
              <label>
                Discount %
              </label>

              <input
                type="number"
                value={discount}
                onChange={(event) =>
                  setDiscount(
                    Number(
                      event.target.value
                    )
                  )
                }
                disabled={isViewer}
              />
            </div>
          </div>
        </div>

        <div className="sales-summary-card">
          <h3 className="sales-summary-title">
            💳 Billing Summary
          </h3>

          <SummaryRow
            label="Subtotal"
            value={`৳${subtotal.toFixed(
              2
            )}`}
          />

          <SummaryRow
            label="Discount"
            value={`-৳${discountAmount.toFixed(
              2
            )}`}
            color="var(--sales-danger)"
          />

          <SummaryRow
            label="Tax"
            value={`৳${taxAmount.toFixed(
              2
            )}`}
          />

          <div className="sales-field">
            <label>Tax %</label>

            <input
              type="number"
              value={tax}
              onChange={(event) =>
                setTax(
                  Number(
                    event.target.value
                  )
                )
              }
              className="sales-input"
              disabled={isViewer}
            />
          </div>

          <div className="sales-divider" />

          <div className="sales-total-box">
            <span>Total Payable</span>

            <strong>
              ৳
              {totalPayable.toFixed(
                2
              )}
            </strong>
          </div>

          <div className="sales-field">
            <label>
              Customer Phone *
            </label>

            <input
              type="tel"
              placeholder="01XXXXXXXXX"
              value={customerPhone}
              maxLength={11}
              onChange={(event) =>
                setCustomerPhone(
                  event.target.value.replace(/\D/g, "")
                )
              }
              className="sales-input"
              disabled={isViewer}
            />

            {customerLookupLoading && (
              <small className="sales-customer-note neutral">
                Checking customer...
              </small>
            )}

            {!customerLookupLoading &&
              customerLookupMessage && (
                <small className="sales-customer-note error">
                  {customerLookupMessage}
                </small>
              )}
          </div>

          {customer && (
            <div className="sales-loyalty-card">
              <div className="sales-loyalty-head">
                <div>
                  <small>Registered customer</small>
                  <strong>{customer.name}</strong>
                </div>

                <div className="sales-points-pill">
                  {Number(
                    customer.points_balance || 0
                  )} points
                </div>
              </div>

              <div className="sales-field sales-redeem-field">
                <label>Redeem Points</label>

                <select
                  value={redeemPoints}
                  onChange={(event) =>
                    setRedeemPoints(
                      Number(event.target.value)
                    )
                  }
                  className="sales-input"
                  disabled={
                    isViewer ||
                    maximumRedeemablePoints < 100
                  }
                >
                  <option value={0}>
                    Do not redeem
                  </option>

                  {Array.from(
                    {
                      length:
                        maximumRedeemablePoints / 100,
                    },
                    (_, index) =>
                      (index + 1) * 100
                  ).map((points) => (
                    <option
                      key={points}
                      value={points}
                    >
                      {points} points = ৳
                      {(points / 100) * 80}
                    </option>
                  ))}
                </select>
              </div>

              <div className="sales-loyalty-mini-grid">
                <span>Point discount</span>
                <strong>-৳{pointDiscount.toFixed(2)}</strong>
                <span>Estimated earn</span>
                <strong>+{estimatedEarnedPoints} points</strong>
              </div>
            </div>
          )}

          <SummaryRow
            label="Point Discount"
            value={`-৳${pointDiscount.toFixed(2)}`}
            color="var(--sales-danger)"
          />

          <div className="sales-field">
            <label>
              Payment Method
            </label>

            <select
              value={paymentMethod}
              onChange={(event) =>
                setPaymentMethod(
                  event.target.value
                )
              }
              className="sales-input"
              disabled={isViewer}
            >
              <option value="Cash">
                💵 Cash
              </option>

              <option value="Card">
                💳 Card
              </option>

              <option value="Bkash">
                📱 bKash / Wallet
              </option>
            </select>
          </div>

          <div className="sales-field">
            <label>
              Amount Received
            </label>

            <input
              type="number"
              placeholder="Enter given amount"
              value={amountReceived}
              onChange={(event) =>
                setAmountReceived(
                  event.target.value
                )
              }
              className="sales-input"
              disabled={isViewer}
            />
          </div>

          <div
            className={`sales-change ${
              changeAmount >= 0
                ? "ok"
                : "due"
            }`}
          >
            <span>Change / Due</span>

            <strong>
              ৳
              {changeAmount.toFixed(
                2
              )}
            </strong>
          </div>

          <button
            type="button"
            onClick={
              handleCompleteSale
            }
            disabled={
              isViewer ||
              cart.length === 0 ||
              !customer ||
              customerLookupLoading
            }
            className="sales-complete-btn"
          >
            ✔ Complete Sale
          </button>
        </div>
      </div>

      {showHeldPanel &&
        !isViewer && (
          <div className="sales-overlay">
            <div className="sales-modal">
              <h3 className="sales-modal-title">
                📋 Held Sales
              </h3>

              {heldSales.length === 0 ? (
                <p className="sales-modal-empty">
                  No held sales.
                </p>
              ) : (
                heldSales.map(
                  (heldSale) => {
                    const heldTotal =
                      heldSale.cart.reduce(
                        (sum, item) =>
                          sum +
                          Number(
                            item.selling_price
                          ) *
                            Number(
                              item.quantity
                            ),
                        0
                      );

                    return (
                      <div
                        key={
                          heldSale.id
                        }
                        className="sales-held-card"
                      >
                        <div className="sales-held-top">
                          <strong>
                            {heldSale.customer_phone ||
                              "Walk-in Customer"}
                          </strong>

                          <span>
                            {
                              heldSale.held_at
                            }
                          </span>
                        </div>

                        <p className="sales-held-text">
                          {
                            heldSale.cart
                              .length
                          }{" "}
                          item(s) — ৳
                          {heldTotal.toFixed(
                            2
                          )}
                        </p>

                        <div className="sales-held-actions">
                          <button
                            type="button"
                            onClick={() =>
                              handleResumeSale(
                                heldSale.id
                              )
                            }
                            className="sales-btn success small"
                          >
                            ▶ Resume
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              handleDeleteHeldSale(
                                heldSale.id
                              )
                            }
                            className="sales-btn danger small"
                          >
                            🗑️ Delete
                          </button>
                        </div>
                      </div>
                    );
                  }
                )
              )}

              <button
                type="button"
                onClick={() =>
                  setShowHeldPanel(false)
                }
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

      {!isViewer && (
        <BarcodeScanner
          open={showScanner}
          onClose={() =>
            setShowScanner(false)
          }
          onScanSuccess={
            handleScanSuccess
          }
          title="Scan Product to Add"
        />
      )}
    </div>
  );
}

function SummaryRow({
  label,
  value,
  color,
}) {
  return (
    <div className="sales-summary-row">
      <span>{label}</span>

      <strong
        style={{
          color:
            color ||
            "var(--sales-text)",
        }}
      >
        {value}
      </strong>
    </div>
  );
}

export default Sales;
