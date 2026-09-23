const db = require("../config/db");
const fs = require("fs");
const path = require("path");

const hasAllStoreAccess = (role) => role === "Admin" || role === "Viewer";

const FACE_DIR = path.join(__dirname, "..", "uploads", "faces");

const ensureDir = () => {
  if (!fs.existsSync(FACE_DIR)) {
    fs.mkdirSync(FACE_DIR, { recursive: true });
  }
};

// GET /api/face/status
exports.getStatus = async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT face_registered FROM users WHERE id = ? LIMIT 1",
      [req.user.id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: "User not found." });
    }
    return res.json({
      success: true,
      face_registered: Number(rows[0].face_registered) === 1,
    });
  } catch (error) {
    console.error("Face Status Error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/face/register   body: { image: "data:image/jpeg;base64,...." }
exports.registerFace = async (req, res) => {
  try {
    const { image } = req.body;

    if (!image || typeof image !== "string" || !image.startsWith("data:image")) {
      return res.status(400).json({ success: false, message: "A valid photo is required." });
    }

    const base64 = image.split(",")[1];
    if (!base64) {
      return res.status(400).json({ success: false, message: "Invalid image data." });
    }

    const buffer = Buffer.from(base64, "base64");
    if (buffer.length > 4 * 1024 * 1024) {
      return res.status(400).json({ success: false, message: "Photo is too large." });
    }

    ensureDir();
    const fileName = `user_${req.user.id}.jpg`;
    fs.writeFileSync(path.join(FACE_DIR, fileName), buffer);

    const publicPath = `/uploads/faces/${fileName}`;
    await db.query(
      "UPDATE users SET face_image = ?, face_registered = 1 WHERE id = ?",
      [publicPath, req.user.id]
    );

    return res.json({ success: true, message: "Face registered successfully." });
  } catch (error) {
    console.error("Face Register Error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/face/store-faces?store_id=
exports.getStoreFaces = async (req, res) => {
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
      SELECT id AS user_id, name, role, store_id, face_image
      FROM users
      WHERE store_id = ?
        AND face_registered = 1
        AND face_image IS NOT NULL
        AND (status IS NULL OR status = 'Active')
      ORDER BY name ASC
      `,
      [storeId]
    );

    const base = `${req.protocol}://${req.get("host")}`;

    return res.json({
      success: true,
      store_id: storeId,
      staff: rows.map((r) => ({
        user_id: r.user_id,
        name: r.name,
        role: r.role,
        store_id: r.store_id,
        image_url: `${base}${r.face_image}`,
      })),
    });
  } catch (error) {
    console.error("Store Faces Error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/face/reset/:id   (Admin only)
exports.resetFace = async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT face_image FROM users WHERE id = ? LIMIT 1",
      [req.params.id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: "User not found." });
    }

    if (rows[0].face_image) {
      const filePath = path.join(FACE_DIR, path.basename(rows[0].face_image));
      try { if (fs.existsSync(filePath)) fs.unlinkSync(filePath); } catch (e) {}
    }

    await db.query(
      "UPDATE users SET face_image = NULL, face_registered = 0 WHERE id = ?",
      [req.params.id]
    );

    return res.json({ success: true, message: "Face reset. The user will register again at next login." });
  } catch (error) {
    console.error("Face Reset Error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};