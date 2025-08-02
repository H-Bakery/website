'use strict'
Object.defineProperty(exports, '__esModule', { value: true })
exports.parseCSV = parseCSV
exports.writeCSV = writeCSV
exports.parseCSVString = parseCSVString
var fs = require('fs')
var logger_1 = require('./logger')
/**
 * Parses a CSV file and returns an array of objects
 * @param filePath - Path to the CSV file
 * @returns Array of objects where each object represents a row in the CSV
 */
function parseCSV(filePath) {
  try {
    // Read file
    var data = fs.readFileSync(filePath, 'utf8')
    // Split the content by new line
    var lines = data.split('\n')
    // Extract headers
    var headers = lines[0].split(',').map(function (header) {
      // Remove quotes if they exist
      return header.replace(/^"/, '').replace(/"$/, '').trim()
    })
    // Parse data rows
    var result = []
    for (var i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue // Skip empty lines
      var values = []
      var insideQuotes = false
      var currentValue = ''
      // Parse CSV line character by character to handle quoted fields properly
      for (var j = 0; j < lines[i].length; j++) {
        var char = lines[i][j]
        if (char === '"') {
          insideQuotes = !insideQuotes
        } else if (char === ',' && !insideQuotes) {
          values.push(currentValue)
          currentValue = ''
        } else {
          currentValue += char
        }
      }
      // Add the last value
      values.push(currentValue)
      // Create object from headers and values
      var obj = {}
      for (var j = 0; j < headers.length; j++) {
        // Remove quotes if they exist
        if (values[j]) {
          obj[headers[j]] = values[j].replace(/^"/, '').replace(/"$/, '').trim()
        } else {
          obj[headers[j]] = ''
        }
      }
      result.push(obj)
    }
    logger_1.logger.info(
      'Successfully parsed CSV file: '
        .concat(filePath, ', found ')
        .concat(result.length, ' entries')
    )
    return result
  } catch (error) {
    logger_1.logger.error('Error parsing CSV file: '.concat(filePath), error)
    throw error
  }
}
/**
 * Writes an array of objects to a CSV file
 * @param filePath - Path where the CSV file will be written
 * @param data - Array of objects to write
 * @param headers - Optional array of headers. If not provided, will use object keys from first item
 */
function writeCSV(filePath, data, headers) {
  try {
    if (data.length === 0) {
      fs.writeFileSync(filePath, '')
      logger_1.logger.info('Written empty CSV file: '.concat(filePath))
      return
    }
    // Use provided headers or extract from first object
    var csvHeaders = headers || Object.keys(data[0])
    // Create CSV content
    var lines = []
    // Add header row
    lines.push(
      csvHeaders
        .map(function (h) {
          return '"'.concat(h, '"')
        })
        .join(',')
    )
    var _loop_1 = function (item) {
      var values = csvHeaders.map(function (header) {
        var value = item[header]
        // Handle different types
        if (value === null || value === undefined) {
          return ''
        }
        // Escape quotes and wrap in quotes if contains comma or quote
        var stringValue = String(value)
        if (
          stringValue.includes(',') ||
          stringValue.includes('"') ||
          stringValue.includes('\n')
        ) {
          return '"'.concat(stringValue.replace(/"/g, '""'), '"')
        }
        return stringValue
      })
      lines.push(values.join(','))
    }
    // Add data rows
    for (var _i = 0, data_1 = data; _i < data_1.length; _i++) {
      var item = data_1[_i]
      _loop_1(item)
    }
    // Write to file
    fs.writeFileSync(filePath, lines.join('\n'))
    logger_1.logger.info(
      'Successfully wrote CSV file: '
        .concat(filePath, ', ')
        .concat(data.length, ' entries')
    )
  } catch (error) {
    logger_1.logger.error('Error writing CSV file: '.concat(filePath), error)
    throw error
  }
}
/**
 * Parses a CSV string and returns an array of objects
 * @param csvString - CSV content as string
 * @returns Array of objects where each object represents a row in the CSV
 */
function parseCSVString(csvString) {
  try {
    // Split the content by new line
    var lines = csvString.split('\n')
    if (lines.length === 0) {
      return []
    }
    // Extract headers
    var headers = lines[0].split(',').map(function (header) {
      // Remove quotes if they exist
      return header.replace(/^"/, '').replace(/"$/, '').trim()
    })
    // Parse data rows
    var result = []
    for (var i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue // Skip empty lines
      var values = []
      var insideQuotes = false
      var currentValue = ''
      // Parse CSV line character by character to handle quoted fields properly
      for (var j = 0; j < lines[i].length; j++) {
        var char = lines[i][j]
        if (char === '"') {
          insideQuotes = !insideQuotes
        } else if (char === ',' && !insideQuotes) {
          values.push(currentValue)
          currentValue = ''
        } else {
          currentValue += char
        }
      }
      // Add the last value
      values.push(currentValue)
      // Create object from headers and values
      var obj = {}
      for (var j = 0; j < headers.length; j++) {
        // Remove quotes if they exist
        if (values[j]) {
          obj[headers[j]] = values[j].replace(/^"/, '').replace(/"$/, '').trim()
        } else {
          obj[headers[j]] = ''
        }
      }
      result.push(obj)
    }
    return result
  } catch (error) {
    logger_1.logger.error('Error parsing CSV string', error)
    throw error
  }
}
