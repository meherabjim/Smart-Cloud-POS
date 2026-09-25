const express = require("express");
const router = express.Router();

const {
  getMine,
  saveMine,
  cancelMine,
  listPending,
  review,
  mySalary,
} = require("../controllers/payoutController");

const {
  verifyToken,
  allowRoles,
  blockViewerWrites,
} = require("../middleware/authMiddleware");

// Any logged-in staff: own salary account + own payslips
router.get("/me", verifyToken, getMine);
router.post("/me", verifyToken, blockViewerWrites, saveMine);
router.delete("/me/pending", verifyToken, blockViewerWrites, cancelMine);
router.get("/my-salary", verifyToken, mySalary);

// Admin: approve / reject account change requests
router.get("/pending", verifyToken, allowRoles("Admin"), listPending);
router.post("/:id/approve", verifyToken, allowRoles("Admin"), review("approve"));
router.post("/:id/reject", verifyToken, allowRoles("Admin"), review("reject"));

module.exports = router;
