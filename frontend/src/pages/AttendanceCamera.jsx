import React, { useEffect, useRef, useState, useCallback } from "react";
import axios from "axios";
import API_BASE_URL from "../apiConfig";
import { loadHuman, getFaceDescriptor, cosine } from "../faceClient";
import "./AttendanceCamera.css";

// ---- Tunable settings ----
const SHIFT_START_HOUR = 9;      // shop opens 9:00
const SHIFT_START_MINUTE = 0;
const GRACE_MINUTES = 15;        // after 9:15 = Late
const MATCH_THRESHOLD = 0.6;     // higher = stricter (0.5–0.7)
const MATCH_MARGIN = 0.06;       // best must beat 2nd best by this much
const COOLDOWN_MS = 60000;       // don't re-mark same person within 1 min
const SCAN_EVERY_MS = 900;       // how often to scan a frame

const todayStr = () => new Date().toISOString().slice(0, 10);

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

function AttendanceCamera({ user, activeStoreId }) {
  const storeId =
    activeStoreId || Number(localStorage.getItem("activeStoreId")) || 1;
  const token = localStorage.getItem("token");
  const headers = { Authorization: `Bearer ${token}` };

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const timerRef = useRef(null);
  const busyRef = useRef(false);
  const cooldownRef = useRef({}); // user_id -> last mark time
  const markedTodayRef = useRef(new Set()); // user_ids already marked today

  const [known, setKnown] = useState([]); // [{user_id,name,descriptors}]
  const [modelLoading, setModelLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState("");
  const [lastMark, setLastMark] = useState(null); // {name,status}
  const [today, setToday] = useState([]); // marked list

  // Load this store's registered faces + models + today's list.
  const loadKnown = useCallback(async () => {
    try {
      const res = await axios.get(
        `${API_BASE_URL}/api/face/store-descriptors?store_id=${storeId}`,
        { headers }
      );
      setKnown(res.data.staff || []);
    } catch (err) {
      setStatus(err.response?.data?.message || "Failed to load staff faces.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId]);

  const loadToday = useCallback(async () => {
    try {
      const res = await axios.get(
        `${API_BASE_URL}/api/attendance?date=${todayStr()}&store_id=${storeId}`,
        { headers }
      );
      setToday(res.data.staff || []);
    } catch (err) {
      // ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId]);

  useEffect(() => {
    loadHuman()
      .then(() => setModelLoading(false))
      .catch(() => {
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
        setLastMark({ name: `${matched.name} — already marked`, status: "already" });
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
        if (
          best &&
          bestScore >= MATCH_THRESHOLD &&
          bestScore - secondScore >= MATCH_MARGIN
        ) {
          markPresent(best);
        } else {
          setLastMark({
            name: best ? `Not sure: ${best.name}? (${scoreTxt})` : "No match",
            status: "none",
          });
        }
      } else if (found) {
        setLastMark({ name: "No staff registered here", status: "none" });
      }
    } catch (e) {
      // ignore per-frame errors
    } finally {
      busyRef.current = false;
    }
  }, [known, markPresent]);

  const start = async () => {
    setStatus("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: "user" },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setRunning(true);
      timerRef.current = setInterval(scanOnce, SCAN_EVERY_MS);
    } catch (err) {
      setStatus("Camera could not be opened. Allow camera access.");
    }
  };

  const stop = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setRunning(false);
  }, []);

  // Restart the scan loop if `known` changes while running.
  useEffect(() => {
    if (running) {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(scanOnce, SCAN_EVERY_MS);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [running, scanOnce]);

  useEffect(() => stop, [stop]);

  const closeDay = async () => {
    if (!window.confirm("Mark everyone who didn't come today as Absent?")) return;
    try {
      const res = await axios.post(
        `${API_BASE_URL}/api/attendance/close-day`,
        { date: todayStr(), store_id: storeId },
        { headers }
      );
      alert(res.data.message || "Day closed.");
      loadToday();
    } catch (err) {
      alert(err.response?.data?.message || "Close day failed.");
    }
  };

  const markedList = today.filter((s) => s.status);

  return (
    <div className="cam-page">
      <div className="cam-header">
        <div>
          <h2>📷 Attendance Camera</h2>
          <p>
            Store #{storeId} • Stand in front of the camera to mark attendance.
            Registered staff of this store only.
          </p>
        </div>
        <div className="cam-store-badge">
          <span>Store</span>
          <strong>#{storeId}</strong>
        </div>
      </div>

      <div className="cam-grid">
        <div className="cam-card">
          <div className="cam-video-wrap">
            <video ref={videoRef} className="cam-video" playsInline muted />
            {!running && (
              <div className="cam-overlay">
                {modelLoading ? "Loading face model…" : "Camera is off"}
              </div>
            )}
            {lastMark && running && (
              <div
                className={`cam-result ${
                  lastMark.status === "none"
                    ? "bad"
                    : lastMark.status === "already"
                    ? "info"
                    : "good"
                }`}
              >
                {lastMark.status === "none"
                  ? "❌ " + lastMark.name
                  : lastMark.status === "already"
                  ? "ℹ " + lastMark.name
                  : `✔ ${lastMark.name} — ${lastMark.status}`}
              </div>
            )}
          </div>

          <div className="cam-actions">
            {!running ? (
              <button
                className="cam-btn start"
                onClick={start}
                disabled={modelLoading}
              >
                ▶ Start Camera
              </button>
            ) : (
              <button className="cam-btn stop" onClick={stop}>
                ⏹ Stop Camera
              </button>
            )}

            <button className="cam-btn refresh" onClick={loadKnown}>
              ↻ Reload Faces ({known.length})
            </button>

            <button className="cam-btn close" onClick={closeDay}>
              🌙 Close Day (mark absentees)
            </button>
          </div>

          {status && <div className="cam-status">{status}</div>}
        </div>

        <div className="cam-card">
          <h3 className="cam-list-title">Today — {todayStr()}</h3>
          <div className="cam-list-wrap">
            <table className="cam-table">
              <thead>
                <tr>
                  <th>Staff</th>
                  <th>Status</th>
                  <th>Time</th>
                </tr>
              </thead>
              <tbody>
                {markedList.length === 0 ? (
                  <tr>
                    <td colSpan="3" className="cam-empty">
                      No one marked yet today.
                    </td>
                  </tr>
                ) : (
                  markedList.map((s) => (
                    <tr key={s.user_id}>
                      <td className="cam-bold">{s.name}</td>
                      <td>
                        <span className={`cam-badge ${String(s.status).toLowerCase()}`}>
                          {s.status}
                        </span>
                      </td>
                      <td>{fmtTime(s.check_in_time)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AttendanceCamera;