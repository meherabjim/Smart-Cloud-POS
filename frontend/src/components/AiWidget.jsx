import React, { useEffect, useRef, useState } from "react";
import axios from "axios";
import API_BASE_URL from "../apiConfig";
import "./AiWidget.css";

// Floating round AI assistant. Shows on every page (mounted in App.js).
function AiWidget({ user, activeStoreId }) {
  const storeId =
    activeStoreId || Number(localStorage.getItem("activeStoreId")) || 1;
  const isAdmin = user?.role === "Admin";
  const token = localStorage.getItem("token");
  const headers = { Authorization: `Bearer ${token}` };

  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([
    {
      role: "ai",
      text: "হাই! 🤖 আমি আপনার AI assistant। বিক্রি, খরচ, profit, stock — যেকোনো প্রশ্ন করুন।",
    },
  ]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);

  const listRef = useRef(null);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages, open]);

  const send = async (text) => {
    const question = (text ?? input).trim();
    if (!question || sending) return;

    setMessages((m) => [...m, { role: "user", text: question }]);
    setInput("");
    setSending(true);

    try {
      const res = await axios.post(
        `${API_BASE_URL}/api/ai/chat`,
        { question, store_id: isAdmin ? undefined : storeId },
        { headers }
      );
      setMessages((m) => [...m, { role: "ai", text: res.data.answer }]);
    } catch (err) {
      setMessages((m) => [
        ...m,
        {
          role: "ai",
          text:
            err.response?.data?.message ||
            "দুঃখিত, AI service এ সমস্যা হচ্ছে। একটু পরে চেষ্টা করুন।",
        },
      ]);
    } finally {
      setSending(false);
    }
  };

  const onKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  if (!user) return null;

  return (
    <>
      {/* ---- Chat popup ---- */}
      {open && (
        <div className="aiw-popup">
          <div className="aiw-pop-head">
            <div className="aiw-pop-title">
              <span className="aiw-pop-avatar">🤖</span>
              <div>
                <strong>AI Assistant</strong>
                <small>সবসময় আপনার পাশে</small>
              </div>
            </div>
            <button className="aiw-close" onClick={() => setOpen(false)} type="button">
              ✕
            </button>
          </div>

          <div className="aiw-messages" ref={listRef}>
            {messages.map((m, i) => (
              <div key={i} className={`aiw-msg ${m.role}`}>
                <div className="aiw-bubble">{m.text}</div>
              </div>
            ))}
            {sending && (
              <div className="aiw-msg ai">
                <div className="aiw-bubble aiw-typing">ভাবছি…</div>
              </div>
            )}
          </div>

          <div className="aiw-input-row">
            <input
              className="aiw-input"
              placeholder="প্রশ্ন লিখুন…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              disabled={sending}
            />
            <button
              className="aiw-send"
              onClick={() => send()}
              disabled={sending || !input.trim()}
              type="button"
            >
              ➤
            </button>
          </div>
        </div>
      )}

      {/* ---- Floating round button ---- */}
      <button
        className={`aiw-fab ${open ? "open" : ""}`}
        onClick={() => setOpen((o) => !o)}
        title="AI Assistant"
        type="button"
      >
        <span className="aiw-fab-ring" />
        <span className="aiw-fab-icon">{open ? "✕" : "🤖"}</span>
        {!open && <span className="aiw-fab-badge">AI</span>}
      </button>
    </>
  );
}

export default AiWidget;