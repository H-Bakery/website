/**
 * Parses a CSV file and returns an array of objects
 * @param filePath - Path to the CSV file
 * @returns Array of objects where each object represents a row in the CSV
 */
export declare function parseCSV<
  T extends Record<string, string> = Record<string, string>
>(filePath: string): T[]
/**
 * Writes an array of objects to a CSV file
 * @param filePath - Path where the CSV file will be written
 * @param data - Array of objects to write
 * @param headers - Optional array of headers. If not provided, will use object keys from first item
 */
export declare function writeCSV<T extends Record<string, any>>(
  filePath: string,
  data: T[],
  headers?: string[]
): void
/**
 * Parses a CSV string and returns an array of objects
 * @param csvString - CSV content as string
 * @returns Array of objects where each object represents a row in the CSV
 */
export declare function parseCSVString<
  T extends Record<string, string> = Record<string, string>
>(csvString: string): T[]
