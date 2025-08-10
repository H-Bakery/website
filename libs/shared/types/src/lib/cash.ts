/**
 * @fileoverview Cash management types
 * @module @bakery/shared/types/cash
 */

export interface CashEntry {
  id: number
  UserId: number
  amount: number
  date: string
  createdAt: string
  updatedAt: string
}

export interface CreateCashEntryInput {
  amount: number
  date: string
  UserId?: number
}

export interface UpdateCashEntryInput {
  amount?: number
  date?: string
}

export interface CashFilters {
  startDate?: string
  endDate?: string
  UserId?: number
}

export interface CashSummary {
  total: number
  count: number
  average: number
  period: string
}

export interface MonthlyCashSummary {
  month: string
  year: number
  totalRevenue: number
  entriesCount: number
  dailyAverage: number
  weeklyBreakdown: WeeklyCashSummary[]
}

export interface WeeklyCashSummary {
  week: number
  total: number
  entries: number
}

export interface DailyCashSummary {
  date: string
  total: number
  entries: CashEntry[]
}