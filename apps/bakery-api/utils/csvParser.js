const fs = require('fs');
const path = require('path');
const logger = require('./logger');

/**
 * Parses a CSV file and returns an array of objects
 * @param {string} filePath - Path to the CSV file
 * @returns {Array} - Array of objects where each object represents a row in the CSV
 */
function parseCSV(filePath) {
  try {
    // Read file
    const data = fs.readFileSync(filePath, 'utf8');
    
    // Split the content by new line
    const lines = data.split('\n');
    
    // Extract headers
    const headers = lines[0].split(',').map(header => {
      // Remove quotes if they exist
      return header.replace(/^"/, '').replace(/"$/, '').trim();
    });
    
    // Parse data rows
    const result = [];
    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue; // Skip empty lines
      
      const values = [];
      let insideQuotes = false;
      let currentValue = '';
      
      // Parse CSV line character by character to handle quoted fields properly
      for (let j = 0; j < lines[i].length; j++) {
        const char = lines[i][j];
        
        if (char === '"') {
          insideQuotes = !insideQuotes;
        } else if (char === ',' && !insideQuotes) {
          values.push(currentValue);
          currentValue = '';
        } else {
          currentValue += char;
        }
      }
      
      // Add the last value
      values.push(currentValue);
      
      // Create object from headers and values
      const obj = {};
      for (let j = 0; j < headers.length; j++) {
        // Remove quotes if they exist
        if (values[j]) {
          obj[headers[j]] = values[j].replace(/^"/, '').replace(/"$/, '').trim();
        } else {
          obj[headers[j]] = '';
        }
      }
      
      result.push(obj);
    }
    
    logger.info(`Successfully parsed CSV file: ${filePath}, found ${result.length} entries`);
    return result;
  } catch (error) {
    logger.error(`Error parsing CSV file: ${filePath}`, error);
    throw error;
  }
}

module.exports = {
  parseCSV
};