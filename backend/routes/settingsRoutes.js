const express = require("express");
const router = express.Router();

const { verifyToken } = require("../middleware/authMiddleware");
const { resetDemoData } = require("../controllers/settingsController");

router.post("/reset-demo", (req, res, next) => {
  console.log(">>> RESET ROUTE HIT");
  next();
}, verifyToken, resetDemoData);

module.exports = router;