const { exec } = require('child_process');
const path = require('path');
const logger = require('../utils/logger');

/**
 * Run database migrations
 * @param {string} environment - The environment to run migrations for
 * @returns {Promise<boolean>} - Success status
 */
async function runMigrations(environment = 'development') {
  return new Promise((resolve, reject) => {
    const env = process.env.NODE_ENV || environment;
    logger.info(`Running database migrations for environment: ${env}`);
    
    const migrationCommand = `npx sequelize-cli db:migrate --env ${env}`;
    
    exec(migrationCommand, { 
      cwd: path.resolve(__dirname, '..'),
      env: { ...process.env, NODE_ENV: env }
    }, (error, stdout, stderr) => {
      if (error) {
        logger.error('Migration failed:', error);
        logger.error('Migration stderr:', stderr);
        reject(error);
        return;
      }
      
      logger.info('Migration output:', stdout);
      logger.info('Database migrations completed successfully');
      resolve(true);
    });
  });
}

/**
 * Check migration status
 * @param {string} environment - The environment to check
 * @returns {Promise<string>} - Migration status output
 */
async function checkMigrationStatus(environment = 'development') {
  return new Promise((resolve, reject) => {
    const env = process.env.NODE_ENV || environment;
    const statusCommand = `npx sequelize-cli db:migrate:status --env ${env}`;
    
    exec(statusCommand, { 
      cwd: path.resolve(__dirname, '..'),
      env: { ...process.env, NODE_ENV: env }
    }, (error, stdout, stderr) => {
      if (error) {
        logger.error('Migration status check failed:', error);
        reject(error);
        return;
      }
      
      resolve(stdout);
    });
  });
}

/**
 * Initialize database with migrations
 * This replaces the sequelize.sync() approach
 */
async function initializeDatabase() {
  try {
    const environment = process.env.NODE_ENV || 'development';
    
    // Check current migration status
    try {
      const status = await checkMigrationStatus(environment);
      logger.info('Current migration status:', status);
    } catch (error) {
      logger.warn('Could not check migration status (this is normal for first run)');
    }
    
    // Run migrations
    await runMigrations(environment);
    
    logger.info('Database initialization completed successfully');
    return true;
  } catch (error) {
    logger.error('Database initialization failed:', error);
    throw error;
  }
}

/**
 * Alternative: Use direct Sequelize migration runner (for production environments)
 */
async function runMigrationsDirectly() {
  try {
    const { Sequelize } = require('sequelize');
    const { Umzug, SequelizeStorage } = require('umzug');
    const { sequelize } = require('./database');
    
    const umzug = new Umzug({
      migrations: {
        glob: path.join(__dirname, '../migrations/*.js'),
        resolve: ({ name, path: migrationPath }) => {
          const migration = require(migrationPath);
          return {
            name,
            up: async () => migration.up(sequelize.getQueryInterface(), Sequelize),
            down: async () => migration.down(sequelize.getQueryInterface(), Sequelize),
          };
        },
      },
      context: sequelize.getQueryInterface(),
      storage: new SequelizeStorage({ sequelize }),
      logger: console,
    });
    
    logger.info('Running migrations using Umzug...');
    await umzug.up();
    logger.info('All migrations executed successfully');
    
    return true;
  } catch (error) {
    logger.error('Direct migration execution failed:', error);
    throw error;
  }
}

module.exports = {
  runMigrations,
  checkMigrationStatus,
  initializeDatabase,
  runMigrationsDirectly
};