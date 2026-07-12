import React, { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import Dashboard from "./pages/Dashboard";
import Products from "./pages/Products";
import Inventory from "./pages/Inventory";
import Sales from "./pages/Sales";
import Reports from "./pages/Reports";
import Stores from "./pages/Stores";
import Users from "./pages/Users";
import Settings from "./pages/Settings";
import Account from "./pages/Account";
import Damaged from "./pages/Damaged";
import "./App.css";

const API = axios.create({
  baseURL: "http://127.0.0.1:5000",
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

function App() {
  const isBrowser = typeof window !== "undefined";

  const [user, setUser] = useState(null);
  const [activeStoreId, setActiveStoreId] = useState(null);
  const [page, setPage] = useState("dashboard");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [isMobile, setIsMobile] = useState(
    isBrowser ? window.innerWidth <= 992 : false
  );
  const [sidebarOpen, setSidebarOpen] = useState(
    isBrowser ? window.innerWidth > 992 : true
  );

  const menuItems = useMemo(
    () => [
      {
        key: "dashboard",
        label: "Dashboard",
        icon: "📊",
        roles: ["Admin"],
      },
      {
        key: "products",
        label: "Products",
        icon: "📦",
        roles: ["Admin", "Manager", "Store Keeper"],
      },
      {
        key: "inventory",
        label: "Inventory",
        icon: "🔄",
        roles: ["Admin", "Manager", "Store Keeper"],
      },
      {
        key: "sales",
        label: "POS / Sales",
        icon: "🛒",
        roles: ["Admin", "Cashier"],
      },
      {
        key: "reports",
        label: "Reports",
        icon: "📈",
        roles: ["Admin", "Manager"],
      },
      {
        key: "damaged",
        label: "Damaged / Spoiled",
        icon: "🗑️",
        roles: ["Admin", "Manager", "Store Keeper"],
      },
      {
        key: "stores",
        label: "Stores",
        icon: "🏪",
        roles: ["Admin"],
      },
      {
        key: "users",
        label: "Users",
        icon: "👥",
        roles: ["Admin"],
      },
      {
        key: "settings",
        label: "Settings",
        icon: "⚙️",
        roles: ["Admin"],
      },
      {
        key: "account",
        label: "My Account",
        icon: "🔑",
        roles: ["Admin", "Manager", "Cashier", "Store Keeper"],
      },
    ],
    []
  );

  const getDefaultPageByRole = useCallback((role) => {
    if (role === "Cashier") return "sales";
    if (role === "Store Keeper") return "inventory";
    if (role === "Manager") return "products";
    return "dashboard";
  }, []);

  const getAllowedPages = useCallback(
    (role) => {
      return menuItems.filter((item) => item.roles.includes(role)).map((item) => item.key);
    },
    [menuItems]
  );

  useEffect(() => {
    if (!isBrowser) return;

    const handleResize = () => {
      const mobile = window.innerWidth <= 992;
      setIsMobile(mobile);
      setSidebarOpen(!mobile);
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [isBrowser]);

  useEffect(() => {
    const initAuth = async () => {
      try {
        const token = localStorage.getItem("token");

        if (!token) {
          setCheckingAuth(false);
          return;
        }

        const res = await API.get("/api/auth/me");
        const loggedInUser = res.data;

        setUser(loggedInUser);
        setActiveStoreId(loggedInUser.store_id || null);

        localStorage.setItem("user", JSON.stringify(loggedInUser));

        if (loggedInUser.store_id) {
          localStorage.setItem("activeStoreId", String(loggedInUser.store_id));
        } else {
          localStorage.removeItem("activeStoreId");
        }

        setPage(getDefaultPageByRole(loggedInUser.role));
      } catch (error) {
        console.error("Auth init failed:", error);
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        localStorage.removeItem("activeStoreId");
        setUser(null);
        setActiveStoreId(null);
      } finally {
        setCheckingAuth(false);
      }
    };

    initAuth();
  }, [getDefaultPageByRole]);

  useEffect(() => {
    if (!user) return;

    const allowedPages = getAllowedPages(user.role);
    if (!allowedPages.includes(page)) {
      setPage(getDefaultPageByRole(user.role));
    }
  }, [page, user, getAllowedPages, getDefaultPageByRole]);

  useEffect(() => {
    if (activeStoreId) {
      localStorage.setItem("activeStoreId", String(activeStoreId));
    } else {
      localStorage.removeItem("activeStoreId");
    }
  }, [activeStoreId]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setMessage("");

    try {
      const res = await API.post("/api/auth/login", {
        email,
        password,
      });

      const loggedInUser = res.data.user;
      const token = res.data.token;

      localStorage.setItem("token", token);
      localStorage.setItem("user", JSON.stringify(loggedInUser));

      setUser(loggedInUser);
      setActiveStoreId(loggedInUser.store_id || null);

      if (loggedInUser.store_id) {
        localStorage.setItem("activeStoreId", String(loggedInUser.store_id));
      } else {
        localStorage.removeItem("activeStoreId");
      }

      setPage(getDefaultPageByRole(loggedInUser.role));
      setEmail("");
      setPassword("");
      setMessage("");
    } catch (err) {
      setMessage(
        err.response?.data?.message || "Login failed! Email or password incorrect."
      );
    }
  };

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    localStorage.removeItem("activeStoreId");
    setUser(null);
    setActiveStoreId(null);
    setPage("dashboard");
    setEmail("");
    setPassword("");
    setMessage("");
    setSidebarOpen(!isMobile);
  };

  const pageTitle = useMemo(() => {
    const titles = {
      dashboard: "Dashboard",
      products: "Products",
      inventory: "Inventory",
      sales: "POS / Sales",
      reports: "Reports",
      stores: "Stores",
      users: "Users",
      settings: "Settings",
      damaged: "Damaged / Spoiled",
      account: "My Account",
    };
    return titles[page] || "Dashboard";
  }, [page]);

  const goToPage = (targetPage) => {
    if (!user) return;

    const allowedPages = getAllowedPages(user.role);
    if (!allowedPages.includes(targetPage)) {
      setPage(getDefaultPageByRole(user.role));
      return;
    }

    setPage(targetPage);

    if (isMobile) {
      setSidebarOpen(false);
    }
  };

  const renderPage = () => {
    if (!user) return null;

    const allowedPages = getAllowedPages(user.role);
    if (!allowedPages.includes(page)) {
      return <Dashboard user={user} activeStoreId={activeStoreId} />;
    }

    switch (page) {
      case "dashboard":
        return <Dashboard user={user} activeStoreId={activeStoreId} />;
      case "products":
        return <Products user={user} activeStoreId={activeStoreId} />;
      case "inventory":
        return <Inventory user={user} activeStoreId={activeStoreId} />;
      case "sales":
        return <Sales user={user} activeStoreId={activeStoreId} />;
      case "reports":
        return <Reports user={user} activeStoreId={activeStoreId} />;
      case "stores":
        return <Stores user={user} activeStoreId={activeStoreId} />;
      case "users":
        return <Users user={user} activeStoreId={activeStoreId} />;
      case "settings":
        return <Settings user={user} activeStoreId={activeStoreId} />;
      case "account":
        return <Account user={user} activeStoreId={activeStoreId} />;
      case "damaged":
        return <Damaged user={user} activeStoreId={activeStoreId} />;
      default:
        return <Dashboard user={user} activeStoreId={activeStoreId} />;
    }
  };

  if (checkingAuth) {
    return (
      <div className="screen-center">
        <div className="loader-card">
          <div className="loader-spinner"></div>
          <p>Checking login...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="login-shell">
        <div className="login-card">
          <section className="login-hero">
            <div className="hero-badge">☁ Cloud POS</div>
            <h1>Retail management that feels fast, clean and reliable</h1>
            <p>
              Track sales, inventory, stores, reports and users from one
              professional control panel.
            </p>

            <div className="hero-points">
              <div className="hero-point">
                <span>⚡</span>
                <div>
                  <strong>Fast billing</strong>
                  <small>Quick POS workflow for daily sales operations.</small>
                </div>
              </div>

              <div className="hero-point">
                <span>📦</span>
                <div>
                  <strong>Stock control</strong>
                  <small>Monitor products and inventory movement easily.</small>
                </div>
              </div>

              <div className="hero-point">
                <span>📊</span>
                <div>
                  <strong>Smart reports</strong>
                  <small>See business performance in a structured way.</small>
                </div>
              </div>
            </div>
          </section>

          <section className="login-panel">
            <form className="login-form" onSubmit={handleLogin}>
              <div className="login-form-head">
                <h2>Welcome back</h2>
                <p>Login with your account credentials</p>
              </div>

              <div className="form-group">
                <label htmlFor="email">Email address</label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="password">Password</label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                />
              </div>

              <div className={`form-message ${message ? "show" : ""}`}>
                {message || " "}
              </div>

              <button type="submit" className="btn-primary">
                Login
              </button>
            </form>
          </section>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      {sidebarOpen && isMobile && (
        <div
          className="sidebar-backdrop"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside className={`sidebar ${sidebarOpen ? "open" : ""}`}>
        <div className="sidebar-top">
          <div className="brand">
            <div className="brand-mark">☁</div>
            <div>
              <h2>Cloud POS</h2>
              <p>Retail Control Panel</p>
            </div>
          </div>

          {isMobile && (
            <button
              className="sidebar-close"
              onClick={() => setSidebarOpen(false)}
              aria-label="Close sidebar"
            >
              ✕
            </button>
          )}
        </div>

        <nav className="sidebar-nav">
          {menuItems
            .filter((item) => item.roles.includes(user.role))
            .map((item) => (
              <button
                key={item.key}
                className={`nav-btn ${page === item.key ? "active" : ""}`}
                onClick={() => goToPage(item.key)}
                type="button"
              >
                <span className="nav-icon">{item.icon}</span>
                <span>{item.label}</span>
              </button>
            ))}
        </nav>

        <div className="sidebar-footer">
          <div className="profile-card">
            <div className="profile-avatar">{user.name?.charAt(0) || "U"}</div>
            <div>
              <strong>{user.name}</strong>
              <small>
                {user.role} ·{" "}
                {user.role === "Admin"
                  ? "All Stores"
                  : `Store #${activeStoreId || "-"}`}
              </small>
            </div>
          </div>

          <button className="logout-btn" onClick={logout} type="button">
            🚪 Logout
          </button>
        </div>
      </aside>

      <main className="main-panel">
        <header className="topbar">
          <div className="topbar-left">
            {isMobile && (
              <button
                className="menu-toggle"
                onClick={() => setSidebarOpen(true)}
                aria-label="Open sidebar"
                type="button"
              >
                ☰
              </button>
            )}

            <div>
              <h1>{pageTitle}</h1>
              <p>Cloud POS & Inventory Management System</p>
            </div>
          </div>

          <div className="topbar-right">
            <div className="topbar-user">
              <span className="user-dot"></span>
              <span>
                {user.name} · {user.role} ·{" "}
                {user.role === "Admin"
                  ? "All Stores"
                  : `Store #${activeStoreId || "-"}`}
              </span>
            </div>
          </div>
        </header>

        <section className="content-area">{renderPage()}</section>
      </main>
    </div>
  );
}

export default App;