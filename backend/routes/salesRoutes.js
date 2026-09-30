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

// Sales History (login required; staff see only their own store)
router.get("/", verifyToken, getSales);

// Single Invoice (login required)
router.get("/:id", verifyToken, getSaleDetails);

module.exports = router;