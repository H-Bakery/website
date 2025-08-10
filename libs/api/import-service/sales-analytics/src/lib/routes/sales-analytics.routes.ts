import { Router } from 'express';
import { SalesAnalyticsController } from '../controllers/sales-analytics.controller';
import { authMiddleware } from '@bakery/api/auth';
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
  authMiddleware,
  revenueTrendsValidationRules(),
  handleValidationErrors,
  SalesAnalyticsController.getRevenueTrends
);

// Product performance analysis (top/bottom performers)
router.get(
  '/product-performance',
  authMiddleware,
  productPerformanceValidationRules(),
  handleValidationErrors,
  SalesAnalyticsController.getProductPerformance
);

// Cashier/user performance analytics
router.get(
  '/cashier-performance',
  authMiddleware,
  cashierPerformanceValidationRules(),
  handleValidationErrors,
  SalesAnalyticsController.getCashierPerformance
);

// Payment method breakdown
router.get(
  '/payment-methods',
  authMiddleware,
  dateRangeValidationRules(),
  handleValidationErrors,
  SalesAnalyticsController.getPaymentMethods
);

// High-level dashboard summary
router.get(
  '/summary',
  authMiddleware,
  dateRangeValidationRules(),
  handleValidationErrors,
  SalesAnalyticsController.getSummary
);

export default router;