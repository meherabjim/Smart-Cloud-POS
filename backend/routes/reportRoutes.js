const express = require("express");
const router = express.Router();
const { getSummary } = require("../controllers/reportController");

// GET /api/reports/summary
router.get("/summary", getSummary);

module.exports = router;
