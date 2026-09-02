import { Router } from 'express'
import { authMiddleware } from '@bakery/api/auth'
import { importController } from '../controllers/import.controller'

const router = Router()

// Der Import schreibt Umsatzdaten; ohne Token geht hier nichts. main.ts hängt
// den Router ohne eigene Middleware ein, deshalb prüft der Router selbst - mit
// derselben Middleware wie sales-analytics.routes.ts und main.ts (@bakery/api/auth,
// die auch die Tokens ausstellt). @bakery/api/core hat einen eigenen Default-Secret
// und eine andere Fehlerform; ein Login-Token würde dort ohne JWT_SECRET abgelehnt.
router.use(authMiddleware)

/**
 * Import a single sales report
 * @route POST /api/import/sales-report
 * @body {DailyReport} report - The daily sales report to import
 * @returns {ImportResult} Import result with counts
 */
router.post('/sales-report', importController.importSalesReport)

/**
 * Import multiple sales reports (bulk)
 * @route POST /api/import/sales-reports/bulk
 * @body {reports: DailyReport[]} - Array of reports to import
 * @returns {BulkImportResult} Bulk import results
 */
router.post('/sales-reports/bulk', importController.importSalesReportsBulk)

/**
 * Check if a report has been imported
 * @route GET /api/import/status/:date
 * @param {string} date - Date in YYYY-MM-DD format
 * @returns {object} Import status for the date
 */
router.get('/status/:date', importController.checkImportStatus)

export const importRoutes = router
