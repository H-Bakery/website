/**
 * Dashboard domain library exports
 */

// Models and types
export * from './lib/models/dashboard.model';

// Services
export { dashboardService } from './lib/services/dashboard.service';

// Controllers
export { dashboardController } from './lib/controllers/dashboard.controller';

// Routes
export { createDashboardRoutes, dashboardRoutes } from './lib/routes/dashboard.routes';