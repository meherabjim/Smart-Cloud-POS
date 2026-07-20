const express = require("express");
const router = express.Router();

const {
  checkout,
  getSales,
  getSaleDetails,
} = require("../controllers/salesController");

const {
  verifyToken,
  blockViewerWrites,
} = require("../middleware/authMiddleware");

// Complete Sale
// Login required; Viewer cannot create a sale
router.post(
  "/checkout",
  verifyToken,
  blockViewerWrites,
  checkout
);

// Sales History
router.get("/", getSales);

// Single Invoice
router.get("/:id", getSaleDetails);

module.exports = router;