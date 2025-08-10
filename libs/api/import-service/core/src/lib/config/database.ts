import { Sequelize, Options } from 'sequelize';
import { logger } from '../utils/logger';

// Database configuration interface
export interface DatabaseConfig {
  dialect: 'sqlite' | 'postgres' | 'mysql' | 'mariadb' | 'mssql';
  storage?: string;
  host?: string;
  port?: number;
  database?: string;
  username?: string;
  password?: string;
  logging?: boolean | ((sql: string, timing?: number) => void);
  pool?: {
    max?: number;
    min?: number;
    acquire?: number;
    idle?: number;
  };
}

// Default configuration for SQLite
const defaultConfig: DatabaseConfig = {
  dialect: 'sqlite',
  storage: process.env['DATABASE_PATH'] || 'database.db',
  logging: (msg: string) => logger.db(msg),
};

// Get database configuration from environment or use defaults
export function getDatabaseConfig(): DatabaseConfig {
  const config: DatabaseConfig = { ...defaultConfig };

  // Check if we should use a different database
  if (process.env['DATABASE_URL']) {
    // Parse DATABASE_URL for PostgreSQL/MySQL
    const url = new URL(process.env['DATABASE_URL']);
    config.dialect = url.protocol.replace(':', '') as any;
    config.host = url.hostname;
    config.port = parseInt(url.port) || undefined;
    config.database = url.pathname.substring(1);
    config.username = url.username;
    config.password = url.password;
  }

  // Override with individual environment variables if set
  if (process.env['DB_DIALECT']) {
    config.dialect = process.env['DB_DIALECT'] as any;
  }
  if (process.env['DB_HOST']) {
    config.host = process.env['DB_HOST'];
  }
  if (process.env['DB_PORT']) {
    config.port = parseInt(process.env['DB_PORT']);
  }
  if (process.env['DB_NAME']) {
    config.database = process.env['DB_NAME'];
  }
  if (process.env['DB_USER']) {
    config.username = process.env['DB_USER'];
  }
  if (process.env['DB_PASS']) {
    config.password = process.env['DB_PASS'];
  }

  // Configure logging
  if (process.env['DB_LOGGING'] === 'false') {
    config.logging = false;
  }

  return config;
}

// Create Sequelize instance
export function createSequelize(config?: DatabaseConfig): Sequelize {
  const dbConfig = config || getDatabaseConfig();
  
  logger.info(`Initializing Sequelize with ${dbConfig.dialect} database...`);

  const sequelizeOptions: Options = {
    dialect: dbConfig.dialect,
    logging: dbConfig.logging,
  };

  // Add SQLite-specific options
  if (dbConfig.dialect === 'sqlite' && dbConfig.storage) {
    sequelizeOptions.storage = dbConfig.storage;
  }

  // Add connection options for other databases
  if (dbConfig.dialect !== 'sqlite') {
    if (dbConfig.host) sequelizeOptions.host = dbConfig.host;
    if (dbConfig.port) sequelizeOptions.port = dbConfig.port;
    if (dbConfig.database) sequelizeOptions.database = dbConfig.database;
    if (dbConfig.username) sequelizeOptions.username = dbConfig.username;
    if (dbConfig.password) sequelizeOptions.password = dbConfig.password;
    
    // Connection pool configuration
    sequelizeOptions.pool = dbConfig.pool || {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000,
    };
  }

  return new Sequelize(sequelizeOptions);
}

// Default Sequelize instance
export const sequelize = createSequelize();

// Function to test database connection
export async function testConnection(seq?: Sequelize): Promise<boolean> {
  const dbInstance = seq || sequelize;
  
  try {
    await dbInstance.authenticate();
    logger.info('Database connection established successfully.');
    return true;
  } catch (error) {
    logger.error('Unable to connect to the database:', error);
    return false;
  }
}

// Function to sync database models
export async function syncDatabase(seq?: Sequelize, force = false): Promise<void> {
  const dbInstance = seq || sequelize;
  
  try {
    logger.info(`Syncing database models${force ? ' (force)' : ''}...`);
    await dbInstance.sync({ force });
    logger.info('Database models synced successfully.');
  } catch (error) {
    logger.error('Error syncing database models:', error);
    throw error;
  }
}

// Function to close database connection
export async function closeConnection(seq?: Sequelize): Promise<void> {
  const dbInstance = seq || sequelize;
  
  try {
    await dbInstance.close();
    logger.info('Database connection closed.');
  } catch (error) {
    logger.error('Error closing database connection:', error);
    throw error;
  }
}