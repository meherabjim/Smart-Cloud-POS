import React, { useEffect, useRef, useState, useCallback } from "react";
import axios from "axios";
import API_BASE_URL from "../apiConfig";
import "./AiInsights.css";

const SUGGESTED = [
  "এই মাসে সবচেয়ে বেশি কী বিক্রি হয়েছে?",
  "গত মাসের তুলনায় এই মাসে বিক্রি কেমন?",
  "এই মাসে net profit কত?",
  "কোন product গুলো stock কমে গেছে?",
];

function AiInsights({ user, activeStoreId }) {
  const storeId =
    activeStoreId || Number(localStorage.getItem("activeStoreId")) || 1;
  const isAdmin = user?.role === "Admin";
  const token = localStorage.getItem("token");
  const headers = { Authorization: `Bearer ${token}` };

  const scopeParam = isAdmin ? "" : `?store_id=${storeId}`;

  const [messages, setMessages] = useState([
    {
      role: "ai",
      text:
        "Hi! আমি আপনার business assistant। বিক্রি, খরচ, profit, stock নিয়ে যেকোনো প্রশ্ন করুন — বাংলা বা ইংরেজিতে।",
    },
  ]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [listening, setListening] = useState(false);

  const [alerts, setAlerts] = useState([]);
  const [alertLoading, setAlertLoading] = useState(true);
  const [alertError, setAlertError] = useState("");

  const listRef = useRef(null);
  const recognitionRef = useRef(null);

  const scrollDown = () => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  };
  useEffect(scrollDown, [messages]);

  const loadAlerts = useCallback(async () => {
    setAlertLoading(true);
    setAlertError("");
    try {
      const res = await axios.get(
        `${API_BASE_URL}/api/ai/anomalies${scopeParam}`,
        { headers }
      );
      setAlerts(res.data.alerts || []);
    } catch (err) {
      setAlertError(err.response?.data?.message || "Failed to load alerts.");
    } finally {
      setAlertLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId, isAdmin]);

  useEffect(() => {
    loadAlerts();
  }, [loadAlerts]);

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
            "Sorry, AI service এ সমস্যা হচ্ছে। একটু পরে চেষ্টা করুন।",
        },
      ]);
    } finally {
      setSending(false);
    }
  };

  const loadReport = async () => {
    if (sending) return;
    setSending(true);
    setMessages((m) => [...m, { role: "user", text: "📋 আজকের রিপোর্ট" }]);
    try {
      const res = await axios.get(
        `${API_BASE_URL}/api/ai/daily-report${scopeParam}`,
        { headers }
      );
      setMessages((m) => [...m, { role: "ai", text: res.data.report }]);
    } catch (err) {
      setMessages((m) => [
        ...m,
        {
          role: "ai",
          text: err.response?.data?.message || "রিপোর্ট বানাতে সমস্যা হচ্ছে।",
        },
      ]);
    } finally {
      setSending(false);
    }
  };

  const loadForecast = async () => {
    if (sending) return;
    setSending(true);
    setMessages((m) => [...m, { role: "user", text: "📦 Forecast / Reorder" }]);
    try {
      const res = await axios.get(
        `${API_BASE_URL}/api/ai/forecast${scopeParam}`,
        { headers }
      );
      setMessages((m) => [...m, { role: "ai", text: res.data.report }]);
    } catch (err) {
      setMessages((m) => [
        ...m,
        { role: "ai", text: err.response?.data?.message || "Forecast বানাতে সমস্যা হচ্ছে।" },
      ]);
    } finally {
      setSending(false);
    }
  };

  // 🎤 Voice input (browser Web Speech API — works best in Chrome). Auto-sends.
  const startVoice = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      alert("এই browser voice সাপোর্ট করে না। Chrome ব্যবহার করুন।");
      return;
    }
    if (listening) {
      recognitionRef.current?.stop();
      return;
    }
    const rec = new SR();
    rec.lang = "bn-BD";
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.onresult = (e) => {
      const text = e.results[0][0].transcript;
      setInput(text);
      send(text);
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recognitionRef.current = rec;
    setListening(true);
    rec.start();
  };

  const onKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
    <div className="ai-page">
      <div className="ai-header">
        <div>
          <h2>🤖 AI Business Insights</h2>
          <p>
            {isAdmin ? "All stores" : `Store #${storeId}`} • প্রশ্ন করুন, অথবা নিচে
            unusual activity দেখুন।
          </p>
        </div>
      </div>

      <div className="ai-grid">
        {/* ---------- Chat ---------- */}
        <div className="ai-card ai-chat-card">
          <div className="ai-alert-head">
            <h3 className="ai-card-title">💬 Ask about your business</h3>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              <button className="ai-refresh" onClick={loadReport} disabled={sending}>
                📋 আজকের রিপোর্ট
              </button>
              <button className="ai-refresh" onClick={loadForecast} disabled={sending}>
                📦 Forecast
              </button>
            </div>
          </div>

          <div className="ai-messages" ref={listRef}>
            {messages.map((m, i) => (
              <div key={i} className={`ai-msg ${m.role}`}>
                <div className="ai-bubble">{m.text}</div>
              </div>
            ))}
            {sending && (
              <div className="ai-msg ai">
                <div className="ai-bubble ai-typing">ভাবছি…</div>
              </div>
            )}
          </div>

          <div className="ai-suggest">
            {SUGGESTED.map((q) => (
              <button
                key={q}
                className="ai-chip"
                onClick={() => send(q)}
                disabled={sending}
              >
                {q}
              </button>
            ))}
          </div>

          <div className="ai-input-row">
            <button
              className={`ai-mic ${listening ? "on" : ""}`}
              onClick={startVoice}
              disabled={sending}
              title="কথা বলে প্রশ্ন করুন"
              type="button"
            >
              {listening ? "🔴" : "🎤"}
            </button>
            <input
              className="ai-input"
              placeholder={listening ? "শুনছি… বলুন" : "আপনার প্রশ্ন লিখুন…"}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              disabled={sending}
            />
            <button
              className="ai-send"
              onClick={() => send()}
              disabled={sending || !input.trim()}
            >
              Send
            </button>
          </div>
        </div>

        {/* ---------- Anomaly alerts ---------- */}
        <div className="ai-card ai-alert-card">
          <div className="ai-alert-head">
            <h3 className="ai-card-title">⚠️ Anomaly Alerts</h3>
            <button className="ai-refresh" onClick={loadAlerts} disabled={alertLoading}>
              ↻ Refresh
            </button>
          </div>

          {alertLoading ? (
            <div className="ai-alert-empty">Checking…</div>
          ) : alertError ? (
            <div className="ai-alert-empty err">{alertError}</div>
          ) : alerts.length === 0 ? (
            <div className="ai-alert-empty ok">✅ সব স্বাভাবিক — কোন অস্বাভাবিক কিছু পাওয়া যায়নি।</div>
          ) : (
            <div className="ai-alert-list">
              {alerts.map((a, i) => (
                <div key={i} className={`ai-alert ${a.level}`}>
                  <div className="ai-alert-title">{a.title}</div>
                  <div className="ai-alert-detail">{a.detail}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default AiInsights;