const jwt = require("jsonwebtoken");
const db = require("../config/db");

// Check whether the request contains a valid login token.
// Role, store and status are read fresh from the database on every request,
// so a changed role/store, a deleted or an inactive account takes effect at once.
const verifyToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      message: "Access denied. Please login first.",
    });
  }

  const token = authHeader.split(" ")[1];

  let decoded;

  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    return res.status(401).json({
      message: "Invalid or expired token.",
    });
  }

  // Customer tokens must never open staff APIs
  if (decoded.account_type === "customer" || !decoded.role) {
    return res.status(401).json({
      message: "Staff login required.",
    });
  }

  try {
    const [rows] = await db.query(
      "SELECT id, role, store_id, email, status FROM users WHERE id = ? LIMIT 1",
      [decoded.id]
    );

    if (rows.length === 0) {
      return res.status(401).json({
        message: "This account no longer exists. Please login again.",
      });
    }

    const user = rows[0];

    // The demo Viewer role has been removed
    if (user.role === "Viewer") {
      return res.status(403).json({
        message: "Viewer accounts are no longer supported.",
      });
    }

    if (user.status && user.status !== "Active") {
      return res.status(403).json({
        message: "This account is inactive. Contact the Admin.",
      });
    }

    req.user = {
      ...decoded,
      role: user.role,
      store_id: user.store_id,
      email: user.email,
    };

    return next();
  } catch (error) {
    console.error("Auth check error:", error);

    return res.status(500).json({
      message: "Could not verify your login. Try again.",
    });
  }
};

// Allow only selected roles
const allowRoles = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        message: "Unauthorized.",
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        message: "You do not have permission for this action.",
      });
    }

    next();
  };
};

// Viewer can view data but cannot create, edit or delete anything
const blockViewerWrites = (req, res, next) => {
  if (req.user?.role === "Viewer") {
    return res.status(403).json({
      message: "Demo Viewer has read-only access.",
    });
  }

  next();
};

module.exports = {
  verifyToken,
  allowRoles,
  blockViewerWrites,
};