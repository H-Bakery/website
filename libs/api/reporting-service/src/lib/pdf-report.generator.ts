import * as puppeteer from 'puppeteer';
import * as handlebars from 'handlebars';
import * as path from 'path';
import * as fs from 'fs/promises';
import { ReportData, ReportRequest, ReportType } from './types/report.types';

export class PdfReportGenerator {
  private readonly reportsDir = path.join(process.cwd(), 'generated-reports');
  private readonly templatesDir = path.join(__dirname, 'templates');

  constructor() {
    this.ensureReportsDirectory();
    this.registerHandlebarsHelpers();
  }

  private async ensureReportsDirectory(): Promise<void> {
    try {
      await fs.access(this.reportsDir);
    } catch {
      await fs.mkdir(this.reportsDir, { recursive: true });
    }
  }

  private registerHandlebarsHelpers(): void {
    // Currency formatter
    handlebars.registerHelper('currency', (amount: number) => {
      return new Intl.NumberFormat('de-DE', {
        style: 'currency',
        currency: 'EUR',
      }).format(amount);
    });

    // Date formatter
    handlebars.registerHelper('formatDate', (dateStr: string) => {
      const date = new Date(dateStr);
      return new Intl.DateTimeFormat('de-DE', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }).format(date);
    });

    // Percentage formatter
    handlebars.registerHelper('percentage', (value: number) => {
      return `${value.toFixed(1)}%`;
    });

    // Conditional helper for top products
    handlebars.registerHelper('isTopFive', (rank: number) => {
      return rank <= 5;
    });
  }

  public async generate(data: ReportData, request: ReportRequest): Promise<{ filePath: string; fileName: string }> {
    // Generate HTML from template
    const html = await this.generateHtml(data, request);

    // Convert HTML to PDF using Puppeteer
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    try {
      const page = await browser.newPage();
      
      // Set content
      await page.setContent(html, { waitUntil: 'networkidle0' });

      // Generate filename
      const fileName = this.generateFileName(request);
      const filePath = path.join(this.reportsDir, fileName);

      // Generate PDF
      await page.pdf({
        path: filePath,
        format: 'A4',
        printBackground: true,
        margin: {
          top: '20mm',
          right: '20mm',
          bottom: '20mm',
          left: '20mm',
        },
      });

      console.log(`[PdfReportGenerator] Generated report: ${fileName}`);
      return { filePath, fileName };
    } finally {
      await browser.close();
    }
  }

  private async generateHtml(data: ReportData, request: ReportRequest): Promise<string> {
    // For now, we'll use an inline template. In production, this would be loaded from a file
    const template = this.getReportTemplate();
    const compiledTemplate = handlebars.compile(template);

    // Prepare data for template
    const templateData = {
      ...data,
      reportTitle: this.getReportTitle(request.type),
      generatedDate: new Date().toISOString(),
      companyName: 'Bäckerei Heusser',
      companyAddress: 'Musterstraße 123, 12345 Musterstadt',
      hasCharts: request.includeCharts,
      chartData: request.includeCharts ? this.prepareChartData(data) : null,
    };

    return compiledTemplate(templateData);
  }

  private getReportTemplate(): string {
    return `
<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{reportTitle}}</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Arial', sans-serif;
            color: #333;
            line-height: 1.6;
        }
        
        .container {
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
        }
        
        .header {
            text-align: center;
            margin-bottom: 40px;
            border-bottom: 2px solid #8B4513;
            padding-bottom: 20px;
        }
        
        .header h1 {
            color: #8B4513;
            margin-bottom: 10px;
        }
        
        .header .company-info {
            color: #666;
            font-size: 14px;
        }
        
        .header .report-info {
            margin-top: 20px;
            font-size: 14px;
        }
        
        .section {
            margin-bottom: 40px;
        }
        
        .section h2 {
            color: #8B4513;
            margin-bottom: 20px;
            border-bottom: 1px solid #ddd;
            padding-bottom: 10px;
        }
        
        .summary-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 20px;
            margin-bottom: 30px;
        }
        
        .summary-card {
            background: #f5f5f5;
            padding: 20px;
            border-radius: 8px;
            text-align: center;
        }
        
        .summary-card .label {
            color: #666;
            font-size: 14px;
            margin-bottom: 5px;
        }
        
        .summary-card .value {
            font-size: 24px;
            font-weight: bold;
            color: #333;
        }
        
        table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 20px;
        }
        
        th, td {
            text-align: left;
            padding: 12px;
            border-bottom: 1px solid #ddd;
        }
        
        th {
            background-color: #f5f5f5;
            font-weight: bold;
            color: #333;
        }
        
        tr:nth-child(even) {
            background-color: #fafafa;
        }
        
        .top-product {
            background-color: #e8f5e9;
        }
        
        .chart-container {
            margin: 30px 0;
            height: 300px;
            border: 1px solid #ddd;
            border-radius: 8px;
            padding: 20px;
            display: flex;
            align-items: center;
            justify-content: center;
            background-color: #fafafa;
            color: #999;
        }
        
        .footer {
            margin-top: 60px;
            text-align: center;
            font-size: 12px;
            color: #666;
            border-top: 1px solid #ddd;
            padding-top: 20px;
        }
        
        @media print {
            .section {
                page-break-inside: avoid;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>{{reportTitle}}</h1>
            <div class="company-info">
                <strong>{{companyName}}</strong><br>
                {{companyAddress}}
            </div>
            <div class="report-info">
                <strong>Berichtszeitraum:</strong> {{formatDate summary.period.start}} - {{formatDate summary.period.end}}<br>
                <strong>Erstellt am:</strong> {{formatDate generatedDate}}
            </div>
        </div>

        <div class="section">
            <h2>Zusammenfassung</h2>
            <div class="summary-grid">
                <div class="summary-card">
                    <div class="label">Gesamtumsatz</div>
                    <div class="value">{{currency summary.totalRevenue}}</div>
                </div>
                <div class="summary-card">
                    <div class="label">Transaktionen</div>
                    <div class="value">{{summary.totalTransactions}}</div>
                </div>
                <div class="summary-card">
                    <div class="label">Ø Transaktionswert</div>
                    <div class="value">{{currency summary.avgTransactionValue}}</div>
                </div>
                <div class="summary-card">
                    <div class="label">Tage im Zeitraum</div>
                    <div class="value">{{revenueData.length}}</div>
                </div>
            </div>
        </div>

        {{#if hasCharts}}
        <div class="section">
            <h2>Umsatzentwicklung</h2>
            <div class="chart-container">
                <!-- Chart würde hier mit Chart.js oder ähnlichem gerendert werden -->
                Umsatz-Diagramm
            </div>
        </div>
        {{/if}}

        <div class="section">
            <h2>Top Produkte</h2>
            <table>
                <thead>
                    <tr>
                        <th>Rang</th>
                        <th>Produkt</th>
                        <th>Verkaufte Menge</th>
                        <th>Umsatz</th>
                    </tr>
                </thead>
                <tbody>
                    {{#each productPerformance}}
                    <tr {{#if (isTopFive rank)}}class="top-product"{{/if}}>
                        <td>{{rank}}</td>
                        <td>{{productName}}</td>
                        <td>{{quantitySold}}</td>
                        <td>{{currency revenue}}</td>
                    </tr>
                    {{/each}}
                </tbody>
            </table>
        </div>

        <div class="section">
            <h2>Zahlungsmethoden</h2>
            <table>
                <thead>
                    <tr>
                        <th>Zahlungsmethode</th>
                        <th>Anzahl</th>
                        <th>Betrag</th>
                        <th>Anteil</th>
                    </tr>
                </thead>
                <tbody>
                    {{#each paymentMethods}}
                    <tr>
                        <td>{{method}}</td>
                        <td>{{count}}</td>
                        <td>{{currency amount}}</td>
                        <td>{{percentage percentage}}</td>
                    </tr>
                    {{/each}}
                </tbody>
            </table>
        </div>

        {{#if cashierPerformance}}
        <div class="section">
            <h2>Mitarbeiterleistung</h2>
            <table>
                <thead>
                    <tr>
                        <th>Mitarbeiter</th>
                        <th>Transaktionen</th>
                        <th>Umsatz</th>
                        <th>Ø Transaktionswert</th>
                    </tr>
                </thead>
                <tbody>
                    {{#each cashierPerformance}}
                    <tr>
                        <td>{{userName}}</td>
                        <td>{{transactionCount}}</td>
                        <td>{{currency totalRevenue}}</td>
                        <td>{{currency averageTransactionValue}}</td>
                    </tr>
                    {{/each}}
                </tbody>
            </table>
        </div>
        {{/if}}

        <div class="footer">
            <p>Dieser Bericht wurde automatisch generiert.</p>
            <p>© {{companyName}} - Alle Rechte vorbehalten</p>
        </div>
    </div>
</body>
</html>
    `;
  }

  private prepareChartData(data: ReportData): any {
    // Prepare data for charts (would be used by Chart.js or similar)
    return {
      revenue: {
        labels: data.revenueData.map(d => d.date),
        datasets: [{
          label: 'Umsatz',
          data: data.revenueData.map(d => d.revenue),
        }],
      },
      paymentMethods: {
        labels: data.paymentMethods.map(m => m.method),
        data: data.paymentMethods.map(m => m.amount),
      },
    };
  }

  private getReportTitle(type: ReportType): string {
    const titles: Record<ReportType, string> = {
      [ReportType.DAILY_SUMMARY]: 'Täglicher Verkaufsbericht',
      [ReportType.WEEKLY_PERFORMANCE]: 'Wöchentlicher Leistungsbericht',
      [ReportType.MONTHLY_ANALYTICS]: 'Monatlicher Analysebericht',
      [ReportType.CUSTOM_RANGE]: 'Verkaufsbericht',
    };
    return titles[type];
  }

  private generateFileName(request: ReportRequest): string {
    const typeMap: Record<ReportType, string> = {
      [ReportType.DAILY_SUMMARY]: 'Tagesbericht',
      [ReportType.WEEKLY_PERFORMANCE]: 'Wochenbericht',
      [ReportType.MONTHLY_ANALYTICS]: 'Monatsbericht',
      [ReportType.CUSTOM_RANGE]: 'Bericht',
    };

    const reportName = typeMap[request.type];
    const dateStr = new Date().toISOString().split('T')[0];
    return `${reportName}_${dateStr}_${Date.now()}.pdf`;
  }
}