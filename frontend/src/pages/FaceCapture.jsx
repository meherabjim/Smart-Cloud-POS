import React, { useEffect, useRef, useState, useCallback } from "react";
import axios from "axios";
import API_BASE_URL from "../apiConfig";
import { loadHuman, getFaceDescriptor } from "../faceClient";
import "./FaceCapture.css";

// Shown at first login (when the staff has no face registered yet).
// Detects the face in the browser and saves several embeddings (descriptors).
function FaceCapture({ user, onDone, onLogout }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  const [ready, setReady] = useState(false);
  const [modelLoading, setModelLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [shot, setShot] = useState(0);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    const start = async () => {
      try {
        // Load face models (first time downloads from CDN).
        await loadHuman();
        if (!cancelled) setModelLoading(false);

        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480, facingMode: "user" },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        setReady(true);
      } catch (err) {
        setError(
          "Camera or face model could not load. Allow camera access and check your internet, then reload."
        );
        setModelLoading(false);
      }
    };

    start();
    return () => {
      cancelled = true;
      stopCamera();
    };
  }, [stopCamera]);

  const capture = async () => {
    setError("");
    if (!videoRef.current) return;

    try {
      setSaving(true);

      // Take several samples (move your head a little) for better recognition.
      const TARGET = 5;
      const samples = [];
      for (let i = 0; i < 12 && samples.length < TARGET; i += 1) {
        // eslint-disable-next-line no-await-in-loop
        const found = await getFaceDescriptor(videoRef.current);
        if (found) {
          samples.push(found.descriptor);
          setShot(samples.length);
        }
        // eslint-disable-next-line no-await-in-loop
        await new Promise((r) => setTimeout(r, 350));
      }

      if (samples.length < 3) {
        setError("Could not capture your face clearly. Good light, face the camera, try again.");
        setShot(0);
        setSaving(false);
        return;
      }

      const token = localStorage.getItem("token");
      await axios.post(
        `${API_BASE_URL}/api/face/register`,
        { descriptors: samples },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      stopCamera();
      onDone();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to save your face. Try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="face-shell">
      <div className="face-card">
        <h2 className="face-title">👤 Face Registration</h2>
        <p className="face-sub">
          Hi {user?.name || "there"} — register your face once. The store's
          attendance camera will use it to mark you present.
        </p>

        <div className="face-video-wrap">
          <video ref={videoRef} className="face-video" playsInline muted />
          <div className="face-oval" />
          {modelLoading && (
            <div className="face-loading">Loading face model…</div>
          )}
        </div>

        {error && <div className="face-error">{error}</div>}

        <div className="face-tips">
          Look straight at the camera • good light • only your face in frame
        </div>

        <div className="face-actions">
          <button
            type="button"
            className="face-capture-btn"
            onClick={capture}
            disabled={!ready || saving || modelLoading}
          >
            {saving ? `Capturing ${shot}/5…` : "📸 Register My Face"}
          </button>

          <button
            type="button"
            className="face-logout-btn"
            onClick={() => {
              stopCamera();
              onLogout();
            }}
          >
            Logout
          </button>
        </div>
      </div>
    </div>
  );
}

export default FaceCapture;