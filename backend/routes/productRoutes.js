const express = require("express");

const router = express.Router();

const productController = require("../controllers/productController");

const {
  verifyToken,
  blockViewerWrites,
} = require("../middleware/authMiddleware");

// Viewer can see products
router.get(
  "/",
  verifyToken,
  productController.getProducts
);

// Viewer cannot add products
router.post(
  "/",
  verifyToken,
  blockViewerWrites,
  productController.addProduct
);

// Viewer cannot edit products
router.put(
  "/:id",
  verifyToken,
  blockViewerWrites,
  productController.updateProduct
);

// Viewer cannot change price
router.put(
  "/:id/price",
  verifyToken,
  blockViewerWrites,
  productController.updatePrice
);

// Viewer cannot change stock
router.put(
  "/:id/stock",
  verifyToken,
  blockViewerWrites,
  productController.updateStock
);

// Viewer cannot delete products
router.delete(
  "/:id",
  verifyToken,
  blockViewerWrites,
  productController.deleteProduct
);

module.exports = router;