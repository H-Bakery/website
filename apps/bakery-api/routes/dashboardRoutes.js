const express = require("express");
const router = express.Router();
const dashboardController = require("../controllers/dashboardController");
const { authenticate } = require("../middleware/authMiddleware");

// Dashboard analytics routes (all protected)
router.get("/sales-summary", authenticate, dashboardController.getSalesSummary);
router.get("/production-overview", authenticate, dashboardController.getProductionOverview);
router.get("/revenue-analytics", authenticate, dashboardController.getRevenueAnalytics);
router.get("/order-analytics", authenticate, dashboardController.getOrderAnalytics);
router.get("/product-performance", authenticate, dashboardController.getProductPerformance);
router.get("/daily-metrics", authenticate, dashboardController.getDailyMetrics);

module.exports = router;