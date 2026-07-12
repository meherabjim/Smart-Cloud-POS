const express = require("express");
const router = express.Router();

const {
  getDamagedItems,
  addDamagedItem,
  deleteDamagedItem
} = require("../controllers/damagedController");

// ===============================
// Get All Damaged Items
// GET /api/damaged
// ===============================
router.get("/", getDamagedItems);

// ===============================
// Add Damaged Item
// POST /api/damaged
// ===============================
router.post("/", addDamagedItem);

// ===============================
// Delete Damaged Item
// DELETE /api/damaged/:id
// ===============================
router.delete("/:id", deleteDamagedItem);

module.exports = router;