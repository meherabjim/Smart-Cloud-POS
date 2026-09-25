const db = require("../config/db");

// Only Admin sees all stores now (Viewer role removed).
const hasAllStoreAccess = (role) => role === "Admin";

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