import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
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
import Attendance from "./pages/Attendance";
import Expenses from "./pages/Expenses";
import Suppliers from "./pages/Suppliers";
import Salary from "./pages/Salary";
import AttendanceCamera from "./pages/AttendanceCamera";
import FaceCapture from "./pages/FaceCapture";
import AiInsights from "./pages/AiInsights";
import CustomerPortal from "./pages/CustomerPortal";
import Customers from "./pages/Customers";
import PayoutSetup from "./pages/PayoutSetup";
import AiWidget from "./components/AiWidget";
import Icon from "./components/Icon";

import "./App.css";

// Sidebar groups, in this order
const NAV_SECTIONS = ["Overview", "Operations", "People", "Finance", "Settings"];

const todayLabel = () =>
  new Date().toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

const API = axios.create({
  baseURL: process.env.REACT_APP_API_URL || "https://smart-cloud-pos.onrender.com",
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
  const [showCustomerPortal, setShowCustomerPortal] = useState(false);
  const [activeStoreId, setActiveStoreId] = useState(null);
  const [page, setPage] = useState("dashboard");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");

  const [checkingAuth, setCheckingAuth] = useState(true);

  // First-login face registration
  const [needFace, setNeedFace] = useState(false);
  // First-login salary account setup (after face)
  const [needPayout, setNeedPayout] = useState(false);

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
        icon: "dashboard",
        section: "Overview",
        roles: ["Admin"],
      },
      {
        key: "products",
        label: "Products",
        icon: "products",
        section: "Operations",
        roles: ["Admin", "Manager", "Store Keeper"],
      },
      {
        key: "inventory",
        label: "Inventory",
        icon: "inventory",
        section: "Operations",
        roles: ["Admin", "Manager", "Store Keeper"],
      },
      {
        key: "sales",
        label: "POS / Sales",
        icon: "sales",
        section: "Operations",
        roles: ["Admin", "Cashier"],
      },
      {
        key: "reports",
        label: "Reports",
        icon: "reports",
        section: "Overview",
        roles: ["Admin", "Manager"],
      },
      {
        key: "damaged",
        label: "Damaged / Spoiled",
        icon: "damaged",
        section: "Operations",
        roles: ["Admin", "Manager", "Store Keeper"],
      },
      {
        key: "attendance",
        label: "Attendance",
        icon: "attendance",
        section: "People",
        roles: ["Admin", "Manager"],
      },
      {
        key: "attendance-camera",
        label: "Attendance Camera",
        icon: "camera",
        section: "People",
        roles: ["Admin", "Manager"],
      },
      {
        key: "salary",
        label: "Salary",
        icon: "salary",
        section: "Finance",
        roles: ["Admin"],
      },
      {
        key: "expenses",
        label: "Expenses",
        icon: "expenses",
        section: "Finance",
        roles: ["Admin", "Manager"],
      },
      {
        key: "suppliers",
        label: "Suppliers / Due",
        icon: "suppliers",
        section: "Finance",
        roles: ["Admin", "Manager"],
      },
      {
        key: "ai-insights",
        label: "AI Insights",
        icon: "ai",
        section: "Overview",
        roles: ["Admin", "Manager"],
      },
      {
        key: "stores",
        label: "Stores",
        icon: "stores",
        section: "Settings",
        roles: ["Admin"],
      },
      {
        key: "users",
        label: "Workers",
        icon: "users",
        section: "People",
        roles: ["Admin"],
      },
      {
        key: "customers",
        label: "Customers",
        icon: "customers",
        section: "People",
        roles: ["Admin"],
      },
      {
        key: "settings",
        label: "Settings",
        icon: "settings",
        section: "Settings",
        roles: ["Admin"],
      },
      {
        key: "account",
        label: "My Account",
        icon: "account",
        section: "Settings",
        roles: ["Admin", "Manager", "Cashier", "Store Keeper"],
      },
    ],
    []
  );

  const getDefaultPageByRole = useCallback((role) => {
    if (role === "Cashier") {
      return "sales";
    }

    if (role === "Store Keeper") {
      return "inventory";
    }

    if (role === "Manager") {
      return "products";
    }

    return "dashboard";
  }, []);

  const getAllowedPages = useCallback(
    (role) => {
      return menuItems
        .filter((item) => item.roles.includes(role))
        .map((item) => item.key);
    },
    [menuItems]
  );

  // Only Admin can switch between stores;
  // every other role always works in its own store.
  const hasAllStoreAccess = useCallback((role) => {
    return role === "Admin";
  }, []);

  const pickStoreId = useCallback(
    (loggedInUser) => {
      const ownStore = Number(loggedInUser?.store_id) || null;

      if (!hasAllStoreAccess(loggedInUser?.role)) {
        return ownStore;
      }

      return Number(localStorage.getItem("activeStoreId")) || ownStore;
    },
    [hasAllStoreAccess]
  );

  // AI chat is only for Admin and Manager
  const canUseAi = user?.role === "Admin" || user?.role === "Manager";

  useEffect(() => {
    if (!isBrowser) {
      return undefined;
    }

    const handleResize = () => {
      const mobile = window.innerWidth <= 992;

      setIsMobile(mobile);
      setSidebarOpen(!mobile);
    };

    handleResize();

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
    };
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

        const initialStoreId = pickStoreId(loggedInUser);

        setActiveStoreId(initialStoreId);

        localStorage.setItem(
          "user",
          JSON.stringify(loggedInUser)
        );

        if (initialStoreId) {
          localStorage.setItem(
            "activeStoreId",
            String(initialStoreId)
          );
        } else {
          localStorage.removeItem("activeStoreId");
        }

        setPage(
          getDefaultPageByRole(loggedInUser.role)
        );
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
  }, [getDefaultPageByRole, pickStoreId]);

  // When the window gets focus again, re-check the account.
  // Admin may have changed the role/store, or disabled/deleted the account.
  useEffect(() => {
    if (!user) {
      return undefined;
    }

    const refreshUser = async () => {
      try {
        const res = await API.get("/api/auth/me");
        const fresh = res.data;

        if (
          fresh.role !== user.role ||
          Number(fresh.store_id) !== Number(user.store_id)
        ) {
          localStorage.setItem("user", JSON.stringify(fresh));
          setUser(fresh);

          if (!hasAllStoreAccess(fresh.role)) {
            setActiveStoreId(Number(fresh.store_id) || null);
          }
        }
      } catch (error) {
        const status = error.response?.status;

        if (status === 401 || status === 403) {
          localStorage.removeItem("token");
          localStorage.removeItem("user");
          localStorage.removeItem("activeStoreId");
          setUser(null);
          setActiveStoreId(null);
          setMessage(
            error.response?.data?.message ||
              "Please login again."
          );
        }
      }
    };

    window.addEventListener("focus", refreshUser);

    return () => {
      window.removeEventListener("focus", refreshUser);
    };
  }, [user, hasAllStoreAccess]);

  useEffect(() => {
    if (!user) {
      return;
    }

    const allowedPages = getAllowedPages(user.role);

    if (!allowedPages.includes(page)) {
      setPage(getDefaultPageByRole(user.role));
    }
  }, [
    page,
    user,
    getAllowedPages,
    getDefaultPageByRole,
  ]);

  useEffect(() => {
    if (activeStoreId) {
      localStorage.setItem(
        "activeStoreId",
        String(activeStoreId)
      );
    } else {
      localStorage.removeItem("activeStoreId");
    }
  }, [activeStoreId]);

  // After login, check if this user still needs to register their face.
  useEffect(() => {
    if (!user) {
      setNeedFace(false);
      setNeedPayout(false);
      return;
    }

    API.get("/api/face/status")
      .then((res) => {
        setNeedFace(!res.data?.face_registered);
        setNeedPayout(Boolean(res.data?.needs_payout));
      })
      .catch(() => {
        setNeedFace(false);
        setNeedPayout(false);
      });
  }, [user]);

  // Keep the active store in sync when it is switched anywhere.
  useEffect(() => {
    const syncStore = (event) => {
      // Staff with a fixed store never switch
      let savedUser = {};
      try {
        savedUser = JSON.parse(localStorage.getItem("user") || "{}");
      } catch (error) {
        savedUser = {};
      }

      if (!hasAllStoreAccess(savedUser.role)) {
        return;
      }

      const fromEvent = Number(event?.detail?.storeId);
      const fromStorage = Number(
        localStorage.getItem("activeStoreId")
      );
      const next = fromEvent || fromStorage || null;

      if (next) {
        setActiveStoreId(next);
      }
    };

    window.addEventListener("storeChanged", syncStore);
    window.addEventListener("storage", syncStore);

    return () => {
      window.removeEventListener("storeChanged", syncStore);
      window.removeEventListener("storage", syncStore);
    };
  }, [hasAllStoreAccess]);

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

      localStorage.setItem(
        "user",
        JSON.stringify(loggedInUser)
      );

      setUser(loggedInUser);

      const loginStoreId =
        Number(loggedInUser.store_id) || null;

      setActiveStoreId(loginStoreId);

      if (loginStoreId) {
        localStorage.setItem(
          "activeStoreId",
          String(loginStoreId)
        );
      } else {
        localStorage.removeItem("activeStoreId");
      }

      setPage(
        getDefaultPageByRole(loggedInUser.role)
      );

      setEmail("");
      setPassword("");
      setMessage("");
    } catch (err) {
      setMessage(
        err.response?.data?.message ||
          "Login failed! Email or password incorrect."
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
      users: "Workers",
      customers: "Customers",
      settings: "Settings",
      damaged: "Damaged / Spoiled",
      attendance: "Attendance",
      "attendance-camera": "Attendance Camera",
      salary: "Salary",
      expenses: "Expenses",
      suppliers: "Suppliers / Due",
      "ai-insights": "AI Insights",
      account: "My Account",
    };

    return titles[page] || "Dashboard";
  }, [page]);

  const goToPage = (targetPage) => {
    if (!user) {
      return;
    }

    const allowedPages = getAllowedPages(user.role);

    if (!allowedPages.includes(targetPage)) {
      setPage(
        getDefaultPageByRole(user.role)
      );
      return;
    }

    setPage(targetPage);

    if (isMobile) {
      setSidebarOpen(false);
    }
  };

  const renderPage = () => {
    if (!user) {
      return null;
    }

    const allowedPages = getAllowedPages(user.role);

    if (!allowedPages.includes(page)) {
      return (
        <Dashboard user={user} activeStoreId={activeStoreId} />
      );
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
      case "customers":
        return <Customers user={user} />;
      case "settings":
        return <Settings user={user} activeStoreId={activeStoreId} />;
      case "account":
        return <Account user={user} activeStoreId={activeStoreId} />;
      case "damaged":
        return <Damaged user={user} activeStoreId={activeStoreId} />;
      case "attendance":
        return <Attendance user={user} activeStoreId={activeStoreId} />;
      case "attendance-camera":
        return <AttendanceCamera user={user} activeStoreId={activeStoreId} />;
      case "salary":
        return <Salary user={user} activeStoreId={activeStoreId} />;
      case "expenses":
        return <Expenses user={user} activeStoreId={activeStoreId} />;
      case "suppliers":
        return <Suppliers user={user} activeStoreId={activeStoreId} />;
      case "ai-insights":
        return <AiInsights user={user} activeStoreId={activeStoreId} />;
      default:
        return <Dashboard user={user} activeStoreId={activeStoreId} />;
    }
  };

  if (showCustomerPortal) {
    return (
      <CustomerPortal onBack={() => setShowCustomerPortal(false)} />
    );
  }

  if (checkingAuth) {
    return (
      <div className="screen-center">
        <div className="loader-card">
          <div className="loader-spinner" />
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
            <div className="hero-badge">
              <Icon name="cloud" size={16} strokeWidth={2.2} /> Cloud POS
            </div>
            <h1>Retail management that feels fast, clean and reliable</h1>
            <p>
              Track sales, inventory, stores, reports and users from one
              professional control panel.
            </p>

            <div className="hero-points">
              <div className="hero-point">
                <span className="hero-point-icon">
                  <Icon name="sales" size={20} />
                </span>
                <div>
                  <strong>Fast billing</strong>
                  <small>Quick POS workflow for daily sales operations.</small>
                </div>
              </div>
              <div className="hero-point">
                <span className="hero-point-icon">
                  <Icon name="products" size={20} />
                </span>
                <div>
                  <strong>Stock control</strong>
                  <small>Monitor products and inventory movement easily.</small>
                </div>
              </div>
              <div className="hero-point">
                <span className="hero-point-icon">
                  <Icon name="reports" size={20} />
                </span>
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

              <button
                type="button"
                onClick={() => setShowCustomerPortal(true)}
                style={{
                  width: "100%",
                  minHeight: "46px",
                  marginTop: "12px",
                  padding: "0 18px",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "9px",
                  color: "#4c1d95",
                  background:
                    "linear-gradient(135deg, #f5f3ff 0%, #fff1f7 100%)",
                  border: "1px solid #c4b5fd",
                  borderRadius: "10px",
                  boxShadow: "0 6px 16px rgba(91, 33, 182, 0.10)",
                  cursor: "pointer",
                  fontSize: "14px",
                  fontWeight: 800,
                  letterSpacing: "0.01em",
                  transition:
                    "transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease",
                }}
              >
                <Icon name="customers" size={18} />
                <span>Customer Loyalty Login / Register</span>
              </button>
            </form>
          </section>
        </div>
      </div>
    );
  }

  if (needFace) {
    return (
      <FaceCapture
        user={user}
        onDone={() => setNeedFace(false)}
        onLogout={logout}
      />
    );
  }

  if (needPayout) {
    return (
      <PayoutSetup
        user={user}
        onDone={() => setNeedPayout(false)}
        onLogout={logout}
      />
    );
  }

  return (
    <div className="app-shell">
      {sidebarOpen && isMobile && (
        <div
          className="sidebar-backdrop"
          onClick={() => setSidebarOpen(false)}
          role="button"
          tabIndex={0}
          aria-label="Close sidebar"
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              setSidebarOpen(false);
            }
          }}
        />
      )}

      <aside className={`sidebar ${sidebarOpen ? "open" : ""}`}>
        <div className="sidebar-top">
          <div className="brand">
            <div className="brand-mark">
              <Icon name="cloud" size={24} strokeWidth={2.2} />
            </div>
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
              type="button"
            >
              <Icon name="close" size={18} />
            </button>
          )}
        </div>

        <nav className="sidebar-nav">
          {NAV_SECTIONS.map((section) => {
            const items = menuItems.filter(
              (item) => item.section === section && item.roles.includes(user.role)
            );

            if (items.length === 0) {
              return null;
            }

            return (
              <div className="nav-group" key={section}>
                <div className="nav-section">{section}</div>
                {items.map((item) => (
                  <button
                    key={item.key}
                    className={`nav-btn ${page === item.key ? "active" : ""}`}
                    onClick={() => goToPage(item.key)}
                    type="button"
                  >
                    <span className="nav-icon">
                      <Icon name={item.icon} size={18} />
                    </span>
                    <span>{item.label}</span>
                  </button>
                ))}
              </div>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <div className="profile-card">
            <div className="profile-avatar">
              {user.name?.charAt(0) || "U"}
            </div>
            <div>
              <strong>{user.name}</strong>
              <small>
                {user.role} ·{" "}
                {hasAllStoreAccess(user.role)
                  ? "All Stores"
                  : `Store #${activeStoreId || "-"}`}
              </small>
            </div>
          </div>

          <button className="logout-btn" onClick={logout} type="button">
            <Icon name="logout" size={17} />
            <span>Logout</span>
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
                <Icon name="menu" size={20} />
              </button>
            )}

            <div>
              <h1>{pageTitle}</h1>
              <p>{todayLabel()}</p>
            </div>
          </div>

          <div className="topbar-right">
            <div className="topbar-user">
              <span className="user-dot" />
              <span>
                {user.name} · {user.role} ·{" "}
                {hasAllStoreAccess(user.role)
                  ? "All Stores"
                  : `Store #${activeStoreId || "-"}`}
              </span>
            </div>
          </div>
        </header>

        <section className="content-area" key={activeStoreId || "none"}>
          {renderPage()}
        </section>
      </main>

      {canUseAi && (
        <AiWidget user={user} activeStoreId={activeStoreId} />
      )}
    </div>
  );
}

export default App;