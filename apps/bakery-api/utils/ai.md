# Bakery Backend Utils Directory

This directory contains utility functions and helpers used throughout the backend application.

## Files in this Directory

- `logger.js` - Logging utility for consistent log formatting across the application
- `csvParser.js` - CSV parsing utility for importing product data from CSV files

## CSV Parser

The `csvParser.js` file provides functionality to:
- Read CSV files from the filesystem
- Parse CSV data into JavaScript objects
- Handle quoted fields and special characters properly
- Map CSV headers to object properties

This utility is primarily used by the product seeder to import product data from the CSV file located at `content/products/products.csv`.

## Logger

The `logger.js` file provides:
- Consistent log formatting
- Different log levels (info, error, warn, debug)
- Database query logging functionality

## Usage Example

```javascript
const { parseCSV } = require('./utils/csvParser');
const logger = require('./utils/logger');

// Parse CSV file
const products = parseCSV('path/to/file.csv');

// Log results
logger.info(`Successfully parsed ${products.length} products`);
```

## Code Style

- No semicolons
- Functional programming approach
- Thorough error handling
- Clear documentation