# Test CSV Script - AI Context

This is a test utility script for validating the CSV parser functionality. The script is designed to:

1. Read the bakery product CSV file from `content/products/products.csv`
2. Parse the CSV data into JavaScript objects
3. Log the first 3 products to verify the parsing is correct
4. Demonstrate the transformation process applied to products before database insertion

## Key Functions

The script showcases how the `csvParser` utility is used to:
- Import CSV data
- Process and transform the data before database insertion
- Apply default values for fields not present in the CSV

## Usage

Run this script with:
```
node test-csv.js
```
or
```
npm run test:csv
```

## Related Files

- `utils/csvParser.js` - The CSV parsing utility being tested
- `seeders/productSeeder.js` - Uses the same CSV parsing approach
- `models/Product.js` - The data model that receives the transformed data

This script helps verify that the CSV parser works correctly before using it in the actual product seeder.