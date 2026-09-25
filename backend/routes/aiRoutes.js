const express = require("express");
const router = express.Router();

const { chat, anomalies, dailyReport, forecast } = require("../controllers/aiController");
const { verifyToken, allowRoles } = require("../middleware/authMiddleware");

// Admin + Manager. Manager is scoped to their own store inside the controller.
router.post("/chat", verifyToken, allowRoles("Admin", "Manager"), chat);
router.get("/anomalies", verifyToken, allowRoles("Admin", "Manager"), anomalies);
router.get("/daily-report", verifyToken, allowRoles("Admin", "Manager"), dailyReport);
router.get("/forecast", verifyToken, allowRoles("Admin", "Manager"), forecast);

module.exports = router;