import React, { useEffect, useRef, useState, useCallback } from "react";
import axios from "axios";
import API_BASE_URL from "../apiConfig";
import "./FaceCapture.css";

function FaceCapture({ user, onDone, onLogout }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);

  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

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
        setError("Camera could not be opened. Please allow camera access and reload.");
      }
    };

    start();
    return () => { cancelled = true; stopCamera(); };
  }, [stopCamera]);

  const capture = async () => {
    setError("");
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const w = video.videoWidth || 640;
    const h = video.videoHeight || 480;
    canvas.width = w;
    canvas.height = h;
    canvas.getContext("2d").drawImage(video, 0, 0, w, h);

    const dataUrl = canvas.toDataURL("image/jpeg", 0.9);

    try {
      setSaving(true);
      const token = localStorage.getItem("token");
      await axios.post(
        `${API_BASE_URL}/api/face/register`,
        { image: dataUrl },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      stopCamera();
      onDone();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to save your photo. Try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="face-shell">
      <div className="face-card">
        <h2 className="face-title">👤 Face Registration</h2>
        <p className="face-sub">
          Hi {user?.name || "there"} — take one clear photo of your face.
          The attendance camera will use it to mark you present.
        </p>

        <div className="face-video-wrap">
          <video ref={videoRef} className="face-video" playsInline muted />
          <div className="face-oval" />
        </div>

        <canvas ref={canvasRef} style={{ display: "none" }} />

        {error && <div className="face-error">{error}</div>}

        <div className="face-tips">
          Look straight at the camera • good light • only your face in frame
        </div>

        <div className="face-actions">
          <button type="button" className="face-capture-btn" onClick={capture} disabled={!ready || saving}>
            {saving ? "Saving..." : "📸 Capture & Save"}
          </button>
          <button type="button" className="face-logout-btn" onClick={() => { stopCamera(); onLogout(); }}>
            Logout
          </button>
        </div>
      </div>
    </div>
  );
}

export default FaceCapture;