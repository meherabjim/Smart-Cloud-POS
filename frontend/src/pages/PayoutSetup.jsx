import React from "react";
import PayoutForm from "../components/PayoutForm";
import "./FaceCapture.css";

// Step 2 of first login (after face registration):
// staff chooses where their salary goes.
function PayoutSetup({ user, onDone, onLogout }) {
  return (
    <div className="face-shell">
      <div className="face-card" style={{ maxWidth: 620 }}>
        <h2 className="face-title">💳 Salary Account</h2>
        <p className="face-sub">
          Hi {user?.name || "there"} — where should your salary go? Choose Cash,
          bKash, Nagad, Rocket or a bank account. You can change it later from
          My Account (Admin will approve the change).
        </p>

        <PayoutForm mode="setup" onSaved={onDone} />

        <div className="face-actions" style={{ marginTop: 12 }}>
          <button type="button" className="face-logout-btn" onClick={onLogout}>
            Logout
          </button>
        </div>
      </div>
    </div>
  );
}

export default PayoutSetup;
