const express = require("express");
const router = express.Router();
const productController = require("../controllers/productController");
const { verifyToken } = require("../middleware/authMiddleware");

router.get("/", verifyToken, productController.getProducts);
router.post("/", verifyToken, productController.addProduct);
router.put("/:id", verifyToken, productController.updateProduct);
router.put("/:id/price", verifyToken, productController.updatePrice);
router.put("/:id/stock", verifyToken, productController.updateStock);
router.delete("/:id", verifyToken, productController.deleteProduct);

module.exports = router;