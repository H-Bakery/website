// Local copy of report types to avoid rootDir issues

export interface TransactionItem {
  product_id: string;
  product: string;
  quantity: number;
  price: number;
  total: number;
}

export interface Transaction {
  id: string;
  timestamp: string;
  user: string;
  type: 'sale' | 'refund';
  items: TransactionItem[];
  total: number;
  payment: string;
}

export interface DailySummary {
  total_revenue: number;
  cash_revenue: number;
  card_revenue?: number;
  transaction_count: number;
  refund_count?: number;
  average_transaction?: number;
  vat_totals?: Record<string, number>;
}

export interface DailyReport {
  date: string;
  register_id: string;
  report_number: number;
  company: string;
  transactions: Transaction[];
  daily_summary: DailySummary;
}