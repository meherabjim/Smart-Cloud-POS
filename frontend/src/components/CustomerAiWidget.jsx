// Customer-only floating AI chat (separate from the staff AiWidget).
import React, { useEffect, useRef, useState } from "react";
import { money, StockChip } from "./customer/customerUi";
import "./CustomerAiWidget.css";
import { toast } from "./Toast";

const QUICK = ["আজকের offer", "আমার point কত?", "চাল কোথায় সস্তা?", "এই মাসে কত খরচ করলাম?"];

function CustomerAiWidget({ api, onOpenStore }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([
    { role: "ai", text: "হাই! 🛒 Product-এর দাম, কোন store-এ সস্তা, offer বা আপনার point, যা জানতে চান লিখুন।", cards: [] },
  ]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [listening, setListening] = useState(false);
  const listRef = useRef(null);

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages, open]);

  const send = async (text) => {
    const question = (text ?? input).trim();
    if (!question || sending) return;

    const history = messages.slice(-6).map((m) => ({ role: m.role, text: m.text }));
    setMessages((m) => [...m, { role: "user", text: question }]);
    setInput("");
    setSending(true);

    try {
      const res = await api.post("/api/customers/ai/chat", { question, history });
      setMessages((m) => [...m, { role: "ai", text: res.data.answer, cards: res.data.cards || [] }]);
    } catch (err) {
      setMessages((m) => [...m, { role: "ai", text: err.response?.data?.message || "দুঃখিত, একটু পরে চেষ্টা করুন।" }]);
    } finally {
      setSending(false);
    }
  };

  const voice = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      toast("এই browser-এ voice input নেই। Chrome ব্যবহার করুন।");
      return;
    }
    const rec = new SR();
    rec.lang = "bn-BD";
    rec.onresult = (e) => send(e.results[0][0].transcript);
    rec.onend = () => setListening(false);
    setListening(true);
    rec.start();
  };

  return (
    <>
      {open && (
        <div className="caw-popup">
          <div className="caw-head">
            <div>
              <strong>🛒 Shopping Assistant</strong>
              <small>দাম, store, offer, point</small>
            </div>
            <button type="button" onClick={() => setOpen(false)}>✕</button>
          </div>

          <div className="caw-messages" ref={listRef}>
            {messages.map((m, i) => (
              <div key={i} className={`caw-msg ${m.role}`}>
                <div className="caw-bubble">{m.text}</div>

                {m.cards?.map((c) => (
                  <div key={c.name} className="caw-card">
                    <div className="caw-card-main">
                      <strong>{c.name}</strong>
                      <small>
                        {c.best?.store_name} · {c.available_stores} store-এ আছে
                      </small>
                      <div className="caw-card-price">
                        {money(c.best?.final_price)}
                        {c.best?.discount_percent > 0 && <em>{c.best.discount_percent}% OFF</em>}
                      </div>
                      <StockChip status={c.best?.stock_status} />
                    </div>
                    {c.best && (
                      <button type="button" onClick={() => { onOpenStore(c.best.store_id, c.name); setOpen(false); }}>
                        Store-এ দেখুন →
                      </button>
                    )}
                  </div>
                ))}
              </div>
            ))}
            {sending && <div className="caw-msg ai"><div className="caw-bubble caw-typing">খুঁজছি…</div></div>}
          </div>

          <div className="caw-quick">
            {QUICK.map((q) => (
              <button key={q} type="button" onClick={() => send(q)} disabled={sending}>{q}</button>
            ))}
          </div>

          <div className="caw-input">
            <button type="button" className={listening ? "on" : ""} onClick={voice} title="Voice">🎤</button>
            <input
              value={input}
              maxLength={300}
              placeholder="যেমন: মিনিকেট চাল কোথায় সস্তা?"
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
              disabled={sending}
            />
            <button type="button" onClick={() => send()} disabled={sending || !input.trim()}>➤</button>
          </div>
        </div>
      )}

      <button type="button" className={`caw-fab ${open ? "open" : ""}`} onClick={() => setOpen((o) => !o)}>
        {open ? "✕" : "🛒"}
        {!open && <span>AI</span>}
      </button>
    </>
  );
}

export default CustomerAiWidget;
