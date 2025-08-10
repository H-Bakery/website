import Joi from 'joi';
import type { DailyReport } from '../types/report.types';

// Define the schema for transaction items
const transactionItemSchema = Joi.object({
  product: Joi.string().required(),
  product_id: Joi.string().required(),
  quantity: Joi.number().integer().positive().required(),
  price: Joi.number().positive().required(),
  total: Joi.number().required(),
});

// Define the schema for transactions
const transactionSchema = Joi.object({
  id: Joi.string().required(),
  timestamp: Joi.string().isoDate().required(),
  type: Joi.string().valid('sale', 'refund', 'adjustment').required(),
  user: Joi.string().required(),
  items: Joi.array().items(transactionItemSchema).min(1).required(),
  total: Joi.number().required(),
  payment: Joi.string().required(),
});

// Define the schema for VAT totals
const vatTotalsSchema = Joi.object({
  '0%': Joi.number().optional(),
  '7%': Joi.number().optional(),
  '19%': Joi.number().optional(),
}).pattern(Joi.string(), Joi.number());

// Define the schema for daily summary
const dailySummarySchema = Joi.object({
  total_revenue: Joi.number().required(),
  cash_revenue: Joi.number().required(),
  transaction_count: Joi.number().integer().min(0).required(),
  vat_totals: vatTotalsSchema.required(),
});

// Define the schema for user performance (optional)
const userPerformanceSchema = Joi.object({
  user: Joi.string().required(),
  transaction_count: Joi.number().integer().min(0).required(),
  total_revenue: Joi.number().required(),
  average_transaction: Joi.number().required(),
});

// Define the schema for product performance (optional)
const productPerformanceSchema = Joi.object({
  product_id: Joi.string().required(),
  product_name: Joi.string().required(),
  quantity_sold: Joi.number().integer().min(0).required(),
  total_revenue: Joi.number().required(),
});

// Define the main schema for daily report
const dailyReportSchema = Joi.object({
  date: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).required(),
  register_id: Joi.string().required(),
  report_number: Joi.number().integer().positive().required(),
  company: Joi.string().required(),
  transactions: Joi.array().items(transactionSchema).required(),
  daily_summary: dailySummarySchema.required(),
  user_performance: Joi.array().items(userPerformanceSchema).optional(),
  product_performance: Joi.array().items(productPerformanceSchema).optional(),
});

/**
 * Validate a daily report object
 */
export function validateDailyReport(report: unknown): Joi.ValidationResult<DailyReport> {
  return dailyReportSchema.validate(report, {
    abortEarly: false,
    stripUnknown: true,
  });
}

/**
 * Validate an array of daily reports
 */
export function validateDailyReports(reports: unknown[]): Joi.ValidationResult<DailyReport[]> {
  const schema = Joi.array().items(dailyReportSchema);
  return schema.validate(reports, {
    abortEarly: false,
    stripUnknown: true,
  });
}