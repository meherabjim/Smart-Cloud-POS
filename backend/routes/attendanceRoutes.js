const express = require("express");
const router = express.Router();

const {
  getAttendanceByDate,
  markAttendance,
  getMonthlySummary,
} = require("../controllers/attendanceController");

const {
  verifyToken,
  allowRoles,
  blockViewerWrites,
} = require("../middleware/authMiddleware");

router.get("/", verifyToken, allowRoles("Admin", "Manager", "Viewer"), getAttendanceByDate);
router.get("/summary", verifyToken, allowRoles("Admin", "Manager", "Viewer"), getMonthlySummary);
router.post("/", verifyToken, allowRoles("Admin", "Manager"), blockViewerWrites, markAttendance);

module.exports = router;