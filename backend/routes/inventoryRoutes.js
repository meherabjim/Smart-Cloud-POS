

const express = require("express");
const router = express.Router();
const { getInventoryHistory } = require("../controllers/inventoryController");


// GET /api/inventory-history
router.get("/", getInventoryHistory);


module.exports = router;