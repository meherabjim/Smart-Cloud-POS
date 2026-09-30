import React, { useEffect, useRef, useState, useCallback } from "react";
import axios from "axios";
import API_BASE_URL from "../apiConfig";
import "./AiInsights.css";
import Icon from "../components/Icon";
import { toast } from "../components/Toast";

// ---------------------------------------------------------------
// Language: বাংলা / English / Banglish (Bangla in English letters)
// The choice changes the page text AND the language of AI replies.
// ---------------------------------------------------------------
const LANGS = [
  { id: "bn", label: "বাংলা" },
  { id: "en", label: "English" },
  
];

const TEXT = {
  bn: {
    subtitle: "ব্যবসা নিয়ে যেকোনো প্রশ্ন করুন, আর অস্বাভাবিক কিছু হলে সাথে সাথে জানুন",
    chatTitle: "ব্যবসা নিয়ে জিজ্ঞেস করুন",
    report: "আজকের রিপোর্ট",
    forecast: "Forecast",
    clear: "মুছুন",
    welcome:
      "হ্যালো! আমি আপনার business assistant। বিক্রি, খরচ, profit বা stock নিয়ে যেকোনো প্রশ্ন করুন।",
    thinking: "ভাবছি",
    placeholder: "আপনার প্রশ্ন লিখুন…",
    listening: "শুনছি… বলুন",
    send: "পাঠান",
    mic: "কথা বলে প্রশ্ন করুন",
    micStop: "থামান",
    voiceUnsupported: "এই browser এ voice কাজ করে না। Chrome ব্যবহার করুন।",
    chatError: "AI service এ সমস্যা হচ্ছে। একটু পরে আবার চেষ্টা করুন।",
    reportError: "রিপোর্ট বানাতে সমস্যা হচ্ছে।",
    forecastError: "Forecast বানাতে সমস্যা হচ্ছে।",
    alertsTitle: "অস্বাভাবিক সতর্কতা",
    refresh: "রিফ্রেশ",
    checking: "চেক করছি…",
    okTitle: "সব স্বাভাবিক",
    okText: "বিক্রি, খরচ, stock বা উপস্থিতিতে অস্বাভাবিক কিছু পাওয়া যায়নি।",
    lastChecked: "শেষ চেক",
    checks: "যা চেক করা হয়: বিক্রি, খরচ, নষ্ট পণ্য, stock ও উপস্থিতি",
    alertLoadError: "Alert লোড করা যায়নি।",
    level: { high: "জরুরি", medium: "খেয়াল রাখুন", info: "তথ্য" },
    suggestions: [
      "এই মাসে সবচেয়ে বেশি কী বিক্রি হয়েছে?",
      "গত মাসের তুলনায় বিক্রি কেমন?",
      "এই মাসে net profit কত?",
      "কোন product এর stock কম?",
    ],
  },
  en: {
    subtitle: "Ask anything about your business and spot unusual activity early",
    chatTitle: "Ask about your business",
    report: "Today's report",
    forecast: "Forecast",
    clear: "Clear",
    welcome:
      "Hi! I'm your business assistant. Ask me anything about sales, expenses, profit or stock.",
    thinking: "Thinking",
    placeholder: "Type your question…",
    listening: "Listening… speak now",
    send: "Send",
    mic: "Ask by voice",
    micStop: "Stop",
    voiceUnsupported: "Voice input is not supported in this browser. Please use Chrome.",
    chatError: "The AI service is not responding. Please try again in a moment.",
    reportError: "Could not create the report.",
    forecastError: "Could not create the forecast.",
    alertsTitle: "Anomaly Alerts",
    refresh: "Refresh",
    checking: "Checking…",
    okTitle: "All clear",
    okText: "Nothing unusual found in sales, expenses, stock or attendance.",
    lastChecked: "Last checked",
    checks: "Checks: sales, expenses, damaged goods, stock and attendance",
    alertLoadError: "Failed to load alerts.",
    level: { high: "Urgent", medium: "Watch", info: "Info" },
    suggestions: [
      "What sold the most this month?",
      "How are sales compared to last month?",
      "What is this month's net profit?",
      "Which products are low on stock?",
    ],
  },
  banglish: {
    subtitle: "Business niye je kono prosno korun, unusual kichu hole sathe sathe janun",
    chatTitle: "Business niye jiggesh korun",
    report: "Ajker report",
    forecast: "Forecast",
    clear: "Clear",
    welcome:
      "Hi! Ami apnar business assistant. Bikri, khoroch, profit ba stock niye je kono prosno korun.",
    thinking: "Vabchi",
    placeholder: "Apnar prosno likhun…",
    listening: "Shunchi… bolun",
    send: "Send",
    mic: "Kotha bole prosno korun",
    micStop: "Thamun",
    voiceUnsupported: "Ei browser e voice kaj kore na. Chrome use korun.",
    chatError: "AI service e somossa hocche. Ektu pore abar try korun.",
    reportError: "Report banate somossa hocche.",
    forecastError: "Forecast banate somossa hocche.",
    alertsTitle: "Unusual Alerts",
    refresh: "Refresh",
    checking: "Check korchi…",
    okTitle: "Sob thik ache",
    okText: "Bikri, khoroch, stock ba attendance e unusual kichu paowa jayni.",
    lastChecked: "Last check",
    checks: "Check kora hoy: bikri, khoroch, damaged product, stock ar attendance",
    alertLoadError: "Alert load kora jayni.",
    level: { high: "Urgent", medium: "Kheyal rakhun", info: "Info" },
    suggestions: [
      "Ei mashe sobcheye beshi ki bikri hoyeche?",
      "Goto mash er tulonay bikri kemon?",
      "Ei mashe net profit koto?",
      "Kon product er stock kome geche?",
    ],
  },
};

const money = (n) => `৳${Math.round(Number(n) || 0).toLocaleString("en-IN")}`;

// Alert text in the chosen language (backend sends a code + numbers)
const ALERT_TEXT = {
  sales_drop: {
    bn: (d) => ["গতকাল বিক্রি কমে গেছে", `গতকালের বিক্রি ${money(d.yday)} — ৩০ দিনের দৈনিক গড় ${money(d.avg)} এর অনেক নিচে।`],
    en: (d) => ["Sales dropped yesterday", `Yesterday's sales ${money(d.yday)} — well below the 30-day daily average of ${money(d.avg)}.`],
    banglish: (d) => ["Gotokal bikri kome geche", `Gotokal er bikri ${money(d.yday)} — 30 din er doinik gor ${money(d.avg)} er onek niche.`],
  },
  sales_spike: {
    bn: (d) => ["গতকাল বিক্রি অনেক বেড়েছে", `গতকালের বিক্রি ${money(d.yday)} — দৈনিক গড় ${money(d.avg)} এর দ্বিগুণেরও বেশি।`],
    en: (d) => ["Sales spike yesterday", `Yesterday's sales ${money(d.yday)} — more than double the daily average of ${money(d.avg)}.`],
    banglish: (d) => ["Gotokal bikri onek bereche", `Gotokal er bikri ${money(d.yday)} — doinik gor ${money(d.avg)} er double er o beshi.`],
  },
  expense_spike: {
    bn: (d) => [`এই মাসে "${d.category}" খরচ বেশি`, `এখন পর্যন্ত ${money(d.thisMonth)} খরচ হয়েছে — মাসিক গড় ${money(d.avg)}।`],
    en: (d) => [`High "${d.category}" expense this month`, `${money(d.thisMonth)} spent so far — the monthly average is ${money(d.avg)}.`],
    banglish: (d) => [`Ei mashe "${d.category}" khoroch beshi`, `Ekhon porjonto ${money(d.thisMonth)} khoroch hoyeche — masik gor ${money(d.avg)}.`],
  },
  damage_spike: {
    bn: (d) => ["গতকাল নষ্ট পণ্য বেশি", `গতকাল ${money(d.yday)} এর পণ্য নষ্ট হয়েছে — দৈনিক গড় ${money(d.avg)} এর দ্বিগুণেরও বেশি।`],
    en: (d) => ["High damage/spoilage yesterday", `Damage loss ${money(d.yday)} yesterday — over double the daily average of ${money(d.avg)}.`],
    banglish: (d) => ["Gotokal damaged product beshi", `Gotokal ${money(d.yday)} er product noshto hoyeche — doinik gor ${money(d.avg)} er double er o beshi.`],
  },
  out_of_stock: {
    bn: (d) => [`${d.count}টি product এর stock শেষ`, "এগুলো এখন বিক্রি করা যাবে না। দ্রুত stock আনুন।"],
    en: (d) => [`${d.count} product(s) out of stock`, "These items cannot be sold right now. Restock soon."],
    banglish: (d) => [`${d.count} ta product er stock shesh`, "Egula ekhon bikri kora jabe na. Taratari stock anun."],
  },
  low_stock: {
    bn: (d) => [`${d.count}টি product এর stock কম`, "Stock ৫ বা তার কম — reorder করার কথা ভাবুন।"],
    en: (d) => [`${d.count} product(s) low on stock`, "Stock is 5 or below — consider reordering."],
    banglish: (d) => [`${d.count} ta product er stock kom`, "Stock 5 ba tar kom — reorder korar kotha vabun."],
  },
  staff_absent: {
    bn: (d) => [`আজ ${d.count} জন staff অনুপস্থিত`, "স্বাভাবিকের চেয়ে বেশি অনুপস্থিত — staffing চেক করুন।"],
    en: (d) => [`${d.count} staff absent today`, "More absentees than usual — check staffing."],
    banglish: (d) => [`Aj ${d.count} jon staff absent`, "Shabhabik er cheye beshi absent — staffing check korun."],
  },
};

const alertText = (a, lang) => {
  const fn = ALERT_TEXT[a.code]?.[lang];
  if (fn && a.data) {
    const [title, detail] = fn(a.data);
    return { title, detail };
  }
  return { title: a.title, detail: a.detail };
};

// Forecast text built from the numbers the backend sends
function forecastText(items, lang) {
  if (!items || items.length === 0) {
    if (lang === "en") return "No sales in the last 30 days, so a forecast is not possible yet.";
    if (lang === "banglish") return "Goto 30 din e kono bikri nei, tai ekhon forecast deya jacche na.";
    return "গত ৩০ দিনে কোন বিক্রি নেই, তাই এখন forecast দেওয়া যাচ্ছে না।";
  }

  const line = (it) => {
    const never = it.daysLeft >= 999;
    if (lang === "en") {
      const run = never ? "not running out" : `runs out in ~${it.daysLeft} days`;
      const buy = it.reorderQty > 0 ? `→ buy ~${it.reorderQty}` : "→ enough stock";
      return `• **${it.name}** — stock ${it.stock}, ~${it.avgDaily}/day, ${run} ${buy}`;
    }
    if (lang === "banglish") {
      const run = never ? "shesh hobe na" : `~${it.daysLeft} din e shesh hobe`;
      const buy = it.reorderQty > 0 ? `→ ~${it.reorderQty} ta kinun` : "→ jothesto ache";
      return `• **${it.name}** — stock ${it.stock}, din e ~${it.avgDaily} ta, ${run} ${buy}`;
    }
    const run = never ? "শেষ হবে না" : `~${it.daysLeft} দিনে শেষ`;
    const buy = it.reorderQty > 0 ? `→ ~${it.reorderQty} টা কিনুন` : "→ যথেষ্ট আছে";
    return `• **${it.name}** — স্টক ${it.stock}, দৈনিক ~${it.avgDaily}, ${run} ${buy}`;
  };

  const head = {
    bn: "**বিক্রয় পূর্বাভাস ও reorder পরামর্শ** (গত ৩০ দিনের হিসাবে)",
    en: "**Sales forecast & reorder plan** (based on the last 30 days)",
    banglish: "**Sales forecast ar reorder plan** (goto 30 din er hisabe)",
  }[lang];
  const foot = {
    bn: "যেগুলো আগে শেষ হবে সেগুলো উপরে আছে।",
    en: "Items that run out first are at the top.",
    banglish: "Jegula age shesh hobe segula upore ache.",
  }[lang];

  return `${head}\n\n${items.map(line).join("\n")}\n\n${foot}`;
}

// Light formatting for AI replies: **bold**, "- " bullets, "#" headings
function renderText(text) {
  const lines = String(text || "").split("\n");
  return lines.map((raw, i) => {
    let line = raw.replace(/^\s*[-*]\s+/, "• ");
    const heading = /^\s*#{1,6}\s+/.test(line);
    if (heading) line = line.replace(/^\s*#{1,6}\s+/, "");
    const parts = line.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
    const content = parts.map((p, j) =>
      p.startsWith("**") && p.endsWith("**") ? <strong key={j}>{p.slice(2, -2)}</strong> : p
    );
    return (
      <span key={i} className={`ai-line${heading ? " heading" : ""}${line.trim() === "" ? " gap" : ""}`}>
        {content}
      </span>
    );
  });
}

const readLang = () => {
  try {
    const v = localStorage.getItem("aiLang");
        return LANGS.some((l) => l.id === v) ? v : "bn";
  } catch {
    return "bn";
  }
};

function AiInsights({ user, activeStoreId }) {
  const storeId = activeStoreId || Number(localStorage.getItem("activeStoreId")) || 1;
  const isAdmin = user?.role === "Admin";
  const token = localStorage.getItem("token");
  const headers = { Authorization: `Bearer ${token}` };

  const [lang, setLang] = useState(readLang);
  const t = TEXT[lang];

  const [messages, setMessages] = useState([{ role: "ai", text: TEXT[readLang()].welcome, welcome: true }]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [listening, setListening] = useState(false);

  const [alerts, setAlerts] = useState([]);
  const [alertLoading, setAlertLoading] = useState(true);
  const [alertError, setAlertError] = useState(null); // null = no error
  const [checkedAt, setCheckedAt] = useState(null);

  const listRef = useRef(null);
  const recognitionRef = useRef(null);

  const scopeLabel = isAdmin ? "All stores" : `Store #${storeId}`;
  const params = (extra = {}) => ({ ...(isAdmin ? {} : { store_id: storeId }), lang, ...extra });

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages, sending]);

  const changeLang = (id) => {
    setLang(id);
    try {
      localStorage.setItem("aiLang", id);
    } catch {
      /* ignore */
    }
    // Update the welcome message if the chat has not started yet
    setMessages((m) => (m.length === 1 && m[0].welcome ? [{ ...m[0], text: TEXT[id].welcome }] : m));
  };

  const loadAlerts = useCallback(async () => {
    setAlertLoading(true);
    setAlertError(null);
    try {
      const res = await axios.get(`${API_BASE_URL}/api/ai/anomalies`, {
        headers,
        params: isAdmin ? {} : { store_id: storeId },
      });
      setAlerts(res.data.alerts || []);
      setCheckedAt(new Date());
    } catch (err) {
      setAlertError(err.response?.data?.message || "");
    } finally {
      setAlertLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId, isAdmin]);

  useEffect(() => {
    loadAlerts();
  }, [loadAlerts]);

  const addMessage = (msg) => setMessages((m) => [...m, msg]);

  const send = async (text) => {
    const question = (text ?? input).trim();
    if (!question || sending) return;

    addMessage({ role: "user", text: question });
    setInput("");
    setSending(true);
    try {
      const res = await axios.post(
        `${API_BASE_URL}/api/ai/chat`,
        { question, store_id: isAdmin ? undefined : storeId, lang },
        { headers }
      );
      addMessage({ role: "ai", text: res.data.answer });
    } catch (err) {
      addMessage({ role: "ai", error: true, text: err.response?.data?.message || t.chatError });
    } finally {
      setSending(false);
    }
  };

  const loadReport = async () => {
    if (sending) return;
    addMessage({ role: "user", text: t.report });
    setSending(true);
    try {
      const res = await axios.get(`${API_BASE_URL}/api/ai/daily-report`, { headers, params: params() });
      addMessage({ role: "ai", text: res.data.report });
    } catch (err) {
      addMessage({ role: "ai", error: true, text: err.response?.data?.message || t.reportError });
    } finally {
      setSending(false);
    }
  };

  const loadForecast = async () => {
    if (sending) return;
    addMessage({ role: "user", text: t.forecast });
    setSending(true);
    try {
      const res = await axios.get(`${API_BASE_URL}/api/ai/forecast`, { headers, params: params() });
      const text = Array.isArray(res.data.items) ? forecastText(res.data.items, lang) : res.data.report;
      addMessage({ role: "ai", text });
    } catch (err) {
      addMessage({ role: "ai", error: true, text: err.response?.data?.message || t.forecastError });
    } finally {
      setSending(false);
    }
  };

  const clearChat = () => {
    recognitionRef.current?.stop();
    setMessages([{ role: "ai", text: t.welcome, welcome: true }]);
  };

  // Voice input (Web Speech API — works best in Chrome). Sends automatically.
  const startVoice = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      toast.info(t.voiceUnsupported);
      return;
    }
    if (listening) {
      recognitionRef.current?.stop();
      return;
    }
    const rec = new SR();
    rec.lang = lang === "en" ? "en-US" : "bn-BD";
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.onresult = (e) => {
      const said = e.results[0][0].transcript;
      setInput(said);
      send(said);
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

  const chatStarted = messages.length > 1;
  const highCount = alerts.filter((a) => a.level === "high").length;

  return (
    <div className={`ai-page lang-${lang}`}>
      {/* ---------- Header ---------- */}
      <div className="ai-header">
        <div className="ai-header-left">
          <span className="ai-header-icon">
            <Icon name="ai" size={22} />
          </span>
          <div>
            <h2>AI Business Insights</h2>
            <p>
              <span className="ai-scope">{scopeLabel}</span>
              {t.subtitle}
            </p>
          </div>
        </div>

        <div className="ai-lang" role="group" aria-label="Language">
          {LANGS.map((l) => (
            <button
              key={l.id}
              type="button"
              className={lang === l.id ? "active" : ""}
              onClick={() => changeLang(l.id)}
              aria-pressed={lang === l.id}
            >
              {l.label}
            </button>
          ))}
        </div>
      </div>

      <div className="ai-grid">
        {/* ---------- Chat ---------- */}
        <section className="ai-card ai-chat-card">
          <div className="ai-card-head">
            <h3 className="ai-card-title">
              <Icon name="chat" size={17} />
              {t.chatTitle}
            </h3>
            <div className="ai-head-actions">
              <button className="ai-ghost" onClick={loadReport} disabled={sending} type="button">
                <Icon name="reports" size={15} />
                {t.report}
              </button>
              <button className="ai-ghost" onClick={loadForecast} disabled={sending} type="button">
                <Icon name="trend" size={15} />
                {t.forecast}
              </button>
              {chatStarted && (
                <button
                  className="ai-ghost icon-only"
                  onClick={clearChat}
                  disabled={sending}
                  type="button"
                  title={t.clear}
                  aria-label={t.clear}
                >
                  <Icon name="trash" size={15} />
                </button>
              )}
            </div>
          </div>

          <div className="ai-messages" ref={listRef}>
            {messages.map((m, i) => (
              <div key={i} className={`ai-msg ${m.role}${m.error ? " error" : ""}`}>
                {m.role === "ai" && (
                  <span className="ai-avatar">
                    <Icon name="ai" size={14} />
                  </span>
                )}
                <div className="ai-bubble">{m.role === "ai" ? renderText(m.text) : m.text}</div>
              </div>
            ))}
            {sending && (
              <div className="ai-msg ai">
                <span className="ai-avatar">
                  <Icon name="ai" size={14} />
                </span>
                <div className="ai-bubble ai-typing" aria-live="polite">
                  {t.thinking}
                  <span className="ai-dots">
                    <i />
                    <i />
                    <i />
                  </span>
                </div>
              </div>
            )}
          </div>

          <div className="ai-suggest">
            {t.suggestions.map((q) => (
              <button key={q} className="ai-chip" onClick={() => send(q)} disabled={sending} type="button">
                {q}
              </button>
            ))}
          </div>

          <div className="ai-input-row">
            <button
              className={`ai-mic ${listening ? "on" : ""}`}
              onClick={startVoice}
              disabled={sending}
              title={listening ? t.micStop : t.mic}
              aria-label={listening ? t.micStop : t.mic}
              type="button"
            >
              <Icon name="mic" size={18} />
            </button>
            <input
              className="ai-input"
              placeholder={listening ? t.listening : t.placeholder}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              disabled={sending}
            />
            <button className="ai-send" onClick={() => send()} disabled={sending || !input.trim()} type="button">
              <Icon name="send" size={16} />
              <span>{t.send}</span>
            </button>
          </div>
        </section>

        {/* ---------- Anomaly alerts ---------- */}
        <section className="ai-card ai-alert-card">
          <div className="ai-card-head">
            <h3 className="ai-card-title">
              <Icon name="alert" size={17} />
              {t.alertsTitle}
              {!alertLoading && alerts.length > 0 && (
                <span className={`ai-count ${highCount ? "high" : ""}`}>{alerts.length}</span>
              )}
            </h3>
            <button className="ai-ghost" onClick={loadAlerts} disabled={alertLoading} type="button">
              <Icon name="refresh" size={15} className={alertLoading ? "spin" : ""} />
              {t.refresh}
            </button>
          </div>

          {alertLoading ? (
            <div className="ai-skeleton">
              <span />
              <span />
              <span />
            </div>
          ) : alertError !== null ? (
            <div className="ai-empty err">
              <span className="ai-empty-icon">
                <Icon name="alert" size={22} />
              </span>
              <strong>{alertError || t.alertLoadError}</strong>
            </div>
          ) : alerts.length === 0 ? (
            <div className="ai-empty ok">
              <span className="ai-empty-icon">
                <Icon name="check" size={22} strokeWidth={2.4} />
              </span>
              <strong>{t.okTitle}</strong>
              <p>{t.okText}</p>
            </div>
          ) : (
            <div className="ai-alert-list">
              {alerts.map((a, i) => {
                const { title, detail } = alertText(a, lang);
                return (
                  <div key={i} className={`ai-alert ${a.level}`}>
                    <div className="ai-alert-top">
                      <span className="ai-alert-title">{title}</span>
                      <span className={`ai-level ${a.level}`}>{t.level[a.level] || a.level}</span>
                    </div>
                    <div className="ai-alert-detail">{detail}</div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="ai-alert-foot">
            <span>{t.checks}</span>
            {checkedAt && (
              <span>
                {t.lastChecked}:{" "}
                {checkedAt.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
              </span>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

export default AiInsights;
