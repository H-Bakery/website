import * as fs from 'fs';
import * as path from 'path';
import { logger } from './logger';

/**
 * Parses a CSV file and returns an array of objects
 * @param filePath - Path to the CSV file
 * @returns Array of objects where each object represents a row in the CSV
 */
export function parseCSV<T extends Record<string, string> = Record<string, string>>(
  filePath: string
): T[] {
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
    const result: T[] = [];
    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue; // Skip empty lines
      
      const values: string[] = [];
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
      const obj: Record<string, string> = {};
      for (let j = 0; j < headers.length; j++) {
        // Remove quotes if they exist
        if (values[j]) {
          obj[headers[j]] = values[j].replace(/^"/, '').replace(/"$/, '').trim();
        } else {
          obj[headers[j]] = '';
        }
      }
      
      result.push(obj as T);
    }
    
    logger.info(`Successfully parsed CSV file: ${filePath}, found ${result.length} entries`);
    return result;
  } catch (error) {
    logger.error(`Error parsing CSV file: ${filePath}`, error);
    throw error;
  }
}

/**
 * Writes an array of objects to a CSV file
 * @param filePath - Path where the CSV file will be written
 * @param data - Array of objects to write
 * @param headers - Optional array of headers. If not provided, will use object keys from first item
 */
export function writeCSV<T extends Record<string, any>>(
  filePath: string,
  data: T[],
  headers?: string[]
): void {
  try {
    if (data.length === 0) {
      fs.writeFileSync(filePath, '');
      logger.info(`Written empty CSV file: ${filePath}`);
      return;
    }

    // Use provided headers or extract from first object
    const csvHeaders = headers || Object.keys(data[0]);
    
    // Create CSV content
    const lines: string[] = [];
    
    // Add header row
    lines.push(csvHeaders.map(h => `"${h}"`).join(','));
    
    // Add data rows
    for (const item of data) {
      const values = csvHeaders.map(header => {
        const value = item[header];
        // Handle different types
        if (value === null || value === undefined) {
          return '';
        }
        // Escape quotes and wrap in quotes if contains comma or quote
        const stringValue = String(value);
        if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
          return `"${stringValue.replace(/"/g, '""')}"`;
        }
        return stringValue;
      });
      lines.push(values.join(','));
    }
    
    // Write to file
    fs.writeFileSync(filePath, lines.join('\n'));
    logger.info(`Successfully wrote CSV file: ${filePath}, ${data.length} entries`);
  } catch (error) {
    logger.error(`Error writing CSV file: ${filePath}`, error);
    throw error;
  }
}

/**
 * Parses a CSV string and returns an array of objects
 * @param csvString - CSV content as string
 * @returns Array of objects where each object represents a row in the CSV
 */
export function parseCSVString<T extends Record<string, string> = Record<string, string>>(
  csvString: string
): T[] {
  try {
    // Split the content by new line
    const lines = csvString.split('\n');
    
    if (lines.length === 0) {
      return [];
    }
    
    // Extract headers
    const headers = lines[0].split(',').map(header => {
      // Remove quotes if they exist
      return header.replace(/^"/, '').replace(/"$/, '').trim();
    });
    
    // Parse data rows
    const result: T[] = [];
    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue; // Skip empty lines
      
      const values: string[] = [];
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
      const obj: Record<string, string> = {};
      for (let j = 0; j < headers.length; j++) {
        // Remove quotes if they exist
        if (values[j]) {
          obj[headers[j]] = values[j].replace(/^"/, '').replace(/"$/, '').trim();
        } else {
          obj[headers[j]] = '';
        }
      }
      
      result.push(obj as T);
    }
    
    return result;
  } catch (error) {
    logger.error('Error parsing CSV string', error);
    throw error;
  }
}