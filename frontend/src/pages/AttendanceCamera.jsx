import React, { useEffect, useRef, useState, useCallback } from "react";
import axios from "axios";
import API_BASE_URL from "../apiConfig";
import { loadHuman, getFaceDescriptor, cosine } from "../faceClient";
import "./AttendanceCamera.css";
import Icon from "../components/Icon";
import { toast } from "../components/Toast";

// ---- Tunable settings ----
const SHIFT_START_HOUR = 9;      // shop opens 9:00
const SHIFT_START_MINUTE = 0;
const GRACE_MINUTES = 15;        // after 9:15 = Late
const MATCH_THRESHOLD = 0.6;     // higher = stricter (0.5–0.7)
const MATCH_MARGIN = 0.06;       // best must beat 2nd best by this much
const COOLDOWN_MS = 60000;       // don't re-mark same person within 1 min
const SCAN_EVERY_MS = 900;       // how often to scan a frame

// Local date (not UTC) as YYYY-MM-DD
const todayStr = () => new Date().toLocaleDateString("en-CA");

// "14:20:47" -> "2:20 PM"
const fmtTime = (t) => {
  if (!t) return "-";
  const parts = String(t).split(":");
  let h = Number(parts[0]);
  const m = parts[1] || "00";
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${h}:${m} ${ampm}`;
};

const initials = (name) =>
  String(name || "?")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

function AttendanceCamera({ user, activeStoreId }) {
  const storeId = activeStoreId || Number(localStorage.getItem("activeStoreId")) || 1;
  const token = localStorage.getItem("token");
  const headers = { Authorization: `Bearer ${token}` };

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const timerRef = useRef(null);
  const busyRef = useRef(false);
  const mountedRef = useRef(true);
  const autoStartedRef = useRef(false);
  const cooldownRef = useRef({}); // user_id -> last mark time
  const markedTodayRef = useRef(new Set()); // user_ids already marked today

  const [known, setKnown] = useState([]); // [{user_id,name,descriptors}]
  const [modelLoading, setModelLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [starting, setStarting] = useState(false);
  const [status, setStatus] = useState("");
  const [lastMark, setLastMark] = useState(null); // {name,status}
  const [today, setToday] = useState([]); // staff list for today

  // Load this store's registered faces.
  const loadKnown = useCallback(async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/face/store-descriptors?store_id=${storeId}`, {
        headers,
      });
      setKnown(res.data.staff || []);
    } catch (err) {
      setStatus(err.response?.data?.message || "Failed to load staff faces.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId]);

  const loadToday = useCallback(async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/attendance?date=${todayStr()}&store_id=${storeId}`, {
        headers,
      });
      setToday(res.data.staff || []);
    } catch (err) {
      // ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    loadHuman()
      .then(() => mountedRef.current && setModelLoading(false))
      .catch(() => {
        if (!mountedRef.current) return;
        setModelLoading(false);
        setStatus("Face model failed to load. Check internet and reload.");
      });
    loadKnown();
    loadToday();
  }, [loadKnown, loadToday]);

  // Keep the "already marked today" set in sync with the server list.
  useEffect(() => {
    const s = new Set();
    today.forEach((t) => {
      if (t.status) s.add(t.user_id);
    });
    markedTodayRef.current = s;
  }, [today]);

  const decideStatus = () => {
    const now = new Date();
    const lateAfter = new Date();
    lateAfter.setHours(SHIFT_START_HOUR, SHIFT_START_MINUTE + GRACE_MINUTES, 0, 0);
    return now > lateAfter ? "Late" : "Present";
  };

  const markPresent = useCallback(
    async (matched) => {
      // Already marked today → keep the FIRST mark, don't overwrite the time.
      if (markedTodayRef.current.has(matched.user_id)) {
        setLastMark({ name: `${matched.name} — already marked today`, status: "already" });
        return;
      }

      const now = Date.now();
      const last = cooldownRef.current[matched.user_id] || 0;
      if (now - last < COOLDOWN_MS) return;
      cooldownRef.current[matched.user_id] = now;

      const st = decideStatus();
      try {
        await axios.post(
          `${API_BASE_URL}/api/attendance`,
          {
            user_id: matched.user_id,
            date: todayStr(),
            status: st,
            check_in_time: new Date().toTimeString().slice(0, 8),
            source: "face",
          },
          { headers }
        );
        markedTodayRef.current.add(matched.user_id);
        setLastMark({ name: matched.name, status: st });
        setStatus("");
        loadToday();
      } catch (err) {
        setStatus(err.response?.data?.message || "Mark failed.");
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [loadToday]
  );

  const scanOnce = useCallback(async () => {
    if (busyRef.current || !videoRef.current) return;
    busyRef.current = true;
    try {
      const found = await getFaceDescriptor(videoRef.current);
      if (found && known.length > 0) {
        let best = null;
        let bestScore = -1;
        let secondScore = -1;
        for (const k of known) {
          // Each staff can have several saved samples — take the closest.
          const list = k.descriptors || (k.descriptor ? [k.descriptor] : []);
          let s = -1;
          for (const d of list) {
            const c = cosine(found.descriptor, d);
            if (c > s) s = c;
          }
          if (s > bestScore) {
            secondScore = bestScore;
            bestScore = s;
            best = k;
          } else if (s > secondScore) {
            secondScore = s;
          }
        }
        const scoreTxt = bestScore.toFixed(2);
        if (best && bestScore >= MATCH_THRESHOLD && bestScore - secondScore >= MATCH_MARGIN) {
          markPresent(best);
        } else {
          setLastMark({
            name: best ? `Not sure — ${best.name}? (${scoreTxt})` : "Face not recognised",
            status: "none",
          });
        }
      } else if (found) {
        setLastMark({ name: "No staff face registered in this store", status: "none" });
      }
    } catch (e) {
      // ignore per-frame errors
    } finally {
      busyRef.current = false;
    }
  }, [known, markPresent]);

  const stop = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
    setRunning(false);
    setLastMark(null);
  }, []);

  const start = useCallback(async () => {
    if (streamRef.current) return;
    setStatus("");
    setStarting(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: "user" },
        audio: false,
      });
      // Page was closed while the browser was asking for the camera
      if (!mountedRef.current) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      setRunning(true);
    } catch (err) {
      if (mountedRef.current) {
        setStatus(
          err?.name === "NotAllowedError"
            ? "Camera permission was blocked. Allow camera access in the browser and turn the camera on again."
            : "Camera could not be opened. Check that no other app is using it."
        );
      }
    } finally {
      if (mountedRef.current) setStarting(false);
    }
  }, []);

  // Opening the page from the sidebar turns the camera on automatically
  // (once the face model is ready). The user can switch it off/on any time.
  useEffect(() => {
    if (!modelLoading && !autoStartedRef.current) {
      autoStartedRef.current = true;
      start();
    }
  }, [modelLoading, start]);

  // Run the scan loop while the camera is on (restarts if `known` changes).
  useEffect(() => {
    if (!running) return undefined;
    timerRef.current = setInterval(scanOnce, SCAN_EVERY_MS);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
    };
  }, [running, scanOnce]);

  // Leaving the page always turns the camera off
  useEffect(() => stop, [stop]);

  const toggleCamera = () => (running ? stop() : start());

  const closeDay = async () => {
    if (!window.confirm("Mark everyone who didn't come today as Absent?")) return;
    try {
      const res = await axios.post(
        `${API_BASE_URL}/api/attendance/close-day`,
        { date: todayStr(), store_id: storeId },
        { headers }
      );
      toast.success(res.data.message || "Day closed.");
      loadToday();
    } catch (err) {
      toast.error(err.response?.data?.message || "Close day failed.");
    }
  };

  const reloadFaces = async () => {
    await loadKnown();
    toast.info("Staff faces reloaded.");
  };

  const markedList = today.filter((s) => s.status);
  const count = (st) => today.filter((s) => s.status === st).length;
  const presentCount = count("Present");
  const lateCount = count("Late");
  const absentCount = count("Absent");
  const notYet = today.filter((s) => !s.status).length;

  const camState = modelLoading ? "loading" : starting ? "starting" : running ? "on" : "off";
  const resultClass = lastMark
    ? lastMark.status === "none"
      ? "bad"
      : lastMark.status === "already"
      ? "info"
      : lastMark.status === "Late"
      ? "late"
      : "good"
    : "";

  return (
    <div className="cam-page">
      {/* ---------- Header ---------- */}
      <div className="cam-header">
        <div className="cam-header-left">
          <span className="cam-header-icon">
            <Icon name="camera" size={21} />
          </span>
          <div>
            <h2>Attendance Camera</h2>
            <p>Stand in front of the camera to mark attendance. Only registered staff of this store are recognised.</p>
          </div>
        </div>
        <div className="cam-header-right">
          <span className="cam-chip">
            <Icon name="stores" size={14} />
            Store #{storeId}
          </span>
          <span className="cam-chip">
            <Icon name="attendance" size={14} />
            Late after {SHIFT_START_HOUR}:{String(SHIFT_START_MINUTE + GRACE_MINUTES).padStart(2, "0")} AM
          </span>
        </div>
      </div>

      <div className="cam-grid">
        {/* ---------- Camera ---------- */}
        <section className="cam-card cam-camera-card">
          <div className="cam-card-head">
            <h3 className="cam-card-title">
              <span className={`cam-dot ${camState}`} />
              {camState === "on"
                ? "Camera is on — scanning"
                : camState === "starting"
                ? "Opening camera…"
                : camState === "loading"
                ? "Loading face model…"
                : "Camera is off"}
            </h3>

            <label className={`cam-switch ${modelLoading || starting ? "disabled" : ""}`}>
              <span className="cam-switch-label">{running ? "On" : "Off"}</span>
              <input
                type="checkbox"
                checked={running}
                onChange={toggleCamera}
                disabled={modelLoading || starting}
                aria-label="Camera on or off"
              />
              <span className="cam-switch-track">
                <span className="cam-switch-thumb" />
              </span>
            </label>
          </div>

          <div className={`cam-video-wrap ${running ? "live" : ""}`}>
            <video ref={videoRef} className="cam-video" playsInline muted />

            {running && (
              <>
                <span className="cam-live">
                  <i /> LIVE
                </span>
                <div className="cam-frame" aria-hidden="true">
                  <span className="c tl" />
                  <span className="c tr" />
                  <span className="c bl" />
                  <span className="c br" />
                  <span className="cam-scanline" />
                </div>
              </>
            )}

            {!running && (
              <div className="cam-overlay">
                {camState === "loading" || camState === "starting" ? (
                  <span className="cam-spinner" />
                ) : (
                  <span className="cam-overlay-icon">
                    <Icon name="camera" size={28} />
                  </span>
                )}
                <strong>
                  {camState === "loading"
                    ? "Loading face model…"
                    : camState === "starting"
                    ? "Opening camera…"
                    : "Camera is off"}
                </strong>
                {camState === "off" && (
                  <button type="button" className="cam-btn primary" onClick={start}>
                    <Icon name="camera" size={16} />
                    Turn camera on
                  </button>
                )}
              </div>
            )}

            {lastMark && running && (
              <div className={`cam-result ${resultClass}`}>
                <Icon
                  name={lastMark.status === "none" ? "alert" : lastMark.status === "already" ? "info" : "check"}
                  size={18}
                  strokeWidth={2.4}
                />
                <span>
                  {lastMark.status === "none" || lastMark.status === "already"
                    ? lastMark.name
                    : `${lastMark.name} — ${lastMark.status}`}
                </span>
              </div>
            )}
          </div>

          <div className="cam-actions">
            <button type="button" className="cam-btn ghost" onClick={reloadFaces}>
              <Icon name="refresh" size={15} />
              Reload faces
              <span className="cam-count">{known.length}</span>
            </button>
            <button type="button" className="cam-btn warn" onClick={closeDay}>
              <Icon name="attendance" size={15} />
              Close day (mark absentees)
            </button>
          </div>

          {status && (
            <div className="cam-status">
              <Icon name="alert" size={16} />
              <span>{status}</span>
            </div>
          )}
        </section>

        {/* ---------- Today ---------- */}
        <section className="cam-card">
          <div className="cam-card-head">
            <h3 className="cam-card-title">
              <Icon name="users" size={17} className="cam-title-icon" />
              Today
              <span className="cam-date">{todayStr()}</span>
            </h3>
          </div>

          <div className="cam-stats">
            <div className="cam-stat present">
              <span>Present</span>
              <strong>{presentCount}</strong>
            </div>
            <div className="cam-stat late">
              <span>Late</span>
              <strong>{lateCount}</strong>
            </div>
            <div className="cam-stat absent">
              <span>Absent</span>
              <strong>{absentCount}</strong>
            </div>
            <div className="cam-stat waiting">
              <span>Not yet</span>
              <strong>{notYet}</strong>
            </div>
          </div>

          <div className="cam-list-wrap">
            <table className="cam-table">
              <thead>
                <tr>
                  <th>Staff</th>
                  <th>Status</th>
                  <th className="right">Time</th>
                </tr>
              </thead>
              <tbody>
                {markedList.length === 0 ? (
                  <tr>
                    <td colSpan="3" className="cam-empty">
                      <span className="cam-empty-icon">
                        <Icon name="attendance" size={20} />
                      </span>
                      No one marked yet today.
                    </td>
                  </tr>
                ) : (
                  markedList.map((s) => (
                    <tr key={s.user_id}>
                      <td>
                        <div className="cam-person">
                          <span className="cam-avatar">{initials(s.name)}</span>
                          <span className="cam-bold">{s.name}</span>
                        </div>
                      </td>
                      <td>
                        <span className={`cam-badge ${String(s.status).toLowerCase()}`}>{s.status}</span>
                      </td>
                      <td className="right cam-time">{fmtTime(s.check_in_time)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}

export default AttendanceCamera;