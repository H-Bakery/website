# CSV Product Import

## Overview
The bakery backend now includes functionality to import product data from a CSV file located in the `content/products/products.csv` path. This feature automatically populates the database with product information during application startup if no products exist in the database.

## Implementation Details

### Key Files Added/Modified

1. **New Utility File**: `utils/csvParser.js`
   - Provides CSV parsing functionality
   - Handles quoted CSV values properly
   - Returns array of JSON objects from CSV data

2. **Updated Product Model**: `models/product.js`
   - Added `image` field to store product image paths
   - Added `category` field to store product category

3. **Updated Product Seeder**: `seeders/productSeeder.js`
   - Now reads data from CSV file instead of hardcoded values
   - Maps CSV fields to database model fields
   - Sets default values for fields not present in CSV (stock, dailyTarget)

4. **Updated Product Controller**: `controllers/productController.js`
   - Modified to include new fields in API responses

## CSV File Format

The expected format for `products.csv` is:
```
id,name,category,image,price
1,"Product Name",Category,"/path/to/image.jpg",2.50
```

## Running the Import

The product import happens automatically when the application starts if the product table is empty. The import process follows these steps:

1. Application starts and connects to the database
2. Database tables are synced
3. Product seeder checks if products exist in the database
4. If no products exist, the seeder reads and parses the CSV file
5. CSV data is transformed to match the database schema
6. Products are created in the database via `bulkCreate`

## Testing CSV Parsing

A test script has been added to verify the CSV parsing functionality:

```bash
npm run test:csv
```

This script:
- Reads the CSV file
- Parses it into JSON objects
- Displays the first 3 products for verification
- Shows how the data is transformed for database insertion

## Troubleshooting

- If products aren't being imported, check that the CSV file exists at `content/products/products.csv`
- Verify CSV format matches the expected structure
- Check logs for any parsing errors
- Make sure the database connection is working properly