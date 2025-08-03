import { Router } from 'express';
import { SalesAnalyticsController } from '../controllers/sales-analytics.controller';
import { authenticate } from '@bakery/api/core';
import { 
  dateRangeValidationRules,
  revenueTrendsValidationRules,
  productPerformanceValidationRules,
  cashierPerformanceValidationRules,
  handleValidationErrors
} from '../validators/sales-analytics.validator';

const router = Router();

/**
 * Sales Analytics Routes
 * All routes are protected with authentication
 */

// Revenue trends with granularity support
router.get(
  '/revenue-trends',
  authenticate,
  revenueTrendsValidationRules(),
  handleValidationErrors,
  SalesAnalyticsController.getRevenueTrends
);

// Product performance analysis (top/bottom performers)
router.get(
  '/product-performance',
  authenticate,
  productPerformanceValidationRules(),
  handleValidationErrors,
  SalesAnalyticsController.getProductPerformance
);

// Cashier/user performance analytics
router.get(
  '/cashier-performance',
  authenticate,
  cashierPerformanceValidationRules(),
  handleValidationErrors,
  SalesAnalyticsController.getCashierPerformance
);

// Payment method breakdown
router.get(
  '/payment-methods',
  authenticate,
  dateRangeValidationRules(),
  handleValidationErrors,
  SalesAnalyticsController.getPaymentMethods
);

// High-level dashboard summary
router.get(
  '/summary',
  authenticate,
  dateRangeValidationRules(),
  handleValidationErrors,
  SalesAnalyticsController.getSummary
);

export default router;