import React, { useState, useEffect } from "react";
import axios from "axios";

function App() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [user, setUser] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem("token");
    const userData = localStorage.getItem("user");

    if (token && userData) {
      setUser(JSON.parse(userData));
    }
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();

    try {
      const res = await axios.post(
        "https://smart-cloud-pos-api.onrender.com/api/auth/login",
        {
          email,
          password,
        }
      );

      localStorage.setItem("token", res.data.token);
      localStorage.setItem("user", JSON.stringify(res.data.user));

      setUser(res.data.user);

    } catch (err) {
      setMessage(
        err.response?.data?.message || "Login Failed"
      );
    }
  };

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setUser(null);
  };

  // ================= Dashboard =================

  if (user) {
    return (
      <div
        style={{
          padding: "40px",
          fontFamily: "Arial",
          background: "#f4f4f4",
          minHeight: "100vh",
        }}
      >
        <h1>ðŸŽ‰ SaaS POS Dashboard</h1>

        <hr />

        <h3>Welcome, {user.name}</h3>

        <p>
          <b>Email:</b> {user.email}
        </p>

        <p>
          <b>Role:</b> {user.role}
        </p>

        <p>
          <b>Store ID:</b> {user.store_id}
        </p>

        <button
          onClick={logout}
          style={{
            padding: "10px 20px",
            background: "red",
            color: "#fff",
            border: "none",
            cursor: "pointer",
          }}
        >
          Logout
        </button>
      </div>
    );
  }

  // ================= Login =================

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        height: "100vh",
        background: "#f4f6f9",
      }}
    >
      <div
        style={{
          width: "400px",
          background: "#fff",
          padding: "30px",
          borderRadius: "10px",
          boxShadow: "0 0 10px rgba(0,0,0,.2)",
        }}
      >
        <h2>SaaS POS Login</h2>

        {message && (
          <p style={{ color: "red" }}>{message}</p>
        )}

        <form onSubmit={handleLogin}>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{
              width: "100%",
              padding: "10px",
              marginBottom: "15px",
            }}
          />

          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{
              width: "100%",
              padding: "10px",
              marginBottom: "15px",
            }}
          />

          <button
            type="submit"
            style={{
              width: "100%",
              padding: "10px",
              background: "#007bff",
              color: "#fff",
              border: "none",
            }}
          >
            Login
          </button>
        </form>
      </div>
    </div>
  );
}

export default App;
