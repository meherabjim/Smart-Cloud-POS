const jwt = require("jsonwebtoken");

// Check whether the request contains a valid login token
const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      message: "Access denied. Please login first.",
    });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({
      message: "Invalid or expired token.",
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