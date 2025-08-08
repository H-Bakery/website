import { apiClient } from '../api-client';

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

export interface ReportResponse {
  success: boolean;
  report: {
    id: string;
    downloadUrl: string;
    filename: string;
    format: ReportFormat;
    generatedAt: string;
  };
}

export interface ReportSchedule {
  id?: string;
  reportType: ReportType;
  format: ReportFormat;
  frequency: 'DAILY' | 'WEEKLY' | 'MONTHLY';
  recipients: string[];
  active: boolean;
  dayOfWeek?: number; // 0-6, Sunday = 0
  dayOfMonth?: number; // 1-31
  timeOfDay: string; // HH:MM format
  nextRun?: string;
}

export class ReportingService {
  private basePath = '/api/reports';

  async generateReport(request: ReportRequest): Promise<ReportResponse> {
    try {
      const response = await apiClient.post<ReportResponse>(
        `${this.basePath}/generate`,
        request
      );
      return response.data!;
    } catch (error) {
      console.error('Error generating report:', error);
      throw new Error('Fehler beim Generieren des Reports');
    }
  }

  async downloadReport(downloadUrl: string): Promise<void> {
    try {
      // Extract token from download URL
      const token = downloadUrl.split('/').pop();
      if (!token) {
        throw new Error('Invalid download URL');
      }

      // Create download link and trigger download
      // Use window location for base URL
      const baseURL = window.location.origin;
      const downloadLink = `${baseURL}${this.basePath}/download/${token}`;
      const link = document.createElement('a');
      link.href = downloadLink;
      link.download = ''; // Let browser determine filename from response
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Error downloading report:', error);
      throw new Error('Fehler beim Download des Reports');
    }
  }

  async createSchedule(schedule: ReportSchedule): Promise<{ success: boolean; schedule: ReportSchedule }> {
    try {
      const response = await apiClient.post<{ success: boolean; schedule: ReportSchedule }>(
        `${this.basePath}/schedule`,
        schedule
      );
      return response.data!;
    } catch (error) {
      console.error('Error creating schedule:', error);
      throw new Error('Fehler beim Erstellen des Zeitplans');
    }
  }

  async getSchedules(): Promise<{ success: boolean; schedules: ReportSchedule[] }> {
    try {
      const response = await apiClient.get<{ success: boolean; schedules: ReportSchedule[] }>(
        `${this.basePath}/schedules`
      );
      return response.data!;
    } catch (error) {
      console.error('Error fetching schedules:', error);
      throw new Error('Fehler beim Laden der Zeitpläne');
    }
  }

  async updateSchedule(id: string, schedule: Partial<ReportSchedule>): Promise<{ success: boolean; schedule: ReportSchedule }> {
    try {
      const response = await apiClient.put<{ success: boolean; schedule: ReportSchedule }>(
        `${this.basePath}/schedule/${id}`,
        schedule
      );
      return response.data!;
    } catch (error) {
      console.error('Error updating schedule:', error);
      throw new Error('Fehler beim Aktualisieren des Zeitplans');
    }
  }

  async deleteSchedule(id: string): Promise<{ success: boolean }> {
    try {
      const response = await apiClient.delete<{ success: boolean }>(
        `${this.basePath}/schedule/${id}`
      );
      return response.data!;
    } catch (error) {
      console.error('Error deleting schedule:', error);
      throw new Error('Fehler beim Löschen des Zeitplans');
    }
  }

  async getStorageStats(): Promise<{
    success: boolean;
    stats: {
      totalFiles: number;
      totalSize: number;
      oldestFile: string;
      newestFile: string;
    };
  }> {
    try {
      const response = await apiClient.get<{
        success: boolean;
        stats: {
          totalFiles: number;
          totalSize: number;
          oldestFile: string;
          newestFile: string;
        };
      }>(`${this.basePath}/storage/stats`);
      return response.data!;
    } catch (error) {
      console.error('Error fetching storage stats:', error);
      throw new Error('Fehler beim Laden der Speicher-Statistiken');
    }
  }

  async cleanupStorage(): Promise<{ success: boolean }> {
    try {
      const response = await apiClient.post<{ success: boolean }>(
        `${this.basePath}/storage/cleanup`
      );
      return response.data!;
    } catch (error) {
      console.error('Error cleaning up storage:', error);
      throw new Error('Fehler beim Bereinigen des Speichers');
    }
  }
}

export const reportingService = new ReportingService();