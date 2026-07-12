import React, { useEffect, useRef, useState } from "react";

function BarcodeScanner({
  open,
  onClose,
  onScanSuccess,
  title = "Scan Barcode",
}) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const intervalRef = useRef(null);
  const lastScannedRef = useRef("");

  // Always hold the latest callbacks in refs so the camera effect below
  // only depends on `open` — it won't stop/restart the camera just because
  // the parent re-rendered and passed new (non-memoized) function props.
  const onCloseRef = useRef(onClose);
  const onScanSuccessRef = useRef(onScanSuccess);

  useEffect(() => {
    onCloseRef.current = onClose;
    onScanSuccessRef.current = onScanSuccess;
  }, [onClose, onScanSuccess]);

  const [manualCode, setManualCode] = useState("");
  const [supportMsg, setSupportMsg] = useState("");

  useEffect(() => {
    if (!open) return;

    let stopped = false;

    const stopScanner = () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }

      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    };

    const handleDetected = (code) => {
      if (!code) return;

      if (code === lastScannedRef.current) return;

      lastScannedRef.current = code;

      stopScanner();

      if (navigator.vibrate) {
        navigator.vibrate(100);
      }

      onScanSuccessRef.current(code);

      setTimeout(() => {
        onCloseRef.current();
      }, 100);
    };

    const startCamera = async () => {
      try {
        setSupportMsg("");
        setManualCode("");
        lastScannedRef.current = "";

        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });

        if (stopped) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        if ("BarcodeDetector" in window) {
          const detector = new window.BarcodeDetector({
            formats: [
              "code_128",
              "code_39",
              "ean_13",
              "ean_8",
              "upc_a",
              "upc_e",
              "itf",
              "qr_code",
            ],
          });

          intervalRef.current = setInterval(async () => {
            try {
              if (!videoRef.current) return;

              const barcodes = await detector.detect(videoRef.current);

              if (barcodes.length > 0) {
                handleDetected(barcodes[0].rawValue);
              }
            } catch (err) {
              // Ignore scan errors
            }
          }, 300);
        } else {
          setSupportMsg(
            "Your browser doesn't support automatic barcode scanning. Please enter the barcode manually."
          );
        }
      } catch (err) {
        console.error(err);
        setSupportMsg(
          "Unable to access the camera. Please allow camera permission or enter the barcode manually."
        );
      }
    };

    startCamera();

    return () => {
      stopped = true;
      stopScanner();
    };
  }, [open]);

  const handleClose = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    onClose();
  };

  const handleManualUse = () => {
    const code = manualCode.trim();

    if (!code) return;

    lastScannedRef.current = code;

    onScanSuccess(code);

    handleClose();
  };

  if (!open) return null;

  return (
    <div className="scanner-overlay">
      <div className="scanner-modal">
        <div className="scanner-header">
          <h3>{title}</h3>

          <button
            type="button"
            className="scanner-close-btn"
            onClick={handleClose}
          >
            ✕
          </button>
        </div>

        <div className="scanner-video-wrapper">
          <video
            ref={videoRef}
            className="scanner-video"
            autoPlay
            muted
            playsInline
          />

          <div className="scanner-frame">
            <div className="scanner-line"></div>
          </div>
        </div>

        <p className="scanner-note">
          Point the camera at a barcode. The barcode will be detected
          automatically.
        </p>

        {supportMsg && <div className="scanner-warning">{supportMsg}</div>}

        <div className="scanner-manual">
          <input
            className="scanner-input"
            type="text"
            value={manualCode}
            placeholder="Enter barcode manually"
            onChange={(e) => setManualCode(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                handleManualUse();
              }
            }}
          />

          <button
            type="button"
            className="scanner-use-btn"
            onClick={handleManualUse}
          >
            Use Barcode
          </button>
        </div>

        <div className="scanner-demo">
          Demo: 10001 • 10002 • 10003 • 123456789012 • 8801234567890
        </div>
      </div>
    </div>
  );
}

export default BarcodeScanner;