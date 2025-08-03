// Export routes
export { importRoutes } from './lib/routes/import.routes';

// Export service for initialization
export { importService } from './lib/services/import.service';

// Export controller if needed for testing
export { importController } from './lib/controllers/import.controller';

// Export validators
export { validateDailyReport, validateDailyReports } from './lib/validators/report.validator';

// Export types
export type { ImportResult, BulkImportResult } from './lib/services/import.service';
