import { validateDailyReport, validateDailyReports } from './report.validator'
import type { DailyReport } from '@bakery/shared/types'

describe('ReportValidator', () => {
  // Joi.string().isoDate() normalisiert Zeitstempel auf die volle ISO-Form
  // ("...T10:00:00Z" -> "...T10:00:00.000Z"); result.value trägt diese Form.
  const withIsoTimestamps = <
    T extends { transactions: { timestamp: string }[] }
  >(
    report: T
  ): T => ({
    ...report,
    transactions: report.transactions.map((t) => ({
      ...t,
      timestamp: new Date(t.timestamp).toISOString(),
    })),
  })

  describe('validateDailyReport', () => {
    const validReport: DailyReport = {
      date: '2024-01-15',
      register_id: 'REG001',
      report_number: 1,
      company: 'Test Bakery',
      transactions: [
        {
          id: 'TX001',
          timestamp: '2024-01-15T10:00:00Z',
          type: 'sale',
          user: 'john.doe',
          items: [
            {
              product: 'Croissant',
              product_id: '1',
              quantity: 2,
              price: 2.5,
              total: 5.0,
            },
          ],
          total: 5.0,
          payment: 'Bar',
        },
      ],
      daily_summary: {
        total_revenue: 5.0,
        cash_revenue: 5.0,
        transaction_count: 1,
        vat_totals: { '19%': 0.95 },
      },
    }

    it('should validate a correct report', () => {
      const result = validateDailyReport(validReport)
      expect(result.error).toBeUndefined()
      expect(result.value).toEqual(withIsoTimestamps(validReport))
    })

    it('should fail validation for missing required fields', () => {
      const invalidReport = {
        // Missing date
        register_id: 'REG001',
        report_number: 1,
        company: 'Test Bakery',
        transactions: [],
        daily_summary: {
          total_revenue: 0,
          cash_revenue: 0,
          transaction_count: 0,
          vat_totals: {},
        },
      }

      const result = validateDailyReport(invalidReport)
      expect(result.error).toBeDefined()
      expect(result.error?.message).toContain('"date" is required')
    })

    it('should fail validation for invalid date format', () => {
      const invalidReport = {
        ...validReport,
        date: '15-01-2024', // Wrong format
      }

      const result = validateDailyReport(invalidReport)
      expect(result.error).toBeDefined()
      expect(result.error?.message).toContain(
        'fails to match the required pattern'
      )
    })

    it('should fail validation for invalid transaction type', () => {
      const invalidReport = {
        ...validReport,
        transactions: [
          {
            ...validReport.transactions[0],
            type: 'invalid-type' as any,
          },
        ],
      }

      const result = validateDailyReport(invalidReport)
      expect(result.error).toBeDefined()
      expect(result.error?.message).toContain(
        'must be one of [sale, refund, adjustment]'
      )
    })

    it('should fail validation for empty transaction items', () => {
      const invalidReport = {
        ...validReport,
        transactions: [
          {
            ...validReport.transactions[0],
            items: [], // Empty items
          },
        ],
      }

      const result = validateDailyReport(invalidReport)
      expect(result.error).toBeDefined()
      expect(result.error?.message).toContain('must contain at least 1 items')
    })

    it('should fail validation for negative quantities', () => {
      const invalidReport = {
        ...validReport,
        transactions: [
          {
            ...validReport.transactions[0],
            items: [
              {
                product: 'Croissant',
                product_id: '1',
                quantity: -1, // Negative quantity
                price: 2.5,
                total: -2.5,
              },
            ],
          },
        ],
      }

      const result = validateDailyReport(invalidReport)
      expect(result.error).toBeDefined()
      expect(result.error?.message).toContain('must be a positive number')
    })

    it('should validate optional fields', () => {
      const reportWithOptionals = {
        ...validReport,
        user_performance: [
          {
            user: 'john.doe',
            transaction_count: 5,
            total_revenue: 50.0,
            average_transaction: 10.0,
          },
        ],
        product_performance: [
          {
            product_id: '1',
            product_name: 'Croissant',
            quantity_sold: 10,
            total_revenue: 25.0,
          },
        ],
      }

      const result = validateDailyReport(reportWithOptionals)
      expect(result.error).toBeUndefined()
      expect(result.value).toEqual(withIsoTimestamps(reportWithOptionals))
    })

    it('should strip unknown fields', () => {
      const reportWithExtra = {
        ...validReport,
        unknownField: 'should be removed',
        transactions: [
          {
            ...validReport.transactions[0],
            extraField: 'also removed',
          },
        ],
      }

      const result = validateDailyReport(reportWithExtra)
      expect(result.error).toBeUndefined()
      expect(result.value).not.toHaveProperty('unknownField')
      expect(result.value?.transactions[0]).not.toHaveProperty('extraField')
    })

    it('should validate VAT totals with various percentages', () => {
      const reportWithVat = {
        ...validReport,
        daily_summary: {
          ...validReport.daily_summary,
          vat_totals: {
            '0%': 10.0,
            '7%': 20.0,
            '19%': 30.0,
            '25%': 40.0, // Custom VAT rate
          },
        },
      }

      const result = validateDailyReport(reportWithVat)
      expect(result.error).toBeUndefined()
    })
  })

  describe('validateDailyReports', () => {
    const validReports: DailyReport[] = [
      {
        date: '2024-01-15',
        register_id: 'REG001',
        report_number: 1,
        company: 'Test Bakery',
        transactions: [],
        daily_summary: {
          total_revenue: 0,
          cash_revenue: 0,
          transaction_count: 0,
          vat_totals: {},
        },
      },
      {
        date: '2024-01-16',
        register_id: 'REG001',
        report_number: 2,
        company: 'Test Bakery',
        transactions: [],
        daily_summary: {
          total_revenue: 0,
          cash_revenue: 0,
          transaction_count: 0,
          vat_totals: {},
        },
      },
    ]

    it('should validate array of reports', () => {
      const result = validateDailyReports(validReports)
      expect(result.error).toBeUndefined()
      expect(result.value).toHaveLength(2)
    })

    it('should fail if any report is invalid', () => {
      const invalidReports = [
        validReports[0],
        {
          // Missing required fields
          date: '2024-01-16',
        },
      ]

      const result = validateDailyReports(invalidReports)
      expect(result.error).toBeDefined()
    })

    it('should handle empty array', () => {
      const result = validateDailyReports([])
      expect(result.error).toBeUndefined()
      expect(result.value).toEqual([])
    })
  })
})
