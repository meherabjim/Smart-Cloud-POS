const express = require("express");
const router = express.Router();

const {
  getStatus,
  registerFace,
  getStoreDescriptors,
  resetFace,
} = require("../controllers/faceController");

const { verifyToken, allowRoles } = require("../middleware/authMiddleware");

router.get("/status", verifyToken, getStatus);
router.post("/register", verifyToken, registerFace);
router.get("/store-descriptors", verifyToken, allowRoles("Admin", "Manager"), getStoreDescriptors);
router.post("/reset/:id", verifyToken, allowRoles("Admin"), resetFace);

module.exports = router;