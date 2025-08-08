/**
 * Products library exports
 */

// Models
export * from './lib/models/product.model';

// Services
export * from './lib/services/product.service';

// Controllers
export * from './lib/controllers/product.controller';

// Routes
export { default as productRoutes, createProductRoutes, AuthMiddleware } from './lib/routes/product.routes';