const express = require("express");


const router = express.Router();


const {
    checkout,
    getSales,
    getSaleDetails
} = require("../controllers/salesController");



// ==========================
// Complete Sale
// ==========================
router.post("/checkout", checkout);



// ==========================
// Sales History
// ==========================
router.get("/", getSales);



// ==========================
// Single Invoice
// ==========================
router.get("/:id", getSaleDetails);



module.exports = router;