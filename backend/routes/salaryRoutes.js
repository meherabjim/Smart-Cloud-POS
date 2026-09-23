const express = require("express");
const router = express.Router();

const {
  setUserSalary,
  getPreview,
  payAll,
  payOne,
  getHistory,
} = require("../controllers/salaryController");

const {
  verifyToken,
  allowRoles,
} = require("../middleware/authMiddleware");

// Salary is Admin-only. Manager has no access.
router.get("/preview", verifyToken, allowRoles("Admin"), getPreview);
router.get("/history", verifyToken, allowRoles("Admin"), getHistory);
router.put("/user/:id", verifyToken, allowRoles("Admin"), setUserSalary);
router.post("/pay-all", verifyToken, allowRoles("Admin"), payAll);
router.post("/pay/:userId", verifyToken, allowRoles("Admin"), payOne);

module.exports = router;