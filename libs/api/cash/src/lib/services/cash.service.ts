/**
 * Cash service - business logic for cash entry management
 */

import { 
  CashEntry, 
  CreateCashEntryInput, 
  UpdateCashEntryInput, 
  CashEntryFilters,
  CashStatistics,
  CASH_VALIDATION,
  CASH_ERROR_MESSAGES
} from '../models/cash.model';

export class CashService {
  private cashEntries: Map<number, CashEntry> = new Map();
  private nextId = 1;

  constructor() {
    // Initialize with sample data
    this.initializeSampleData();
  }

  /**
   * Validate amount value
   */
  private validateAmount(amount: number): boolean {
    return typeof amount === 'number' && 
           amount >= CASH_VALIDATION.MIN_AMOUNT && 
           amount <= CASH_VALIDATION.MAX_AMOUNT;
  }

  /**
   * Validate date format (YYYY-MM-DD)
   */
  private validateDateFormat(date: string): boolean {
    return CASH_VALIDATION.DATE_FORMAT.test(date);
  }

  /**
   * Get current date in YYYY-MM-DD format
   */
  private getCurrentDate(): string {
    return new Date().toISOString().split('T')[0];
  }

  /**
   * Filter entries by user and optional criteria
   */
  private filterEntries(userId: number, filters?: CashEntryFilters): CashEntry[] {
    let entries = Array.from(this.cashEntries.values())
      .filter(entry => entry.userId === userId);

    // Apply date filters
    if (filters?.startDate) {
      entries = entries.filter(entry => entry.date >= filters.startDate!);
    }

    if (filters?.endDate) {
      entries = entries.filter(entry => entry.date <= filters.endDate!);
    }

    // Sort by date (newest first) then by creation time
    entries.sort((a, b) => {
      const dateCompare = b.date.localeCompare(a.date);
      if (dateCompare !== 0) return dateCompare;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    // Apply pagination
    if (filters?.offset !== undefined && filters?.limit !== undefined) {
      entries = entries.slice(filters.offset, filters.offset + filters.limit);
    }

    return entries;
  }

  /**
   * Create a new cash entry
   */
  async createCashEntry(input: CreateCashEntryInput, userId: number): Promise<CashEntry> {
    // Validate amount
    if (!this.validateAmount(input.amount)) {
      throw new Error(CASH_ERROR_MESSAGES.INVALID_AMOUNT);
    }

    // Validate date if provided
    const date = input.date || this.getCurrentDate();
    if (!this.validateDateFormat(date)) {
      throw new Error(CASH_ERROR_MESSAGES.INVALID_DATE_FORMAT);
    }

    // Validate notes length
    if (input.notes && input.notes.length > CASH_VALIDATION.MAX_NOTES_LENGTH) {
      throw new Error(CASH_ERROR_MESSAGES.NOTES_TOO_LONG);
    }

    const now = new Date().toISOString();
    
    const cashEntry: CashEntry = {
      id: this.nextId++,
      amount: input.amount,
      date,
      userId,
      notes: input.notes,
      createdAt: now,
      updatedAt: now
    };

    this.cashEntries.set(cashEntry.id, cashEntry);

    return cashEntry;
  }

  /**
   * Get cash entries for a user
   */
  async getCashEntries(userId: number, filters?: CashEntryFilters): Promise<CashEntry[]> {
    return this.filterEntries(userId, filters);
  }

  /**
   * Get cash entry by ID (user-scoped)
   */
  async getCashEntryById(id: number, userId: number): Promise<CashEntry | null> {
    const entry = this.cashEntries.get(id);
    if (!entry || entry.userId !== userId) {
      return null;
    }
    return entry;
  }

  /**
   * Update a cash entry
   */
  async updateCashEntry(id: number, input: UpdateCashEntryInput, userId: number): Promise<CashEntry | null> {
    const entry = await this.getCashEntryById(id, userId);
    if (!entry) {
      return null;
    }

    // Validate amount if provided
    if (input.amount !== undefined && !this.validateAmount(input.amount)) {
      throw new Error(CASH_ERROR_MESSAGES.INVALID_AMOUNT);
    }

    // Validate date if provided
    if (input.date !== undefined && !this.validateDateFormat(input.date)) {
      throw new Error(CASH_ERROR_MESSAGES.INVALID_DATE_FORMAT);
    }

    // Validate notes length if provided
    if (input.notes !== undefined && input.notes.length > CASH_VALIDATION.MAX_NOTES_LENGTH) {
      throw new Error(CASH_ERROR_MESSAGES.NOTES_TOO_LONG);
    }

    // Apply updates
    if (input.amount !== undefined) entry.amount = input.amount;
    if (input.date !== undefined) entry.date = input.date;
    if (input.notes !== undefined) entry.notes = input.notes;
    
    entry.updatedAt = new Date().toISOString();

    return entry;
  }

  /**
   * Delete a cash entry
   */
  async deleteCashEntry(id: number, userId: number): Promise<boolean> {
    const entry = await this.getCashEntryById(id, userId);
    if (!entry) {
      return false;
    }

    return this.cashEntries.delete(id);
  }

  /**
   * Get cash statistics for a user
   */
  async getCashStatistics(userId: number, filters?: CashEntryFilters): Promise<CashStatistics> {
    const entries = this.filterEntries(userId, {
      startDate: filters?.startDate,
      endDate: filters?.endDate
    });

    // Calculate statistics
    const totalAmount = entries.reduce((sum, entry) => sum + entry.amount, 0);
    const averageAmount = entries.length > 0 ? totalAmount / entries.length : 0;
    const entryCount = entries.length;
    
    // Get latest entry (sorted by date desc, so first is latest)
    const latestEntry = entries.length > 0 ? entries[0] : null;

    return {
      totalAmount,
      averageAmount: Math.round(averageAmount * 100) / 100, // Round to 2 decimal places
      entryCount,
      latestEntry: latestEntry ? {
        amount: latestEntry.amount,
        date: latestEntry.date
      } : null,
      dateRange: {
        startDate: filters?.startDate || (entries.length > 0 ? entries[entries.length - 1].date : null),
        endDate: filters?.endDate || (entries.length > 0 ? entries[0].date : null)
      }
    };
  }

  /**
   * Initialize with sample data
   */
  private initializeSampleData() {
    const sampleData: (CreateCashEntryInput & { userId: number })[] = [
      {
        amount: 1250.50,
        date: '2025-01-15',
        userId: 1,
        notes: 'Guter Verkaufstag'
      },
      {
        amount: 980.75,
        date: '2025-01-14',
        userId: 1,
        notes: 'Normaler Wochentag'
      },
      {
        amount: 1580.25,
        date: '2025-01-13',
        userId: 1,
        notes: 'Wochenende - viele Kunden'
      },
      {
        amount: 750.00,
        date: '2025-01-12',
        userId: 2,
        notes: 'Schlechtes Wetter'
      },
      {
        amount: 1125.80,
        date: '2025-01-11',
        userId: 2,
        notes: 'Neue Produktlinie eingeführt'
      }
    ];

    for (const entry of sampleData) {
      this.createCashEntry(entry, entry.userId);
    }
  }
}

// Export singleton instance
export const cashService = new CashService();