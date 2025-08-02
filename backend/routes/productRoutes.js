const express = require("express");
const router = express.Router();
const productController = require("../controllers/productController");

// Product routes
router.get("/", productController.getProducts);
router.get("/:id", productController.getProduct);
// Add more routes as needed

module.exports = router;
