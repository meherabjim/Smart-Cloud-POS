const express = require("express");
const router = express.Router();

const {
  verifyToken,
  allowRoles,
} = require("../middleware/authMiddleware");

const {
  resetDemoData,
} = require("../controllers/settingsController");

// Only Admin can reset system/demo data
router.post(
  "/reset-demo",
  verifyToken,
  allowRoles("Admin"),
  resetDemoData
);

module.exports = router;