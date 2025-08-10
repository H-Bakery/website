# Bakery Backend Seeders Directory

This directory contains database seeders for the bakery application. Seeders are responsible for populating the database with initial data when the application first starts or when the database is reset.

## Key Seeders

- `productSeeder.js` - Populates the Products table with data from `content/products/products.csv`

## Product Seeder

The Product Seeder has been recently updated to:

1. Read product data from a CSV file located at `content/products/products.csv`
2. Parse the CSV data using the new `csvParser.js` utility in the utils directory
3. Transform the data to match the Product model structure
4. Insert the processed data into the database using Sequelize's bulkCreate

## How Seeders Work

Seeders are executed during application startup in `index.js`. They check if data already exists in the table, and only populate it if the table is empty. This prevents duplicate data when restarting the application.

## CSV Data Structure

The product CSV file contains the following fields:
- `id` - Product identifier
- `name` - Product name
- `category` - Product category (e.g., Brot, Brötchen, Kuchen)
- `image` - Path to the product image file
- `price` - Product price in EUR

## Usage

Seeders are automatically run when the application starts. To manually trigger a seeder:

```javascript
const productSeeder = require('./seeders/productSeeder');
await productSeeder.seed();
```

## Related Files

- `utils/csvParser.js` - Parses the CSV product data
- `models/Product.js` - The database model the seeder populates
- `test-csv.js` - Test script for verifying CSV parsing functionality