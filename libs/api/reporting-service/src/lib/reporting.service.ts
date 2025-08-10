import * as fs from 'fs/promises';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
// TODO: Create event bus library
// import { eventBus } from '@bakery/api/event-bus';
// For now, use a simple mock event bus
const eventBus = {
  emit: (event: string, data: any) => {
    console.log(`[EventBus] ${event}:`, data);
  },
  safeEmit: (event: string, data: any) => {
    try {
      console.log(`[EventBus] ${event}:`, data);
    } catch (error) {
      console.error(`[EventBus] Error emitting event ${event}:`, error);
    }
  }
};

// Import analytics service - this needs to be done differently to avoid path issues
// For now, create a simple interface
interface AnalyticsService {
  getRevenueTrends: (params: any) => Promise<any[]>;
  getProductPerformance: (params: any) => Promise<any[]>;
  getPaymentMethods: (params: any) => Promise<any[]>;
  getCashierPerformance: (params: any) => Promise<any[]>;
  getSummary: (params: any) => Promise<any>;
}

// Mock analytics service for now
const analyticsService: AnalyticsService = {
  async getRevenueTrends(params) {
    return [];
  },
  async getProductPerformance(params) {
    return [];
  },
  async getPaymentMethods(params) {
    return [];
  },
  async getCashierPerformance(params) {
    return [];
  },
  async getSummary(params) {
    return {
      totalRevenue: 0,
      totalTransactions: 0,
      avgTransactionValue: 0,
      cashPercentage: 0,
    };
  }
};
import {
  ReportType,
  ReportFormat,
  ReportRequest,
  ReportSchedule,
  GeneratedReport,
  ReportGeneratedEvent,
  ReportData,
} from './types/report.types';
import { ExcelReportGenerator } from './excel-report.generator';
import { PdfReportGenerator } from './pdf-report.generator';
import { ReportScheduler } from './report-scheduler';
import { FileStorageService } from './file-storage.service';

export class ReportingService {
  private static instance: ReportingService;
  private excelGenerator: ExcelReportGenerator;
  private pdfGenerator: PdfReportGenerator;
  private scheduler: ReportScheduler;
  private fileStorage: FileStorageService;
  private schedules: Map<string, ReportSchedule> = new Map();

  private constructor() {
    this.excelGenerator = new ExcelReportGenerator();
    this.pdfGenerator = new PdfReportGenerator();
    this.scheduler = new ReportScheduler(this);
    this.fileStorage = new FileStorageService();
  }

  public static getInstance(): ReportingService {
    if (!ReportingService.instance) {
      ReportingService.instance = new ReportingService();
    }
    return ReportingService.instance;
  }

  /**
   * Generate a report on demand
   */
  public async generateReport(request: ReportRequest): Promise<GeneratedReport> {
    console.log(`[ReportingService] Generating ${request.type} report in ${request.format} format`);

    try {
      // Fetch report data
      const reportData = await this.fetchReportData(request);

      // Generate report file based on format
      let filePath: string;
      let fileName: string;

      switch (request.format) {
        case ReportFormat.EXCEL:
          ({ filePath, fileName } = await this.excelGenerator.generate(reportData, request));
          break;
        case ReportFormat.PDF:
          ({ filePath, fileName } = await this.pdfGenerator.generate(reportData, request));
          break;
        case ReportFormat.CSV:
          // For now, we'll use Excel generator for CSV
          ({ filePath, fileName } = await this.excelGenerator.generateCsv(reportData, request));
          break;
        default:
          throw new Error(`Unsupported report format: ${request.format}`);
      }

      // Get file stats
      const stats = await fs.stat(filePath);

      // Create download URL
      const downloadUrl = await this.fileStorage.generateDownloadUrl(filePath);
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24); // 24 hour expiration

      // Create report record
      const generatedReport: GeneratedReport = {
        id: uuidv4(),
        type: request.type,
        format: request.format,
        fileName,
        filePath,
        fileSize: stats.size,
        downloadUrl,
        expiresAt,
        generatedAt: new Date(),
        parameters: {
          startDate: request.startDate,
          endDate: request.endDate,
        },
      };

      // Emit event
      this.emitReportGeneratedEvent(generatedReport, request.recipients || []);

      return generatedReport;
    } catch (error) {
      console.error('[ReportingService] Error generating report:', error);
      throw error;
    }
  }

  /**
   * Schedule a recurring report
   */
  public async createSchedule(schedule: ReportSchedule): Promise<ReportSchedule> {
    const scheduleId = schedule.id || uuidv4();
    const fullSchedule: ReportSchedule = {
      ...schedule,
      id: scheduleId,
      createdAt: new Date(),
      updatedAt: new Date(),
      nextRun: this.scheduler.calculateNextRun(schedule),
    };

    this.schedules.set(scheduleId, fullSchedule);
    
    // Register with scheduler
    this.scheduler.scheduleReport(fullSchedule);

    console.log(`[ReportingService] Created schedule ${scheduleId} for ${schedule.reportType}`);
    return fullSchedule;
  }

  /**
   * Get all schedules
   */
  public async getSchedules(): Promise<ReportSchedule[]> {
    return Array.from(this.schedules.values());
  }

  /**
   * Update a schedule
   */
  public async updateSchedule(id: string, updates: Partial<ReportSchedule>): Promise<ReportSchedule> {
    const existing = this.schedules.get(id);
    if (!existing) {
      throw new Error(`Schedule ${id} not found`);
    }

    const updated: ReportSchedule = {
      ...existing,
      ...updates,
      id,
      updatedAt: new Date(),
      nextRun: this.scheduler.calculateNextRun({ ...existing, ...updates }),
    };

    this.schedules.set(id, updated);
    
    // Update scheduler
    this.scheduler.updateSchedule(updated);

    return updated;
  }

  /**
   * Delete a schedule
   */
  public async deleteSchedule(id: string): Promise<void> {
    const schedule = this.schedules.get(id);
    if (!schedule) {
      throw new Error(`Schedule ${id} not found`);
    }

    this.schedules.delete(id);
    this.scheduler.cancelSchedule(id);

    console.log(`[ReportingService] Deleted schedule ${id}`);
  }

  /**
   * Execute a scheduled report
   */
  public async executeScheduledReport(schedule: ReportSchedule): Promise<void> {
    console.log(`[ReportingService] Executing scheduled report ${schedule.id}`);

    const endDate = new Date();
    const startDate = new Date();

    // Calculate date range based on report type
    switch (schedule.reportType) {
      case ReportType.DAILY_SUMMARY:
        startDate.setDate(startDate.getDate() - 1);
        break;
      case ReportType.WEEKLY_PERFORMANCE:
        startDate.setDate(startDate.getDate() - 7);
        break;
      case ReportType.MONTHLY_ANALYTICS:
        startDate.setMonth(startDate.getMonth() - 1);
        break;
    }

    const request: ReportRequest = {
      type: schedule.reportType,
      format: schedule.format,
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
      recipients: schedule.recipients,
      includeCharts: true,
    };

    try {
      await this.generateReport(request);

      // Update last run time
      schedule.lastRun = new Date();
      schedule.nextRun = this.scheduler.calculateNextRun(schedule);
      this.schedules.set(schedule.id!, schedule);
    } catch (error) {
      console.error(`[ReportingService] Failed to execute scheduled report ${schedule.id}:`, error);
      // TODO: Add retry logic or notification
    }
  }

  /**
   * Fetch report data from analytics service
   */
  private async fetchReportData(request: ReportRequest): Promise<ReportData> {
    const params = {
      startDate: request.startDate,
      endDate: request.endDate,
    };

    // Fetch all required data in parallel
    const [summary, revenueData, topProducts, paymentMethods, cashierPerformance] = await Promise.all([
      analyticsService.getSummary(params),
      analyticsService.getRevenueTrends({ ...params, granularity: 'daily' }),
      analyticsService.getProductPerformance({ ...params, type: 'top', limit: 20 }),
      analyticsService.getPaymentMethods(params),
      analyticsService.getCashierPerformance(params),
    ]);

    // Calculate payment method percentages
    const totalPaymentAmount = paymentMethods.reduce((sum, pm) => sum + pm.amount, 0);
    const paymentMethodsWithPercentage = paymentMethods.map(pm => ({
      ...pm,
      percentage: totalPaymentAmount > 0 ? (pm.amount / totalPaymentAmount) * 100 : 0,
    }));

    return {
      summary: {
        totalRevenue: summary.totalRevenue,
        totalTransactions: summary.totalTransactions,
        avgTransactionValue: summary.avgTransactionValue,
        period: {
          start: request.startDate,
          end: request.endDate,
        },
      },
      revenueData,
      productPerformance: topProducts.map((product, index) => ({
        ...product,
        rank: index + 1,
      })),
      paymentMethods: paymentMethodsWithPercentage,
      cashierPerformance,
    };
  }

  /**
   * Emit report generated event
   */
  private emitReportGeneratedEvent(report: GeneratedReport, recipients: string[]): void {
    const event: ReportGeneratedEvent = {
      reportId: report.id,
      reportType: report.type,
      format: report.format,
      fileName: report.fileName,
      downloadUrl: report.downloadUrl || '',
      recipients,
      generatedAt: report.generatedAt,
      expiresAt: report.expiresAt || new Date(),
    };

    eventBus.safeEmit('report.generated', event);
    console.log(`[ReportingService] Emitted report.generated event for report ${report.id}`);
  }
}

export const reportingService = ReportingService.getInstance();