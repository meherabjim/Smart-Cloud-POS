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
  getAllCustomersAdmin,
  getStoreProducts,
  getMyPurchases,
} = require("../controllers/customerController");

const { customerAiChat } = require("../controllers/customerAiController");

const {
  verifyToken,
  allowRoles,
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

// Max 10 login tries per 15 min for the same phone/email + IP
const loginTries = new Map();
const limitLogin = (req, res, next) => {
  const ip = String(req.headers["x-forwarded-for"] || req.ip || "").split(",")[0].trim();
  const key = `${ip}|${String(req.body?.phone || req.body?.email || "").trim().toLowerCase()}`;
  const now = Date.now();
  const t = loginTries.get(key);
  if (!t || now - t.start > 15 * 60 * 1000) {
    loginTries.set(key, { start: now, count: 1 });
    return next();
  }
  t.count += 1;
  if (t.count > 10) {
    return res.status(429).json({ success: false, message: "Too many login attempts. Try again after 15 minutes." });
  }
  return next();
};

router.post(
  "/login",
  limitLogin,
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

router.get("/stores/:id/products", verifyCustomerToken, getStoreProducts);
router.get("/purchases", verifyCustomerToken, getMyPurchases);
router.post("/ai/chat", verifyCustomerToken, customerAiChat);

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
// ADMIN ONLY: all customers list
// ========================================

router.get(
  "/admin/all",
  verifyToken,
  allowRoles("Admin"),
  getAllCustomersAdmin
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