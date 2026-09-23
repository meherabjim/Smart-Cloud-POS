import sys
import time
import datetime as dt

import numpy as np
import cv2
import requests

from insightface.app import FaceAnalysis
import config


def login():
    r = requests.post(f"{config.API_BASE}/api/auth/login",
                      json={"email": config.LOGIN_EMAIL, "password": config.LOGIN_PASSWORD},
                      timeout=15)
    if r.status_code != 200:
        raise SystemExit(f"Login failed ({r.status_code}): {r.text}")
    token = r.json().get("token")
    if not token:
        raise SystemExit("Login returned no token.")
    print("Logged in.")
    return token


def fetch_store_faces(token):
    r = requests.get(f"{config.API_BASE}/api/face/store-faces",
                     params={"store_id": config.STORE_ID},
                     headers={"Authorization": f"Bearer {token}"}, timeout=20)
    if r.status_code != 200:
        raise SystemExit(f"Could not load faces ({r.status_code}): {r.text}")
    return r.json().get("staff", [])


def download_image(url):
    r = requests.get(url, timeout=20)
    if r.status_code != 200:
        return None
    arr = np.frombuffer(r.content, np.uint8)
    return cv2.imdecode(arr, cv2.IMREAD_COLOR)


def mark_attendance(token, user_id, status, check_in_time):
    return requests.post(f"{config.API_BASE}/api/attendance",
                         json={"user_id": user_id, "date": dt.date.today().isoformat(),
                               "status": status, "check_in_time": check_in_time},
                         headers={"Authorization": f"Bearer {token}"}, timeout=15)


def normalize(v):
    n = np.linalg.norm(v)
    return v / n if n > 0 else v


def best_embedding(app, image):
    faces = app.get(image)
    if not faces:
        return None
    faces.sort(key=lambda f: (f.bbox[2]-f.bbox[0])*(f.bbox[3]-f.bbox[1]), reverse=True)
    return normalize(faces[0].embedding)


def decide_status(now):
    start = now.replace(hour=config.SHIFT_START_HOUR, minute=config.SHIFT_START_MINUTE,
                        second=0, microsecond=0)
    return "Late" if now > start + dt.timedelta(minutes=config.GRACE_MINUTES) else "Present"


def main():
    print("Starting attendance camera for store", config.STORE_ID)
    token = login()
    staff = fetch_store_faces(token)
    if not staff:
        print("No registered faces for this store yet.")
        return

    print(f"Loaded {len(staff)} staff. Building models (first run downloads the model)...")
    app = FaceAnalysis(name="buffalo_l")
    app.prepare(ctx_id=0, det_size=(640, 640))

    known = []
    for s in staff:
        img = download_image(s["image_url"])
        if img is None:
            print("  ! photo load failed:", s["name"]); continue
        emb = best_embedding(app, img)
        if emb is None:
            print("  ! no face in photo:", s["name"]); continue
        known.append((s["user_id"], s["name"], emb))
        print("  ok", s["name"])

    if not known:
        print("No usable faces."); return

    ids = np.array([k[0] for k in known])
    names = [k[1] for k in known]
    mat = np.vstack([k[2] for k in known])
    last_marked = {}

    cap = cv2.VideoCapture(config.CAMERA_INDEX)
    if not cap.isOpened():
        raise SystemExit("Could not open webcam. Check CAMERA_INDEX.")

    print("Camera running. Press Q to quit.")
    while True:
        ok, frame = cap.read()
        if not ok:
            continue
        for f in app.get(frame):
            emb = normalize(f.embedding)
            sims = mat @ emb
            i = int(np.argmax(sims))
            score = float(sims[i])
            x1, y1, x2, y2 = [int(v) for v in f.bbox]

            if score >= config.MATCH_THRESHOLD:
                uid = int(ids[i]); name = names[i]
                now = dt.datetime.now()
                label = f"{name} ({score:.2f})"; color = (0, 170, 0)
                if time.time() - last_marked.get(uid, 0) >= config.MARK_COOLDOWN_SECONDS:
                    status = decide_status(now)
                    check_in = now.strftime("%H:%M:%S")
                    try:
                        r = mark_attendance(token, uid, status, check_in)
                        if r.status_code in (200, 201):
                            last_marked[uid] = time.time()
                            label = f"{name}: {status}"
                            print(f"[{check_in}] {name} -> {status}")
                        elif r.status_code == 401:
                            token = login()
                        else:
                            try: msg = r.json().get("message", "")
                            except Exception: msg = r.text
                            label = f"{name}: {msg}"; color = (0, 140, 220)
                    except Exception as e:
                        print("  ! request error:", e)
                else:
                    label = f"{name}: already marked"
            else:
                label = "Unknown / other store"; color = (0, 0, 200)

            cv2.rectangle(frame, (x1, y1), (x2, y2), color, 2)
            cv2.putText(frame, label, (x1, max(20, y1-10)),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.6, color, 2)

        cv2.putText(frame, f"Store #{config.STORE_ID} | Press Q to quit",
                    (12, 28), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (60, 60, 60), 2)
        cv2.imshow("Attendance Camera", frame)
        if cv2.waitKey(1) & 0xFF in (ord("q"), ord("Q")):
            break

    cap.release()
    cv2.destroyAllWindows()


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        sys.exit(0)