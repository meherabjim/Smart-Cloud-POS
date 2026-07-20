import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import axios from "axios";
import "./CustomerPortal.css";

const API_BASE_URL = "https://smart-cloud-pos.onrender.com";

const api = axios.create({
  baseURL: API_BASE_URL,
});

const money = (value) =>
  `à§³${Number(value || 0).toFixed(2)}`;

function CustomerPortal({ onBack }) {
  const [token, setToken] = useState(
    () => localStorage.getItem("customerToken") || ""
  );
  const [customer, setCustomer] = useState(null);
  const [mode, setMode] = useState("login");
  const [activeTab, setActiveTab] = useState("overview");

  const [loginForm, setLoginForm] = useState({
    login: "",
    password: "",
  });

  const [registerForm, setRegisterForm] = useState({
    name: "",
    phone: "",
    email: "",
    password: "",
  });

  const [stores, setStores] = useState([]);
  const [products, setProducts] = useState([]);
  const [discountedProducts, setDiscountedProducts] =
    useState([]);
  const [transactions, setTransactions] = useState([]);

  const [selectedStoreId, setSelectedStoreId] =
    useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(Boolean(token));
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");

  const customerApi = useMemo(() => {
    const instance = axios.create({
      baseURL: API_BASE_URL,
    });

    instance.interceptors.request.use((config) => {
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }

      return config;
    });

    return instance;
  }, [token]);

  const logout = useCallback(() => {
    localStorage.removeItem("customerToken");
    setToken("");
    setCustomer(null);
    setStores([]);
    setProducts([]);
    setDiscountedProducts([]);
    setTransactions([]);
    setSelectedStoreId("");
    setSearch("");
    setMessage("");
    setActiveTab("overview");
  }, []);

  const loadPortalData = useCallback(async () => {
    if (!token) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const [
        profileRes,
        storesRes,
        productsRes,
        discountedRes,
        historyRes,
      ] = await Promise.all([
        customerApi.get("/api/customers/me"),
        customerApi.get("/api/customers/stores"),
        customerApi.get("/api/customers/products"),
        customerApi.get(
          "/api/customers/products/discounted"
        ),
        customerApi.get(
          "/api/customers/points/history"
        ),
      ]);

      setCustomer(profileRes.data.customer || null);
      setStores(storesRes.data.stores || []);
      setProducts(productsRes.data.products || []);
      setDiscountedProducts(
        discountedRes.data.products || []
      );
      setTransactions(
        historyRes.data.transactions || []
      );
    } catch (error) {
      const status = error.response?.status;

      if (status === 401 || status === 403) {
        logout();
        setMessage(
          "Your customer session expired. Please login again."
        );
      } else {
        setMessage(
          error.response?.data?.message ||
            "Failed to load customer portal."
        );
      }
    } finally {
      setLoading(false);
    }
  }, [customerApi, logout, token]);

  useEffect(() => {
    loadPortalData();
  }, [loadPortalData]);

  const handleLogin = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setMessage("");

    try {
      const response = await api.post(
        "/api/customers/login",
        {
          phone: loginForm.login,
          email: loginForm.login,
          password: loginForm.password,
        }
      );

      const nextToken = response.data.token;

      localStorage.setItem("customerToken", nextToken);
      setToken(nextToken);
      setCustomer(response.data.customer || null);
      setLoginForm({
        login: "",
        password: "",
      });
    } catch (error) {
      setMessage(
        error.response?.data?.message ||
          "Customer login failed."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleRegister = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setMessage("");

    try {
      await api.post("/api/customers/register", {
        name: registerForm.name,
        phone: registerForm.phone,
        email: registerForm.email || null,
        password: registerForm.password,
      });

      setLoginForm({
        login: registerForm.phone,
        password: registerForm.password,
      });

      setRegisterForm({
        name: "",
        phone: "",
        email: "",
        password: "",
      });

      setMode("login");
      setMessage(
        "Registration successful. Login with your phone number."
      );
    } catch (error) {
      setMessage(
        error.response?.data?.message ||
          "Customer registration failed."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const refreshProducts = async () => {
    setLoading(true);
    setMessage("");

    try {
      const params = {};

      if (selectedStoreId) {
        params.store_id = selectedStoreId;
      }

      if (search.trim()) {
        params.search = search.trim();
      }

      const response = await customerApi.get(
        "/api/customers/products",
        { params }
      );

      setProducts(response.data.products || []);
    } catch (error) {
      setMessage(
        error.response?.data?.message ||
          "Failed to search products."
      );
    } finally {
      setLoading(false);
    }
  };

  const resetProductFilters = async () => {
    setSelectedStoreId("");
    setSearch("");
    setLoading(true);

    try {
      const response = await customerApi.get(
        "/api/customers/products"
      );

      setProducts(response.data.products || []);
    } catch (error) {
      setMessage(
        error.response?.data?.message ||
          "Failed to reset products."
      );
    } finally {
      setLoading(false);
    }
  };

  const totalEarned = transactions
    .filter(
      (item) => item.transaction_type === "EARN"
    )
    .reduce(
      (sum, item) => sum + Number(item.points || 0),
      0
    );

  const totalRedeemed = transactions
    .filter(
      (item) => item.transaction_type === "REDEEM"
    )
    .reduce(
      (sum, item) => sum + Number(item.points || 0),
      0
    );

  if (!token || !customer) {
    return (
      <div className="customer-auth-page">
        <div className="customer-auth-card">
          <section className="customer-auth-hero">
            <button
              type="button"
              className="customer-back-btn"
              onClick={onBack}
            >
              â† Staff login
            </button>

            <div className="customer-brand-badge">
              Cloud POS Loyalty
            </div>

            <h1>
              Earn points every time you shop
            </h1>

            <p>
              Check your balance, offers, product
              availability and point history from one
              place.
            </p>

            <div className="customer-rule-list">
              <div>
                <strong>à§³100</strong>
                <span>Earn 1 point</span>
              </div>

              <div>
                <strong>100 points</strong>
                <span>Get à§³80 discount</span>
              </div>

              <div>
                <strong>All stores</strong>
                <span>Use points anywhere</span>
              </div>
            </div>
          </section>

          <section className="customer-auth-panel">
            <div className="customer-auth-tabs">
              <button
                type="button"
                className={
                  mode === "login" ? "active" : ""
                }
                onClick={() => {
                  setMode("login");
                  setMessage("");
                }}
              >
                Login
              </button>

              <button
                type="button"
                className={
                  mode === "register" ? "active" : ""
                }
                onClick={() => {
                  setMode("register");
                  setMessage("");
                }}
              >
                Register
              </button>
            </div>

            {mode === "login" ? (
              <form
                className="customer-auth-form"
                onSubmit={handleLogin}
              >
                <h2>Customer login</h2>

                <label>
                  Phone number or email
                  <input
                    value={loginForm.login}
                    onChange={(event) =>
                      setLoginForm((current) => ({
                        ...current,
                        login: event.target.value,
                      }))
                    }
                    placeholder="01700000000"
                    required
                  />
                </label>

                <label>
                  Password
                  <input
                    type="password"
                    value={loginForm.password}
                    onChange={(event) =>
                      setLoginForm((current) => ({
                        ...current,
                        password:
                          event.target.value,
                      }))
                    }
                    placeholder="Enter password"
                    required
                  />
                </label>

                {message && (
                  <div className="customer-form-message">
                    {message}
                  </div>
                )}

                <button
                  type="submit"
                  className="customer-primary-btn"
                  disabled={submitting}
                >
                  {submitting
                    ? "Logging in..."
                    : "Login"}
                </button>
              </form>
            ) : (
              <form
                className="customer-auth-form"
                onSubmit={handleRegister}
              >
                <h2>Create customer account</h2>

                <label>
                  Full name
                  <input
                    value={registerForm.name}
                    onChange={(event) =>
                      setRegisterForm(
                        (current) => ({
                          ...current,
                          name: event.target.value,
                        })
                      )
                    }
                    placeholder="Your name"
                    required
                  />
                </label>

                <label>
                  Phone number
                  <input
                    value={registerForm.phone}
                    onChange={(event) =>
                      setRegisterForm(
                        (current) => ({
                          ...current,
                          phone:
                            event.target.value,
                        })
                      )
                    }
                    placeholder="01700000000"
                    required
                  />
                </label>

                <label>
                  Email (optional)
                  <input
                    type="email"
                    value={registerForm.email}
                    onChange={(event) =>
                      setRegisterForm(
                        (current) => ({
                          ...current,
                          email:
                            event.target.value,
                        })
                      )
                    }
                    placeholder="name@example.com"
                  />
                </label>

                <label>
                  Password
                  <input
                    type="password"
                    minLength={6}
                    value={registerForm.password}
                    onChange={(event) =>
                      setRegisterForm(
                        (current) => ({
                          ...current,
                          password:
                            event.target.value,
                        })
                      )
                    }
                    placeholder="Minimum 6 characters"
                    required
                  />
                </label>

                {message && (
                  <div className="customer-form-message">
                    {message}
                  </div>
                )}

                <button
                  type="submit"
                  className="customer-primary-btn"
                  disabled={submitting}
                >
                  {submitting
                    ? "Creating account..."
                    : "Register"}
                </button>
              </form>
            )}
          </section>
        </div>
      </div>
    );
  }

  return (
    <div className="customer-portal">
      <header className="customer-portal-header">
        <div>
          <span className="customer-brand-badge">
            Cloud POS Loyalty
          </span>

          <h1>
            Welcome, {customer.name}
          </h1>

          <p>
            {customer.phone}
            {customer.email
              ? ` Â· ${customer.email}`
              : ""}
          </p>
        </div>

        <div className="customer-header-actions">
          <button
            type="button"
            onClick={loadPortalData}
          >
            Refresh
          </button>

          <button
            type="button"
            onClick={logout}
          >
            Logout
          </button>

          <button
            type="button"
            onClick={onBack}
          >
            Staff login
          </button>
        </div>
      </header>

      <nav className="customer-portal-nav">
        {[
          ["overview", "Overview"],
          ["offers", "Discounted Products"],
          ["products", "All Products"],
          ["stores", "Stores"],
          ["history", "Point History"],
        ].map(([key, label]) => (
          <button
            type="button"
            key={key}
            className={
              activeTab === key ? "active" : ""
            }
            onClick={() => setActiveTab(key)}
          >
            {label}
          </button>
        ))}
      </nav>

      {message && (
        <div className="customer-page-message">
          {message}
        </div>
      )}

      {loading ? (
        <div className="customer-loading">
          Loading customer portal...
        </div>
      ) : (
        <main className="customer-portal-main">
          {activeTab === "overview" && (
            <>
              <section className="customer-stat-grid">
                <article>
                  <span>Available points</span>
                  <strong>
                    {Number(
                      customer.points_balance || 0
                    )}
                  </strong>
                  <small>
                    Redeem from 100 points
                  </small>
                </article>

                <article>
                  <span>Total points earned</span>
                  <strong>{totalEarned}</strong>
                  <small>
                    Across all completed sales
                  </small>
                </article>

                <article>
                  <span>Total points redeemed</span>
                  <strong>{totalRedeemed}</strong>
                  <small>
                    100 points = à§³80
                  </small>
                </article>

                <article>
                  <span>Current offers</span>
                  <strong>
                    {discountedProducts.length}
                  </strong>
                  <small>
                    Discounted products in stock
                  </small>
                </article>
              </section>

              <section className="customer-section">
                <div className="customer-section-head">
                  <div>
                    <h2>Current offers</h2>
                    <p>
                      Best available discounts across
                      all stores
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      setActiveTab("offers")
                    }
                  >
                    View all
                  </button>
                </div>

                <ProductGrid
                  products={discountedProducts.slice(
                    0,
                    4
                  )}
                  emptyText="No discounted products are available."
                />
              </section>

            </>
          )}

          {activeTab === "offers" && (
            <section className="customer-section">
              <div className="customer-section-head">
                <div>
                  <h2>Discounted products</h2>
                  <p>
                    Store-wise offers currently in
                    stock
                  </p>
                </div>
              </div>

              <ProductGrid
                products={discountedProducts}
                emptyText="No discounted products are available."
              />
            </section>
          )}

          {activeTab === "products" && (
            <section className="customer-section">
              <div className="customer-section-head customer-products-head">
                <div>
                  <h2>All available products</h2>
                  <p>
                    Search by product, category,
                    barcode or store
                  </p>
                </div>

                <div className="customer-product-filters">
                  <input
                    value={search}
                    onChange={(event) =>
                      setSearch(event.target.value)
                    }
                    placeholder="Search products..."
                  />

                  <select
                    value={selectedStoreId}
                    onChange={(event) =>
                      setSelectedStoreId(
                        event.target.value
                      )
                    }
                  >
                    <option value="">
                      All stores
                    </option>

                    {stores.map((store) => (
                      <option
                        key={store.id}
                        value={store.id}
                      >
                        {store.name}
                      </option>
                    ))}
                  </select>

                  <button
                    type="button"
                    onClick={refreshProducts}
                  >
                    Search
                  </button>

                  <button
                    type="button"
                    onClick={resetProductFilters}
                  >
                    Reset
                  </button>
                </div>
              </div>

              <ProductGrid
                products={products}
                emptyText="No available products found."
              />
            </section>
          )}

          {activeTab === "stores" && (
            <section className="customer-section">
              <div className="customer-section-head">
                <div>
                  <h2>Our stores</h2>
                  <p>
                    See how many products are
                    currently available
                  </p>
                </div>
              </div>

              <div className="customer-store-grid">
                {stores.map((store) => (
                  <article key={store.id}>
                    <div>ðŸª</div>
                    <h3>{store.name}</h3>
                    <p>
                      {store.location ||
                        "Location not specified"}
                    </p>
                    <strong>
                      {store.available_products}{" "}
                      available product
                      {Number(
                        store.available_products
                      ) === 1
                        ? ""
                        : "s"}
                    </strong>
                  </article>
                ))}
              </div>
            </section>
          )}

          {activeTab === "history" && (
            <section className="customer-section">
              <div className="customer-section-head">
                <div>
                  <h2>Point history</h2>
                  <p>
                    Complete loyalty earn and redeem
                    records
                  </p>
                </div>
              </div>

              <HistoryTable
                transactions={transactions}
              />
            </section>
          )}
        </main>
      )}
    </div>
  );
}

function ProductGrid({ products, emptyText }) {
  if (!products.length) {
    return (
      <div className="customer-empty-state">
        {emptyText}
      </div>
    );
  }

  return (
    <div className="customer-product-grid">
      {products.map((product) => {
        const originalPrice = Number(
          product.selling_price || 0
        );

        const discount = Number(
          product.discount_percent || 0
        );

        const finalPrice = Number(
          product.discounted_price ??
            product.final_price ??
            originalPrice
        );

        return (
          <article
            className="customer-product-card"
            key={`${product.store_id}-${product.id}`}
          >
            <div className="customer-product-card-top">
              <span>{product.category || "General"}</span>

              {discount > 0 && (
                <strong>{discount}% OFF</strong>
              )}
            </div>

            <h3>{product.name}</h3>

            <p>
              ðŸª {product.store_name}
            </p>

            {product.store_location && (
              <small>
                {product.store_location}
              </small>
            )}

            <div className="customer-product-price">
              <strong>{money(finalPrice)}</strong>

              {discount > 0 && (
                <del>{money(originalPrice)}</del>
              )}
            </div>

            <div className="customer-product-stock">
              {Number(product.stock)} in stock
            </div>
          </article>
        );
      })}
    </div>
  );
}

function HistoryTable({ transactions }) {
  if (!transactions.length) {
    return (
      <div className="customer-empty-state">
        No point transactions yet.
      </div>
    );
  }

  return (
    <div className="customer-history-wrap">
      <table className="customer-history-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Store</th>
            <th>Type</th>
            <th>Points</th>
            <th>Value / Sale</th>
            <th>Balance</th>
          </tr>
        </thead>

        <tbody>
          {transactions.map((item) => {
            const isEarn =
              item.transaction_type === "EARN";

            return (
              <tr key={item.id}>
                <td>
                  {new Date(
                    item.created_at
                  ).toLocaleString()}
                </td>

                <td>
                  {item.store_name ||
                    `Store #${item.store_id || "-"}`}
                </td>

                <td>
                  <span
                    className={
                      isEarn
                        ? "customer-history-earn"
                        : "customer-history-redeem"
                    }
                  >
                    {item.transaction_type}
                  </span>
                </td>

                <td>
                  {isEarn ? "+" : "-"}
                  {Number(item.points || 0)}
                </td>

                <td>
                  {money(item.amount_value)}
                </td>

                <td>
                  {Number(
                    item.balance_after || 0
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default CustomerPortal;
