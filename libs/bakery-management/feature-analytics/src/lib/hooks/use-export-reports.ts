import { useState } from 'react';
import { apiClient } from '@bakery/shared/data-access';

// Import types directly since module resolution might not work in development
export enum ReportType {
  DAILY = 'DAILY',
  WEEKLY = 'WEEKLY',
  MONTHLY = 'MONTHLY',
  CUSTOM_RANGE = 'CUSTOM_RANGE'
}

export enum ReportFormat {
  PDF = 'PDF',
  EXCEL = 'EXCEL',
  CSV = 'CSV'
}

export interface ReportRequest {
  type: ReportType;
  format: ReportFormat;
  startDate: string;
  endDate: string;
  recipients?: string[];
  includeCharts?: boolean;
}

export interface ExportParams {
  startDate: string;
  endDate: string;
  granularity?: 'daily' | 'weekly' | 'monthly';
  format: 'pdf' | 'excel' | 'csv';
  includeCharts?: boolean;
  recipients?: string[];
}

export function useExportReports() {
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const exportReport = async (params: ExportParams) => {
    setIsExporting(true);
    setError(null);

    try {
      // Map format to API format
      const formatMap: Record<string, ReportFormat> = {
        pdf: ReportFormat.PDF,
        excel: ReportFormat.EXCEL,
        csv: ReportFormat.CSV,
      };

      // Determine report type based on date range
      const getReportType = (startDate: string, endDate: string): ReportType => {
        const start = new Date(startDate);
        const end = new Date(endDate);
        const daysDiff = Math.abs(end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);

        if (daysDiff <= 1) return ReportType.DAILY;
        if (daysDiff <= 7) return ReportType.WEEKLY;
        if (daysDiff <= 31) return ReportType.MONTHLY;
        return ReportType.CUSTOM_RANGE;
      };

      const request: ReportRequest = {
        type: getReportType(params.startDate, params.endDate),
        format: formatMap[params.format],
        startDate: params.startDate,
        endDate: params.endDate,
        recipients: params.recipients || [],
        includeCharts: params.includeCharts ?? true,
      };

      // Generate the report using fetch API directly to avoid module resolution issues
      const baseUrl = process.env['NEXT_PUBLIC_API_URL'] || 'http://localhost:5000';
      
      // Get the auth header from the API client
      const authHeader = apiClient.getAuthHeader();
      
      const generateResponse = await fetch(`${baseUrl}/api/reports/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeader,
        },
        body: JSON.stringify(request),
      });

      if (!generateResponse.ok) {
        throw new Error(`HTTP ${generateResponse.status}: ${generateResponse.statusText}`);
      }

      const responseData = await generateResponse.json();
      const reportData = responseData.success ? responseData.report : responseData.data?.report;

      if (!reportData) {
        throw new Error('Invalid response format from server');
      }

      // Automatically trigger download
      const token = reportData.downloadUrl.split('/').pop();
      if (token) {
        const downloadLink = `${baseUrl}/api/reports/download/${token}`;
        const link = document.createElement('a');
        link.href = downloadLink;
        link.download = '';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }

      return reportData;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unbekannter Fehler beim Export';
      setError(errorMessage);
      throw err;
    } finally {
      setIsExporting(false);
    }
  };

  const clearError = () => setError(null);

  return {
    exportReport,
    isExporting,
    error,
    clearError,
  };
}