const express = require("express");
const router = express.Router();
const { getUsers, addUser, deleteUser } = require("../controllers/userController");

// GET /api/users
router.get("/", getUsers);

// POST /api/users/add
router.post("/add", addUser);

// DELETE /api/users/:id
router.delete("/:id", deleteUser);

module.exports = router;
