# Bakery Backend Config Directory

This directory contains configuration files for the bakery application backend.

## Key Files

- `database.js` - Database configuration for Sequelize ORM (using SQLite)

## Database Configuration

The `database.js` file includes:
- Sequelize initialization with SQLite dialect
- Configuration for database path (`database.db` in project root)
- SQL query logging setup through the custom logger
- Database connection testing function (`testConnection`)

## Usage

The database configuration is imported by:
- `models/index.js` to initialize database models
- `index.js` to test the database connection during application startup

## Example

```javascript
const { sequelize, testConnection } = require('./config/database');

// Test database connection
testConnection().then(connected => {
  if (connected) {
    console.log('Database connected successfully');
  } else {
    console.error('Failed to connect to database');
  }
});
```

## Environment Variables

Database configuration can be modified using environment variables:
- No environment variables are currently used, but future updates may add support for:
  - Custom database path
  - Alternative database dialects (MySQL, PostgreSQL)
  - Connection pooling settings

The config directory could be expanded in the future to include other configuration files such as:
- Email settings
- External API connections
- Feature flags
- Environment-specific configurations