// Shared browser face engine (@vladmandic/human).
import { Human } from "@vladmandic/human";

let humanInstance = null;
let loadPromise = null;

export function getHuman() {
  if (!humanInstance) {
    humanInstance = new Human({
      modelBasePath: "https://cdn.jsdelivr.net/npm/@vladmandic/human@3/models",
      cacheSensitivity: 0,
      warmup: "none",
      face: {
        enabled: true,
        detector: { rotation: false, maxDetected: 1, minConfidence: 0.3 },
        mesh: { enabled: true },
        iris: { enabled: false },
        description: { enabled: true },
        emotion: { enabled: false },
      },
      body: { enabled: false },
      hand: { enabled: false },
      object: { enabled: false },
      gesture: { enabled: false },
      filter: { enabled: true },
    });
  }
  return humanInstance;
}

export async function loadHuman() {
  const human = getHuman();
  if (!loadPromise) {
    loadPromise = human.load();
  }
  await loadPromise;
  return human;
}

export function cosine(a, b) {
  if (!a || !b) return 0;
  const n = Math.min(a.length, b.length);
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < n; i += 1) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

export async function getFaceDescriptor(source) {
  const human = await loadHuman();
  const res = await human.detect(source);
  if (
    res &&
    Array.isArray(res.face) &&
    res.face.length > 0 &&
    res.face[0].embedding &&
    res.face[0].embedding.length > 0
  ) {
    return {
      descriptor: Array.from(res.face[0].embedding),
      score: res.face[0].faceScore || res.face[0].score || 0,
    };
  }
  return null;
}