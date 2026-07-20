const express = require("express");
const router = express.Router();

const {
  getDamagedItems,
  addDamagedItem,
  deleteDamagedItem,
} = require("../controllers/damagedController");

const {
  blockViewerWrites,
} = require("../middleware/authMiddleware");

// Viewer can view damaged items
router.get(
  "/",
  getDamagedItems
);

// Viewer cannot add damaged items
router.post(
  "/",
  blockViewerWrites,
  addDamagedItem
);

// Viewer cannot delete damaged items
router.delete(
  "/:id",
  blockViewerWrites,
  deleteDamagedItem
);

module.exports = router;