// Database connection exports
export { sequelize, testConnection, syncDatabase } from './lib/connection';

// Migration runner exports
export {
  runMigrations,
  checkMigrationStatus,
  initializeDatabase,
  runMigrationsDirectly
} from './lib/migration-runner';

// Logger export for backward compatibility
export { logger } from './lib/logger';