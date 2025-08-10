import * as ExcelJS from 'exceljs';
import * as path from 'path';
import * as fs from 'fs/promises';
import { ReportData, ReportRequest, ReportType } from './types/report.types';

export class ExcelReportGenerator {
  private readonly reportsDir = path.join(process.cwd(), 'generated-reports');

  constructor() {
    this.ensureReportsDirectory();
  }

  private async ensureReportsDirectory(): Promise<void> {
    try {
      await fs.access(this.reportsDir);
    } catch {
      await fs.mkdir(this.reportsDir, { recursive: true });
    }
  }

  public async generate(data: ReportData, request: ReportRequest): Promise<{ filePath: string; fileName: string }> {
    const workbook = new ExcelJS.Workbook();
    
    // Set workbook properties
    workbook.creator = 'Bäckerei Heusser';
    workbook.created = new Date();
    workbook.properties.date1904 = true;

    // Add worksheets
    this.addSummarySheet(workbook, data);
    this.addRevenueSheet(workbook, data);
    this.addProductsSheet(workbook, data);
    this.addPaymentMethodsSheet(workbook, data);
    
    if (data.cashierPerformance) {
      this.addCashierSheet(workbook, data);
    }

    // Generate filename
    const fileName = this.generateFileName(request);
    const filePath = path.join(this.reportsDir, fileName);

    // Write file
    await workbook.xlsx.writeFile(filePath);
    console.log(`[ExcelReportGenerator] Generated report: ${fileName}`);

    return { filePath, fileName };
  }

  public async generateCsv(data: ReportData, request: ReportRequest): Promise<{ filePath: string; fileName: string }> {
    // For CSV, we'll create a simplified version with just the product data
    const csvContent = this.convertToCSV(data.productPerformance);
    
    const fileName = this.generateFileName(request, 'csv');
    const filePath = path.join(this.reportsDir, fileName);

    await fs.writeFile(filePath, csvContent, 'utf8');
    console.log(`[ExcelReportGenerator] Generated CSV: ${fileName}`);

    return { filePath, fileName };
  }

  private addSummarySheet(workbook: ExcelJS.Workbook, data: ReportData): void {
    const sheet = workbook.addWorksheet('Zusammenfassung');

    // Title
    sheet.mergeCells('A1:D1');
    sheet.getCell('A1').value = 'Verkaufsbericht - Zusammenfassung';
    sheet.getCell('A1').font = { size: 16, bold: true };
    sheet.getCell('A1').alignment = { horizontal: 'center' };

    // Period
    sheet.mergeCells('A3:D3');
    sheet.getCell('A3').value = `Zeitraum: ${data.summary.period.start} bis ${data.summary.period.end}`;
    sheet.getCell('A3').alignment = { horizontal: 'center' };

    // Summary data
    const summaryData = [
      ['Kennzahl', 'Wert'],
      ['Gesamtumsatz', this.formatCurrency(data.summary.totalRevenue)],
      ['Anzahl Transaktionen', data.summary.totalTransactions],
      ['Durchschnittlicher Transaktionswert', this.formatCurrency(data.summary.avgTransactionValue)],
    ];

    sheet.addRows(['']); // Empty row
    sheet.addRows(summaryData);

    // Styling
    this.styleHeaderRow(sheet, 5);
    this.autoFitColumns(sheet);
  }

  private addRevenueSheet(workbook: ExcelJS.Workbook, data: ReportData): void {
    const sheet = workbook.addWorksheet('Umsatzentwicklung');

    // Title
    sheet.mergeCells('A1:C1');
    sheet.getCell('A1').value = 'Tägliche Umsatzentwicklung';
    sheet.getCell('A1').font = { size: 14, bold: true };

    // Headers
    const headers = ['Datum', 'Umsatz', 'Transaktionen'];
    sheet.addRow(['']); // Empty row
    sheet.addRow(headers);

    // Data
    data.revenueData.forEach(day => {
      sheet.addRow([
        day.date,
        this.formatCurrency(day.revenue),
        day.transactionCount,
      ]);
    });

    // Add totals row
    const totalRevenue = data.revenueData.reduce((sum, day) => sum + day.revenue, 0);
    const totalTransactions = data.revenueData.reduce((sum, day) => sum + day.transactionCount, 0);
    
    sheet.addRow(['']); // Empty row
    const totalsRow = sheet.addRow(['Gesamt', this.formatCurrency(totalRevenue), totalTransactions]);
    totalsRow.font = { bold: true };

    // Styling
    this.styleHeaderRow(sheet, 3);
    this.autoFitColumns(sheet);

    // Add chart if requested
    if (data.revenueData.length > 0) {
      this.addRevenueChart(sheet, data.revenueData.length);
    }
  }

  private addProductsSheet(workbook: ExcelJS.Workbook, data: ReportData): void {
    const sheet = workbook.addWorksheet('Produktleistung');

    // Title
    sheet.mergeCells('A1:D1');
    sheet.getCell('A1').value = 'Top 20 Produkte nach Umsatz';
    sheet.getCell('A1').font = { size: 14, bold: true };

    // Headers
    const headers = ['Rang', 'Produkt', 'Verkaufte Menge', 'Umsatz'];
    sheet.addRow(['']); // Empty row
    sheet.addRow(headers);

    // Data
    data.productPerformance.forEach(product => {
      sheet.addRow([
        product.rank,
        product.productName,
        product.quantitySold,
        this.formatCurrency(product.revenue),
      ]);
    });

    // Styling
    this.styleHeaderRow(sheet, 3);
    this.autoFitColumns(sheet);

    // Conditional formatting for top 5
    const dataRange = `A4:D${3 + data.productPerformance.length}`;
    sheet.addConditionalFormatting({
      ref: dataRange,
      rules: [
        {
          type: 'expression',
          formulae: ['$A4<=5'],
          priority: 1,
          style: {
            fill: {
              type: 'pattern',
              pattern: 'solid',
              bgColor: { argb: 'FFE8F5E9' },
            },
          },
        },
      ],
    });
  }

  private addPaymentMethodsSheet(workbook: ExcelJS.Workbook, data: ReportData): void {
    const sheet = workbook.addWorksheet('Zahlungsmethoden');

    // Title
    sheet.mergeCells('A1:D1');
    sheet.getCell('A1').value = 'Zahlungsmethoden Übersicht';
    sheet.getCell('A1').font = { size: 14, bold: true };

    // Headers
    const headers = ['Zahlungsmethode', 'Anzahl', 'Betrag', 'Anteil %'];
    sheet.addRow(['']); // Empty row
    sheet.addRow(headers);

    // Data
    data.paymentMethods.forEach(method => {
      sheet.addRow([
        method.method,
        method.count,
        this.formatCurrency(method.amount),
        `${method.percentage.toFixed(1)}%`,
      ]);
    });

    // Styling
    this.styleHeaderRow(sheet, 3);
    this.autoFitColumns(sheet);
  }

  private addCashierSheet(workbook: ExcelJS.Workbook, data: ReportData): void {
    if (!data.cashierPerformance) return;

    const sheet = workbook.addWorksheet('Mitarbeiterleistung');

    // Title
    sheet.mergeCells('A1:D1');
    sheet.getCell('A1').value = 'Mitarbeiterleistung';
    sheet.getCell('A1').font = { size: 14, bold: true };

    // Headers
    const headers = ['Mitarbeiter', 'Transaktionen', 'Umsatz', 'Ø Transaktionswert'];
    sheet.addRow(['']); // Empty row
    sheet.addRow(headers);

    // Data
    data.cashierPerformance.forEach(cashier => {
      sheet.addRow([
        cashier.userName,
        cashier.transactionCount,
        this.formatCurrency(cashier.totalRevenue),
        this.formatCurrency(cashier.averageTransactionValue),
      ]);
    });

    // Styling
    this.styleHeaderRow(sheet, 3);
    this.autoFitColumns(sheet);
  }

  private addRevenueChart(sheet: ExcelJS.Worksheet, dataRows: number): void {
    // For now, skip chart generation as it requires proper image data
    // const imageId = workbook.addImage({
    //   base64: '', // We would need to generate a chart image here
    //   extension: 'png',
    // });
    // const chart = sheet.addImage(imageId, 'F3:K15');
    
    // Add placeholder text instead
    sheet.getCell('F3').value = 'Chart würde hier eingefügt (requires image data)';
    sheet.getCell('F3').font = { italic: true, color: { argb: 'FF666666' } };
  }

  private styleHeaderRow(sheet: ExcelJS.Worksheet, rowNumber: number): void {
    const headerRow = sheet.getRow(rowNumber);
    headerRow.font = { bold: true };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE3F2FD' },
    };
    headerRow.alignment = { horizontal: 'center' };
  }

  private autoFitColumns(sheet: ExcelJS.Worksheet): void {
    sheet.columns.forEach(column => {
      if (column.values) {
        let maxLength = 0;
        column.values.forEach(value => {
          if (value && value.toString().length > maxLength) {
            maxLength = value.toString().length;
          }
        });
        column.width = Math.min(maxLength + 2, 30);
      }
    });
  }

  private formatCurrency(amount: number): string {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount);
  }

  private generateFileName(request: ReportRequest, extension: string = 'xlsx'): string {
    const typeMap: Record<ReportType, string> = {
      [ReportType.DAILY_SUMMARY]: 'Tagesbericht',
      [ReportType.WEEKLY_PERFORMANCE]: 'Wochenbericht',
      [ReportType.MONTHLY_ANALYTICS]: 'Monatsbericht',
      [ReportType.CUSTOM_RANGE]: 'Bericht',
    };

    const reportName = typeMap[request.type];
    const dateStr = new Date().toISOString().split('T')[0];
    return `${reportName}_${dateStr}_${Date.now()}.${extension}`;
  }

  private convertToCSV(data: any[]): string {
    if (data.length === 0) return '';

    const headers = Object.keys(data[0]);
    const csvRows = [headers.join(',')];

    data.forEach(row => {
      const values = headers.map(header => {
        const value = row[header];
        return typeof value === 'string' && value.includes(',') 
          ? `"${value}"` 
          : value;
      });
      csvRows.push(values.join(','));
    });

    return csvRows.join('\n');
  }
}