/**
 * Local copy of report types to avoid rootDir issues
 * These are duplicated from @bakery/shared/types
 */

export interface TransactionItem {
  product: string;
  product_id: string;
  quantity: number;
  price: number;
  total: number;
}

export interface Transaction {
  id: string;
  timestamp: string;
  type: 'sale' | 'refund' | 'adjustment';
  user: string;
  items: TransactionItem[];
  total: number;
  payment: 'Bar' | 'Unbar' | string;
}

export interface VatTotals {
  '0%'?: number;
  '7%'?: number;
  '19%'?: number;
  [key: string]: number | undefined;
}

export interface DailySummary {
  total_revenue: number;
  cash_revenue: number;
  transaction_count: number;
  vat_totals: VatTotals;
}

export interface DailyReport {
  date: string;
  register_id: string;
  report_number: number;
  company: string;
  transactions: Transaction[];
  daily_summary: DailySummary;
  user_performance?: any[];
  product_performance?: any[];
}