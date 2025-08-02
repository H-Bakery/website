// bakery/backend/routes/bakingListRoutes.js
const express = require("express");
const router = express.Router();
const bakingListController = require("../controllers/bakingListController");

// Baking list route
router.get("/", bakingListController.getBakingList);

// Get Hefezopf orders
router.get("/production/hefezopf-orders", async (req, res) => {
  try {
    const { date } = req.query;

    // In a real implementation, query your database for orders
    // For now, return mock data
    const mockOrders = {
      "Hefezopf Plain": 15,
      "Hefekranz Nuss": 8,
      "Hefekranz Schoko": 12,
      "Hefekranz Pudding": 5,
      "Hefekranz Marzipan": 4,
      "Mini Hefezopf": 20,
      "Hefeschnecken Nuss": 30,
      "Hefeschnecken Schoko": 25,
    };

    res.json(mockOrders);
  } catch (error) {
    console.error("Error fetching hefezopf orders:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Save production plan
router.post("/production/plans", async (req, res) => {
  try {
    const { date, plan } = req.body;

    // In a real implementation, save to your database
    // For now, just acknowledge receipt

    res.json({
      success: true,
      message: "Production plan saved successfully",
      id: `plan-${Date.now()}`,
    });
  } catch (error) {
    console.error("Error saving production plan:", error);
    res.status(500).json({ error: "Failed to save production plan" });
  }
});

module.exports = router;
