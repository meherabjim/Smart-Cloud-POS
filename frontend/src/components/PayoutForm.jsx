import React, { useState } from "react";
import axios from "axios";
import API_BASE_URL from "../apiConfig";
import "./PayoutForm.css";

// Where a staff member's salary goes.
// mode="setup"  -> first time (no password, saved as Active)
// mode="change" -> later change (password required, goes to Admin as Pending)

export const PAYOUT_METHODS = [
  { key: "Cash", label: "Cash", hint: "Hand cash" },
  { key: "bKash", label: "bKash", hint: "11 digit" },
  { key: "Nagad", label: "Nagad", hint: "11 digit" },
  { key: "Rocket", label: "Rocket", hint: "12 digit" },
  { key: "Bank", label: "Bank", hint: "Bank account" },
];

const onlyDigits = (v) => String(v || "").replace(/[\s-]/g, "");

export const validatePayout = (f) => {
  const no = onlyDigits(f.account_no);
  if (f.method === "Cash") return "";
  if (f.method === "bKash" || f.method === "Nagad") {
    if (!/^01[3-9]\d{8}$/.test(no)) return `${f.method} number must be 11 digits, like 017XXXXXXXX.`;
  }
  if (f.method === "Rocket") {
    if (!/^01[3-9]\d{9}$/.test(no)) return "Rocket number must be 12 digits (mobile number + 1 digit).";
  }
  if (f.method === "Bank") {
    if (!String(f.bank_name || "").trim()) return "Bank name is required.";
    if (!String(f.account_name || "").trim()) return "Account holder name is required.";
    if (!/^\d{8,20}$/.test(no)) return "Bank account number must be 8 to 20 digits.";
  }
  return "";
};

function PayoutForm({ mode = "setup", initial, onSaved, submitLabel }) {
  const [form, setForm] = useState({
    method: initial?.method || "bKash",
    account_no: "",
    account_name: initial?.account_name || "",
    bank_name: "",
    branch: "",
    password: "",
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const set = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setError("");

    const msg = validatePayout(form);
    if (msg) {
      setError(msg);
      return;
    }
    if (mode === "change" && !form.password) {
      setError("Enter your password to confirm this change.");
      return;
    }

    try {
      setSaving(true);
      const token = localStorage.getItem("token");
      const res = await axios.post(
        `${API_BASE_URL}/api/payout/me`,
        { ...form, account_no: onlyDigits(form.account_no) },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setForm((p) => ({ ...p, password: "", account_no: "" }));
      if (onSaved) onSaved(res.data);
    } catch (err) {
      setError(err.response?.data?.message || "Could not save the salary account.");
    } finally {
      setSaving(false);
    }
  };

  const needsNumber = form.method !== "Cash";

  return (
    <form className="pf" onSubmit={submit}>
      <div className="pf-methods" role="radiogroup" aria-label="Salary method">
        {PAYOUT_METHODS.map((m) => (
          <button
            type="button"
            key={m.key}
            role="radio"
            aria-checked={form.method === m.key}
            className={`pf-method pf-${m.key.toLowerCase()} ${form.method === m.key ? "on" : ""}`}
            onClick={() => setForm((p) => ({ ...p, method: m.key }))}
          >
            <strong>{m.label}</strong>
            <small>{m.hint}</small>
          </button>
        ))}
      </div>

      {form.method === "Bank" && (
        <div className="pf-row">
          <label>
            Bank name
            <input value={form.bank_name} onChange={set("bank_name")} placeholder="e.g. Dutch-Bangla Bank" />
          </label>
          <label>
            Branch
            <input value={form.branch} onChange={set("branch")} placeholder="e.g. Motijheel" />
          </label>
        </div>
      )}

      {needsNumber && (
        <div className="pf-row">
          <label>
            {form.method === "Bank" ? "Account number" : `${form.method} number`}
            <input
              value={form.account_no}
              onChange={set("account_no")}
              inputMode="numeric"
              autoComplete="off"
              placeholder={
                form.method === "Bank" ? "Account number" : form.method === "Rocket" ? "01XXXXXXXXXX" : "01XXXXXXXXX"
              }
            />
          </label>
          <label>
            Account holder name {form.method === "Bank" ? "" : "(optional)"}
            <input value={form.account_name} onChange={set("account_name")} placeholder="Name on the account" />
          </label>
        </div>
      )}

      {form.method === "Cash" && (
        <p className="pf-note">Your salary will be handed to you in cash. You can add an account later from My Account.</p>
      )}

      {mode === "change" && (
        <label className="pf-pass">
          Your login password
          <input type="password" value={form.password} onChange={set("password")} autoComplete="current-password" />
        </label>
      )}

      {error && <div className="pf-error">{error}</div>}

      <button type="submit" className="pf-submit" disabled={saving}>
        {saving ? "Saving…" : submitLabel || (mode === "change" ? "Send change request" : "Save salary account")}
      </button>

      {mode === "change" && (
        <p className="pf-note">Admin must approve the change. Until then, salary goes to your current account.</p>
      )}
    </form>
  );
}

export default PayoutForm;
