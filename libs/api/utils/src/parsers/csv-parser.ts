/**
 * CSV Parser Utility - Parse CSV files into objects
 * Bakery Management System
 */

import * as fs from 'fs';
import { logger } from '../logger/logger';

export interface CSVParseOptions {
  delimiter?: string;
  quote?: string;
  escape?: string;
  skipEmptyLines?: boolean;
  trim?: boolean;
  headers?: boolean;
  encoding?: BufferEncoding;
}

export interface CSVParseResult<T = any> {
  data: T[];
  headers: string[];
  rowCount: number;
}

export class CSVParser {
  private defaultOptions: CSVParseOptions = {
    delimiter: ',',
    quote: '"',
    escape: '"',
    skipEmptyLines: true,
    trim: true,
    headers: true,
    encoding: 'utf8',
  };

  /**
   * Parse CSV file and return array of objects
   */
  async parseFile<T = any>(
    filePath: string,
    options?: CSVParseOptions
  ): Promise<CSVParseResult<T>> {
    try {
      const content = await fs.promises.readFile(filePath, options?.encoding || 'utf8');
      return this.parseString<T>(content, options);
    } catch (error) {
      logger.error(`Error reading CSV file: ${filePath}`, error);
      throw new Error(`Failed to parse CSV file: ${filePath}`);
    }
  }

  /**
   * Parse CSV file synchronously
   */
  parseFileSync<T = any>(filePath: string, options?: CSVParseOptions): CSVParseResult<T> {
    try {
      const content = fs.readFileSync(filePath, options?.encoding || 'utf8');
      return this.parseString<T>(content, options);
    } catch (error) {
      logger.error(`Error reading CSV file: ${filePath}`, error);
      throw new Error(`Failed to parse CSV file: ${filePath}`);
    }
  }

  /**
   * Parse CSV string and return array of objects
   */
  parseString<T = any>(content: string, options?: CSVParseOptions): CSVParseResult<T> {
    const opts = { ...this.defaultOptions, ...options };
    const lines = content.split(/\r?\n/);
    const headers: string[] = [];
    const data: T[] = [];
    let rowCount = 0;

    // Parse headers if enabled
    let startIndex = 0;
    if (opts.headers && lines.length > 0) {
      const headerLine = lines[0];
      const parsedHeaders = this.parseLine(headerLine, opts);
      headers.push(...parsedHeaders.map((h) => (opts.trim ? h.trim() : h)));
      startIndex = 1;
    }

    // Parse data rows
    for (let i = startIndex; i < lines.length; i++) {
      const line = lines[i];

      // Skip empty lines if configured
      if (opts.skipEmptyLines && !line.trim()) {
        continue;
      }

      const values = this.parseLine(line, opts);
      rowCount++;

      if (opts.headers && headers.length > 0) {
        // Create object from headers and values
        const obj: any = {};
        for (let j = 0; j < headers.length; j++) {
          const value = values[j] || '';
          obj[headers[j]] = opts.trim ? value.trim() : value;
        }
        data.push(obj as T);
      } else {
        // Return as array of arrays
        data.push(values as any);
      }
    }

    logger.info(`Successfully parsed CSV: ${rowCount} rows, ${headers.length} columns`);

    return {
      data,
      headers,
      rowCount,
    };
  }

  /**
   * Parse a single CSV line
   */
  private parseLine(line: string, options: CSVParseOptions): string[] {
    const { delimiter = ',', quote = '"', escape = '"' } = options;
    const values: string[] = [];
    let current = '';
    let inQuotes = false;
    let i = 0;

    while (i < line.length) {
      const char = line[i];
      const nextChar = line[i + 1];

      if (inQuotes) {
        if (char === quote) {
          if (nextChar === quote && escape === quote) {
            // Escaped quote
            current += quote;
            i++; // Skip next quote
          } else {
            // End of quoted field
            inQuotes = false;
          }
        } else if (char === escape && nextChar === quote) {
          // Escaped quote using different escape character
          current += quote;
          i++; // Skip next quote
        } else {
          current += char;
        }
      } else {
        if (char === quote) {
          // Start of quoted field
          inQuotes = true;
        } else if (char === delimiter) {
          // End of field
          values.push(current);
          current = '';
        } else {
          current += char;
        }
      }

      i++;
    }

    // Add the last field
    values.push(current);

    return values;
  }

  /**
   * Convert objects to CSV string
   */
  stringify<T extends Record<string, any>>(
    data: T[],
    options?: CSVParseOptions & { headers?: string[] | boolean }
  ): string {
    const opts = { ...this.defaultOptions, ...options };
    const lines: string[] = [];

    if (data.length === 0) {
      return '';
    }

    // Determine headers
    let headers: string[] = [];
    if (opts.headers === true) {
      headers = Object.keys(data[0]);
    } else if (Array.isArray(opts.headers)) {
      headers = opts.headers;
    }

    // Add header row
    if (headers.length > 0) {
      lines.push(this.stringifyRow(headers, opts));
    }

    // Add data rows
    for (const row of data) {
      if (headers.length > 0) {
        const values = headers.map((h) => String(row[h] || ''));
        lines.push(this.stringifyRow(values, opts));
      } else if (Array.isArray(row)) {
        lines.push(this.stringifyRow(row.map(String), opts));
      }
    }

    return lines.join('\n');
  }

  /**
   * Convert array of values to CSV row
   */
  private stringifyRow(values: string[], options: CSVParseOptions): string {
    const { delimiter = ',', quote = '"', escape = '"' } = options;

    return values
      .map((value) => {
        // Check if value needs quoting
        if (
          value.includes(delimiter) ||
          value.includes(quote) ||
          value.includes('\n') ||
          value.includes('\r')
        ) {
          // Escape quotes in the value
          const escaped = value.replace(new RegExp(quote, 'g'), escape + quote);
          return `${quote}${escaped}${quote}`;
        }
        return value;
      })
      .join(delimiter);
  }
}

// Create singleton instance
export const csvParser = new CSVParser();

// Export convenience functions
export const parseCSV = csvParser.parseFile.bind(csvParser);
export const parseCSVSync = csvParser.parseFileSync.bind(csvParser);
export const parseCSVString = csvParser.parseString.bind(csvParser);
export const stringifyCSV = csvParser.stringify.bind(csvParser);