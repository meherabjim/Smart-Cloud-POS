const express = require("express");
const router = express.Router();

const {
  getExpenses,
  addExpense,
  deleteExpense,
} = require("../controllers/expenseController");

const {
  verifyToken,
  allowRoles,
  blockViewerWrites,
} = require("../middleware/authMiddleware");

router.get("/", verifyToken, allowRoles("Admin", "Manager", "Viewer"), getExpenses);
router.post("/", verifyToken, allowRoles("Admin", "Manager"), blockViewerWrites, addExpense);
router.delete("/:id", verifyToken, allowRoles("Admin", "Manager"), blockViewerWrites, deleteExpense);

module.exports = router;