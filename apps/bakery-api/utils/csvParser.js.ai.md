# CSV Parser Utility - AI Context

This file provides CSV parsing functionality for the bakery application. It's primarily used to convert product data from CSV format to JavaScript objects that can be imported into the database.

## Key Features

- Reads and parses CSV files from the filesystem
- Handles quoted values properly to account for commas within strings
- Maps CSV headers to object properties
- Provides detailed error logging
- Processes the CSV data line by line for memory efficiency

## Main Function: parseCSV

The `parseCSV` function takes a file path as input and returns an array of JavaScript objects where:
- Each object represents one row from the CSV
- Object keys correspond to the CSV headers
- Object values are properly parsed and cleaned from quotes

## CSV Format Expectations

The parser expects a CSV with:
- Headers in the first row
- Values that may be quoted (especially those containing commas)
- Standard CSV format with comma separators

## Error Handling

The utility includes comprehensive error handling that:
- Logs detailed error information
- Throws errors to allow calling code to handle failures appropriately
- Validates the CSV format

## Usage in the Project

This utility is primarily used by:
1. The `productSeeder.js` to import product data from `content/products/products.csv`
2. The `test-csv.js` script that verifies the CSV parsing functionality

## Implementation Details

The parser uses a careful character-by-character approach to handle CSV complexities like:
- Quoted fields that contain commas
- Proper handling of quote characters within fields
- Trimming whitespace from field values

This character-by-character approach is more reliable than simple string splitting for complex CSV data.