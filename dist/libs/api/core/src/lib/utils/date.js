'use strict'
Object.defineProperty(exports, '__esModule', { value: true })
exports.formatDate = formatDate
exports.formatDateTime = formatDateTime
exports.startOfDay = startOfDay
exports.endOfDay = endOfDay
exports.addDays = addDays
exports.addHours = addHours
exports.addMinutes = addMinutes
exports.isPast = isPast
exports.isFuture = isFuture
exports.isToday = isToday
exports.daysBetween = daysBetween
exports.hoursBetween = hoursBetween
exports.minutesBetween = minutesBetween
exports.parseDateRange = parseDateRange
exports.startOfWeek = startOfWeek
exports.endOfWeek = endOfWeek
exports.startOfMonth = startOfMonth
exports.endOfMonth = endOfMonth
var constants_1 = require('../constants')
/**
 * Format a date to YYYY-MM-DD string
 * @param date - Date to format
 * @returns Formatted date string
 */
function formatDate(date) {
  var d = new Date(date)
  var year = d.getFullYear()
  var month = String(d.getMonth() + 1).padStart(2, '0')
  var day = String(d.getDate()).padStart(2, '0')
  return ''.concat(year, '-').concat(month, '-').concat(day)
}
/**
 * Format a date to YYYY-MM-DD HH:mm:ss string
 * @param date - Date to format
 * @returns Formatted datetime string
 */
function formatDateTime(date) {
  var d = new Date(date)
  var dateStr = formatDate(d)
  var hours = String(d.getHours()).padStart(2, '0')
  var minutes = String(d.getMinutes()).padStart(2, '0')
  var seconds = String(d.getSeconds()).padStart(2, '0')
  return ''
    .concat(dateStr, ' ')
    .concat(hours, ':')
    .concat(minutes, ':')
    .concat(seconds)
}
/**
 * Get start of day (00:00:00)
 * @param date - Date to process
 * @returns Date at start of day
 */
function startOfDay(date) {
  var d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}
/**
 * Get end of day (23:59:59.999)
 * @param date - Date to process
 * @returns Date at end of day
 */
function endOfDay(date) {
  var d = new Date(date)
  d.setHours(23, 59, 59, 999)
  return d
}
/**
 * Add days to a date
 * @param date - Starting date
 * @param days - Number of days to add (can be negative)
 * @returns New date
 */
function addDays(date, days) {
  var d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}
/**
 * Add hours to a date
 * @param date - Starting date
 * @param hours - Number of hours to add (can be negative)
 * @returns New date
 */
function addHours(date, hours) {
  var d = new Date(date)
  d.setHours(d.getHours() + hours)
  return d
}
/**
 * Add minutes to a date
 * @param date - Starting date
 * @param minutes - Number of minutes to add (can be negative)
 * @returns New date
 */
function addMinutes(date, minutes) {
  var d = new Date(date)
  d.setMinutes(d.getMinutes() + minutes)
  return d
}
/**
 * Check if date is in the past
 * @param date - Date to check
 * @returns True if date is in the past
 */
function isPast(date) {
  return new Date(date) < new Date()
}
/**
 * Check if date is in the future
 * @param date - Date to check
 * @returns True if date is in the future
 */
function isFuture(date) {
  return new Date(date) > new Date()
}
/**
 * Check if date is today
 * @param date - Date to check
 * @returns True if date is today
 */
function isToday(date) {
  var d = new Date(date)
  var today = new Date()
  return (
    d.getDate() === today.getDate() &&
    d.getMonth() === today.getMonth() &&
    d.getFullYear() === today.getFullYear()
  )
}
/**
 * Get days between two dates
 * @param startDate - Start date
 * @param endDate - End date
 * @returns Number of days between dates
 */
function daysBetween(startDate, endDate) {
  var start = new Date(startDate)
  var end = new Date(endDate)
  var diff = Math.abs(end.getTime() - start.getTime())
  return Math.floor(diff / constants_1.TIME_CONSTANTS.DAY)
}
/**
 * Get hours between two dates
 * @param startDate - Start date
 * @param endDate - End date
 * @returns Number of hours between dates
 */
function hoursBetween(startDate, endDate) {
  var start = new Date(startDate)
  var end = new Date(endDate)
  var diff = Math.abs(end.getTime() - start.getTime())
  return Math.floor(diff / constants_1.TIME_CONSTANTS.HOUR)
}
/**
 * Get minutes between two dates
 * @param startDate - Start date
 * @param endDate - End date
 * @returns Number of minutes between dates
 */
function minutesBetween(startDate, endDate) {
  var start = new Date(startDate)
  var end = new Date(endDate)
  var diff = Math.abs(end.getTime() - start.getTime())
  return Math.floor(diff / constants_1.TIME_CONSTANTS.MINUTE)
}
/**
 * Parse date range from query parameters
 * @param startDate - Start date string
 * @param endDate - End date string
 * @returns Object with parsed start and end dates
 */
function parseDateRange(startDate, endDate) {
  var range = {}
  if (startDate) {
    range.start = startOfDay(startDate)
  }
  if (endDate) {
    range.end = endOfDay(endDate)
  }
  return range
}
/**
 * Get week start date (Monday)
 * @param date - Date to process
 * @returns Date at start of week
 */
function startOfWeek(date) {
  var d = new Date(date)
  var day = d.getDay()
  var diff = d.getDate() - day + (day === 0 ? -6 : 1) // Adjust for Sunday
  d.setDate(diff)
  return startOfDay(d)
}
/**
 * Get week end date (Sunday)
 * @param date - Date to process
 * @returns Date at end of week
 */
function endOfWeek(date) {
  var d = new Date(date)
  var day = d.getDay()
  var diff = d.getDate() - day + 7
  d.setDate(diff)
  return endOfDay(d)
}
/**
 * Get month start date
 * @param date - Date to process
 * @returns Date at start of month
 */
function startOfMonth(date) {
  var d = new Date(date)
  d.setDate(1)
  return startOfDay(d)
}
/**
 * Get month end date
 * @param date - Date to process
 * @returns Date at end of month
 */
function endOfMonth(date) {
  var d = new Date(date)
  d.setMonth(d.getMonth() + 1)
  d.setDate(0)
  return endOfDay(d)
}
