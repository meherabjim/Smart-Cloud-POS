const db = require("../config/db");

// Only Admin sees all stores now (Viewer role removed).
const hasAllStoreAccess = (role) => role === "Admin";

// Same threshold the Attendance Camera uses to say "this is the same person".
const SAME_FACE_THRESHOLD = 0.6;

// Stored JSON -> array of samples (old format was one flat array).
const parseDescriptors = (raw) => {
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return [];
    return Array.isArray(parsed[0]) ? parsed : [parsed];
  } catch (e) {
    return [];
  }
};

const cosine = (a, b) => {
  const n = Math.min(a.length, b.length);
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < n; i += 1) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return na && nb ? dot / (Math.sqrt(na) * Math.sqrt(nb)) : 0;
};

// Best similarity between two sets of samples.
const bestMatch = (samplesA, samplesB) => {
  let best = 0;
  for (const a of samplesA) {
    for (const b of samplesB) {
      const c = cosine(a, b);
      if (c > best) best = c;
    }
  }
  return best;
};

// All users who have a stored face (any status), with store name.
const loadRegisteredFaces = async () => {
  const [rows] = await db.query(`
    SELECT u.id, u.name, u.role, u.store_id, s.name AS store_name, u.face_descriptor
    FROM users u
    LEFT JOIN stores s ON s.id = u.store_id
    WHERE u.face_registered = 1 AND u.face_descriptor IS NOT NULL`);
  return rows
    .map((r) => ({ id: r.id, name: r.name, role: r.role, store_id: r.store_id,
                   store_name: r.store_name, samples: parseDescriptors(r.face_descriptor) }))
    .filter((r) => r.samples.length > 0);
};

// ========================================
// GET /api/face/status
// Is the logged-in user's face registered yet?
// ========================================
exports.getStatus = async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT face_registered FROM users WHERE id = ? LIMIT 1",
      [req.user.id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: "User not found." });
    }
    // Staff (not Admin) must also set where their salary goes.
    let needsPayout = false;
    if (!["Admin", "Viewer"].includes(req.user.role)) {
      try {
        const [acc] = await db.query(
          "SELECT id FROM staff_accounts WHERE user_id = ? AND status = 'Active' LIMIT 1",
          [req.user.id]
        );
        needsPayout = acc.length === 0;
      } catch (e) {
        // staff_accounts table not migrated yet -> don't block login
        needsPayout = false;
      }
    }

    return res.json({
      success: true,
      face_registered: Number(rows[0].face_registered) === 1,
      needs_payout: needsPayout,
    });
  } catch (error) {
    console.error("Face Status Error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ========================================
// POST /api/face/register
// body: { descriptors: number[][] }  or  { descriptor: number[] }
// Saves the logged-in user's own face embedding(s).
// ========================================
exports.registerFace = async (req, res) => {
  try {
    // Accept many samples { descriptors: [[...],[...]] } or one { descriptor: [...] }.
    let list = [];
    if (Array.isArray(req.body.descriptors)) {
      list = req.body.descriptors;
    } else if (Array.isArray(req.body.descriptor)) {
      list = [req.body.descriptor];
    }

    list = list
      .filter((d) => Array.isArray(d) && d.length >= 32)
      .map((d) => d.map((n) => Number(Number(n).toFixed(6))));

    if (list.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Face not detected clearly. Please try again.",
      });
    }

    // 1) One face per account: a registered face can only be replaced after an Admin reset.
    const [meRows] = await db.query("SELECT face_registered FROM users WHERE id = ? LIMIT 1", [req.user.id]);
    if (meRows.length === 0) {
      return res.status(404).json({ success: false, message: "User not found." });
    }
    if (Number(meRows[0].face_registered) === 1) {
      return res.status(409).json({
        success: false,
        message: "Your face is already registered. Ask the Admin to reset it first.",
      });
    }

    // 2) One account per face: the same person cannot register on a second account.
    const others = (await loadRegisteredFaces()).filter((u) => Number(u.id) !== Number(req.user.id));
    for (const other of others) {
      if (bestMatch(list, other.samples) >= SAME_FACE_THRESHOLD) {
        return res.status(409).json({
          success: false,
          message: `This face is already registered to ${other.name} (${other.role}, ${other.store_name || "no store"}). Ask the Admin to reset that face or edit that account instead.`,
        });
      }
    }

    await db.query(
      "UPDATE users SET face_descriptor = ?, face_registered = 1 WHERE id = ?",
      [JSON.stringify(list), req.user.id]
    );

    return res.json({
      success: true,
      message: `Face registered (${list.length} samples).`,
    });
  } catch (error) {
    console.error("Face Register Error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ========================================
// GET /api/face/store-descriptors?store_id=
// Returns registered faces for ONE store, used by that store's
// Attendance Camera page to match against.
// Admin: any store (?store_id=). Others: own store only.
// ========================================
exports.getStoreDescriptors = async (req, res) => {
  try {
    let storeId;
    if (hasAllStoreAccess(req.user.role)) {
      storeId = req.query.store_id ? Number(req.query.store_id) : null;
    } else {
      storeId = req.user.store_id;
    }

    if (!storeId) {
      return res.status(400).json({ success: false, message: "A store is required." });
    }

    const [rows] = await db.query(
      `
      SELECT id AS user_id, name, role, face_descriptor
      FROM users
      WHERE store_id = ?
        AND face_registered = 1
        AND face_descriptor IS NOT NULL
        AND (status IS NULL OR status = 'Active')
      `,
      [storeId]
    );

    const staff = [];
    for (const r of rows) {
      try {
        const parsed = JSON.parse(r.face_descriptor);
        let descriptors = [];
        if (Array.isArray(parsed) && parsed.length > 0) {
          // New format: array of samples. Old format: one flat array.
          descriptors = Array.isArray(parsed[0]) ? parsed : [parsed];
        }
        if (descriptors.length > 0) {
          staff.push({ user_id: r.user_id, name: r.name, role: r.role, descriptors });
        }
      } catch (e) {
        // skip malformed
      }
    }

    return res.json({ success: true, store_id: storeId, staff });
  } catch (error) {
    console.error("Store Descriptors Error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ========================================
// GET /api/face/duplicates   (Admin only)
// Pairs of accounts that hold the same person's face.
// ========================================
exports.getDuplicates = async (req, res) => {
  try {
    const faces = await loadRegisteredFaces();
    const pairs = [];
    for (let i = 0; i < faces.length; i += 1) {
      for (let j = i + 1; j < faces.length; j += 1) {
        const score = bestMatch(faces[i].samples, faces[j].samples);
        if (score >= SAME_FACE_THRESHOLD) {
          const pick = ({ id, name, role, store_name }) => ({ id, name, role, store_name });
          pairs.push({ a: pick(faces[i]), b: pick(faces[j]), score: Number(score.toFixed(2)) });
        }
      }
    }
    return res.json({ success: true, pairs });
  } catch (error) {
    console.error("Face Duplicates Error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ========================================
// POST /api/face/reset/:id   (Admin only)
// Clear a staff member's face so they register again next login.
// ========================================
exports.resetFace = async (req, res) => {
  try {
    const [result] = await db.query(
      "UPDATE users SET face_descriptor = NULL, face_registered = 0 WHERE id = ?",
      [req.params.id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: "User not found." });
    }
    return res.json({
      success: true,
      message: "Face reset. The user will register again at next login.",
    });
  } catch (error) {
    console.error("Face Reset Error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};