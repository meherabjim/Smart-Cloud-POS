const express = require("express");
const router = express.Router();

const {
  getSuppliers,
  addSupplier,
  addDue,
  addPayment,
  getTransactions,
  deleteSupplier,
} = require("../controllers/supplierController");

const {
  verifyToken,
  allowRoles,
  blockViewerWrites,
} = require("../middleware/authMiddleware");

router.get("/", verifyToken, allowRoles("Admin", "Manager", "Viewer"), getSuppliers);
router.get("/:id/transactions", verifyToken, allowRoles("Admin", "Manager", "Viewer"), getTransactions);

router.post("/", verifyToken, allowRoles("Admin", "Manager"), blockViewerWrites, addSupplier);
router.post("/:id/due", verifyToken, allowRoles("Admin", "Manager"), blockViewerWrites, addDue);
router.post("/:id/payment", verifyToken, allowRoles("Admin", "Manager"), blockViewerWrites, addPayment);

router.delete("/:id", verifyToken, allowRoles("Admin"), deleteSupplier);

module.exports = router;