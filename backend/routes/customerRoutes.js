const express = require("express");
const jwt = require("jsonwebtoken");

const {
  registerCustomer,
  loginCustomer,
  getCustomerProfile,
  getPointHistory,
  getCustomerByPhone,
  getDiscountedProducts,
  getCustomerProducts,
  getCustomerStores,
} = require("../controllers/customerController");

const {
  verifyToken,
} = require("../middleware/authMiddleware");

const router = express.Router();

// ========================================
// Customer JWT middleware
// ========================================

const verifyCustomerToken = (
  req,
  res,
  next
) => {
  const authHeader =
    req.headers.authorization;

  if (
    !authHeader ||
    !authHeader.startsWith("Bearer ")
  ) {
    return res.status(401).json({
      success: false,
      message: "Customer login is required.",
    });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET
    );

    if (
      decoded.account_type !== "customer"
    ) {
      return res.status(403).json({
        success: false,
        message:
          "Invalid customer account token.",
      });
    }

    req.customer = decoded;

    return next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message:
        "Customer session is invalid or expired.",
    });
  }
};

// ========================================
// Public customer routes
// ========================================

router.post(
  "/register",
  registerCustomer
);

router.post(
  "/login",
  loginCustomer
);

// ========================================
// Logged-in customer routes
// Important: specific routes first
// ========================================

router.get(
  "/products/discounted",
  verifyCustomerToken,
  getDiscountedProducts
);

router.get(
  "/products",
  verifyCustomerToken,
  getCustomerProducts
);

router.get(
  "/stores",
  verifyCustomerToken,
  getCustomerStores
);

router.get(
  "/points/history",
  verifyCustomerToken,
  getPointHistory
);

router.get(
  "/me",
  verifyCustomerToken,
  getCustomerProfile
);

// ========================================
// Staff POS customer lookup
// Dynamic route should stay near the end
// ========================================

router.get(
  "/by-phone/:phone",
  verifyToken,
  getCustomerByPhone
);

module.exports = router;