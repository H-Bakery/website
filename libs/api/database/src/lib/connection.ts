import { Sequelize } from 'sequelize';
import { logger } from './logger';

logger.info('Initializing Sequelize with SQLite database...');

// Initialize Sequelize with SQLite
export const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: 'database.db',
  logging: (msg) => logger.db(`${msg}`), // Log SQL queries
});

// Function to test database connection
export const testConnection = async (): Promise<boolean> => {
  try {
    await sequelize.authenticate();
    logger.info('Database connection established successfully.');
    return true;
  } catch (error) {
    logger.error('Unable to connect to the database:', error);
    return false;
  }
};

// Function to sync database (for backward compatibility)
export const syncDatabase = async (): Promise<void> => {
  try {
    // Use environment variable to determine initialization method
    const useMigrations = process.env['USE_MIGRATIONS'] !== 'false';
    
    if (useMigrations && process.env['NODE_ENV'] !== 'test') {
      // Use migrations in production and development
      logger.info('Using migrations for database initialization...');
      const { initializeDatabase } = await import('./migration-runner');
      await initializeDatabase();
    } else {
      // Use sync for tests or when migrations are disabled
      logger.info('Using sequelize.sync() for database initialization...');
      await sequelize.sync();
      logger.info('Database synchronized successfully with sync()');
    }
  } catch (error) {
    logger.error('Failed to sync database:', error);
    throw error;
  }
};