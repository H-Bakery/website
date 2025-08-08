export enum ReportType {
  DAILY_SUMMARY = 'daily_summary',
  WEEKLY_PERFORMANCE = 'weekly_performance',
  MONTHLY_ANALYTICS = 'monthly_analytics',
  CUSTOM_RANGE = 'custom_range',
}

export enum ReportFormat {
  PDF = 'pdf',
  EXCEL = 'excel',
  CSV = 'csv',
}

export enum ScheduleFrequency {
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
}

export interface ReportRequest {
  type: ReportType;
  format: ReportFormat;
  startDate: string;
  endDate: string;
  recipients?: string[];
  includeCharts?: boolean;
}

export interface ReportSchedule {
  id?: string;
  reportType: ReportType;
  format: ReportFormat;
  frequency: ScheduleFrequency;
  recipients: string[];
  active: boolean;
  dayOfWeek?: number; // 0-6 for weekly
  dayOfMonth?: number; // 1-31 for monthly
  timeOfDay: string; // HH:mm format
  lastRun?: Date;
  nextRun?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface GeneratedReport {
  id: string;
  type: ReportType;
  format: ReportFormat;
  fileName: string;
  filePath: string;
  fileSize: number;
  downloadUrl?: string;
  expiresAt?: Date;
  generatedAt: Date;
  parameters: {
    startDate: string;
    endDate: string;
  };
  metadata?: Record<string, any>;
}

export interface ReportGeneratedEvent {
  reportId: string;
  reportType: ReportType;
  format: ReportFormat;
  fileName: string;
  downloadUrl: string;
  recipients: string[];
  generatedAt: Date;
  expiresAt: Date;
}

export interface ReportData {
  summary: {
    totalRevenue: number;
    totalTransactions: number;
    avgTransactionValue: number;
    period: {
      start: string;
      end: string;
    };
  };
  revenueData: Array<{
    date: string;
    revenue: number;
    transactionCount: number;
  }>;
  productPerformance: Array<{
    productId: string;
    productName: string;
    quantitySold: number;
    revenue: number;
    rank?: number;
  }>;
  paymentMethods: Array<{
    method: string;
    count: number;
    amount: number;
    percentage: number;
  }>;
  cashierPerformance?: Array<{
    userId: string;
    userName: string;
    transactionCount: number;
    totalRevenue: number;
    averageTransactionValue: number;
  }>;
}