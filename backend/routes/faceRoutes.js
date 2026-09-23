const express = require("express");
const router = express.Router();

const {
  getStatus,
  registerFace,
  getStoreFaces,
  resetFace,
} = require("../controllers/faceController");

const {
  verifyToken,
  allowRoles,
} = require("../middleware/authMiddleware");

router.get("/status", verifyToken, getStatus);
router.post("/register", verifyToken, registerFace);
router.get("/store-faces", verifyToken, allowRoles("Admin", "Manager", "Viewer"), getStoreFaces);
router.post("/reset/:id", verifyToken, allowRoles("Admin"), resetFace);

module.exports = router;