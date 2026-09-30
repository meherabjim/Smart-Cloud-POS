import React, { useEffect, useState } from "react";
import Icon from "./Icon";

// Small notification popups (replaces browser alert()).
// Usage anywhere:  toast("Saved")  |  toast.success("Saved")  |  toast.error("Failed")
// <Toaster /> is mounted once in App.js.

const listeners = new Set();
let nextId = 1;

// Guess the type from the text when not given
const guessType = (text) => {
  const t = String(text || "").toLowerCase();
  if (/❌|fail|error|invalid|cannot|can't|not found|denied|required|blocked|wrong|must|only/.test(t)) {
    return "error";
  }
  if (/✅|success|saved|added|updated|deleted|removed|closed|paid|approved|done/.test(t)) {
    return "success";
  }
  return "info";
};

const push = (text, type) => {
  const item = {
    id: nextId++,
    text: String(text ?? ""),
    type: type || guessType(text),
  };
  listeners.forEach((fn) => fn(item));
};

export function toast(text, type) {
  push(text, type);
}
toast.success = (text) => push(text, "success");
toast.error = (text) => push(text, "error");
toast.info = (text) => push(text, "info");

const ICONS = { success: "check", error: "alert", info: "info" };
const TITLES = { success: "Success", error: "Something went wrong", info: "Notice" };

export function Toaster() {
  const [items, setItems] = useState([]);

  useEffect(() => {
    const add = (item) => {
      setItems((prev) => [...prev.slice(-3), item]);
      const life = item.type === "error" ? 6000 : 3500;
      setTimeout(() => {
        setItems((prev) => prev.filter((t) => t.id !== item.id));
      }, life);
    };
    listeners.add(add);
    return () => listeners.delete(add);
  }, []);

  const close = (id) => setItems((prev) => prev.filter((t) => t.id !== id));

  return (
    <div className="toast-stack" role="status" aria-live="polite">
      {items.map((t) => (
        <div key={t.id} className={`toast toast-${t.type}`}>
          <span className="toast-icon">
            <Icon name={ICONS[t.type]} size={16} strokeWidth={2.4} />
          </span>
          <div className="toast-body">
            <strong>{TITLES[t.type]}</strong>
            <span>{t.text.replace(/^[❌✅]\s*/, "")}</span>
          </div>
          <button type="button" className="toast-close" onClick={() => close(t.id)} aria-label="Close">
            <Icon name="close" size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}

export default toast;
