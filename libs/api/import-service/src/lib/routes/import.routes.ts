import { Router } from 'express';
import { importController } from '../controllers/import.controller';

const router = Router();

// Note: Authentication middleware should be added in the main app
// when these routes are mounted. For example:
// app.use('/api/import', authenticate, requireAdmin, importRoutes);

/**
 * Import a single sales report
 * @route POST /api/import/sales-report
 * @body {DailyReport} report - The daily sales report to import
 * @returns {ImportResult} Import result with counts
 */
router.post('/sales-report', importController.importSalesReport);

/**
 * Import multiple sales reports (bulk)
 * @route POST /api/import/sales-reports/bulk
 * @body {reports: DailyReport[]} - Array of reports to import
 * @returns {BulkImportResult} Bulk import results
 */
router.post('/sales-reports/bulk', importController.importSalesReportsBulk);

/**
 * Check if a report has been imported
 * @route GET /api/import/status/:date
 * @param {string} date - Date in YYYY-MM-DD format
 * @returns {object} Import status for the date
 */
router.get('/status/:date', importController.checkImportStatus);

export const importRoutes = router;