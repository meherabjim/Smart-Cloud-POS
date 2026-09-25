const express = require("express");
const router = express.Router();

const {
  getAttendanceByDate,
  markAttendance,
  getMonthlySummary,
  closeDay,
} = require("../controllers/attendanceController");

const { verifyToken, allowRoles, blockViewerWrites } = require("../middleware/authMiddleware");

router.get("/", verifyToken, allowRoles("Admin", "Manager"), getAttendanceByDate);
router.get("/summary", verifyToken, allowRoles("Admin", "Manager"), getMonthlySummary);
router.post("/", verifyToken, allowRoles("Admin", "Manager"), blockViewerWrites, markAttendance);
router.post("/close-day", verifyToken, allowRoles("Admin", "Manager"), blockViewerWrites, closeDay);

module.exports = router;