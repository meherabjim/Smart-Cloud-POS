// =========================================================
// Salary payout helpers (Cash / Bank / bKash / Nagad / Rocket)
// No real payment gateway is connected: every non-cash payout is
// recorded as a DEMO transfer.
// =========================================================

const METHODS = ["Cash", "Bank", "bKash", "Nagad", "Rocket"];

const clean = (v) => (v == null ? "" : String(v).trim());
const digitsOnly = (v) => clean(v).replace(/[\s-]/g, "");

// Returns { ok: true, value } or { ok: false, message }
const validateAccount = (body = {}) => {
  const method = clean(body.method);

  if (!METHODS.includes(method)) {
    return { ok: false, message: "Choose Cash, Bank, bKash, Nagad or Rocket." };
  }

  if (method === "Cash") {
    return {
      ok: true,
      value: { method, account_no: null, account_name: null, bank_name: null, branch: null },
    };
  }

  const accountNo = digitsOnly(body.account_no);
  const accountName = clean(body.account_name).slice(0, 120) || null;

  if (method === "bKash" || method === "Nagad") {
    if (!/^01[3-9]\d{8}$/.test(accountNo)) {
      return { ok: false, message: `${method} number must be 11 digits, like 017XXXXXXXX.` };
    }
    return { ok: true, value: { method, account_no: accountNo, account_name: accountName, bank_name: null, branch: null } };
  }

  if (method === "Rocket") {
    // Rocket (DBBL) = 11-digit mobile number + 1 check digit
    if (!/^01[3-9]\d{9}$/.test(accountNo)) {
      return { ok: false, message: "Rocket number must be 12 digits (mobile number + 1 digit)." };
    }
    return { ok: true, value: { method, account_no: accountNo, account_name: accountName, bank_name: null, branch: null } };
  }

  // Bank
  const bankName = clean(body.bank_name).slice(0, 120);
  const branch = clean(body.branch).slice(0, 120) || null;

  if (!bankName) return { ok: false, message: "Bank name is required." };
  if (!accountName) return { ok: false, message: "Account holder name is required." };
  if (!/^\d{8,20}$/.test(accountNo)) {
    return { ok: false, message: "Bank account number must be 8 to 20 digits." };
  }

  return { ok: true, value: { method, account_no: accountNo, account_name: accountName, bank_name: bankName, branch } };
};

// 01712345678 -> ••••5678
const maskAccount = (accountNo) => {
  const s = clean(accountNo);
  if (!s) return null;
  return `••••${s.slice(-4)}`;
};

// Short human label, e.g. "bKash ••••5678", "Bank (DBBL) ••••9012", "Cash"
const accountLabel = (acc, { full = false } = {}) => {
  if (!acc || !acc.method) return "Cash (no account set)";
  if (acc.method === "Cash") return "Cash";
  const num = full ? acc.account_no : maskAccount(acc.account_no);
  if (acc.method === "Bank") return `Bank${acc.bank_name ? ` (${acc.bank_name})` : ""} ${num}`;
  return `${acc.method} ${num}`;
};

// Fake transaction reference for the demo, e.g. DEMO-BKASH-20260925-000123
const makeTxnRef = (method, salaryPaymentId) => {
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  const id = String(salaryPaymentId).padStart(6, "0");
  if (method === "Cash") return `CASH-${ymd}-${id}`;
  return `DEMO-${method.toUpperCase()}-${ymd}-${id}`;
};

module.exports = { METHODS, validateAccount, maskAccount, accountLabel, makeTxnRef };
