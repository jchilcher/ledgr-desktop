import { BudgetDatabase } from './database';
import {
  CashFlowEngine as CoreCashFlowEngine,
  ProjectedTransaction,
  CashFlowWarning,
  BalanceProjection,
  CashFlowForecast,
  RecurringFrequency,
  RecurringTransaction,
} from '@ledgr/core';

// Re-export types from core
export { ProjectedTransaction, CashFlowWarning, BalanceProjection, CashFlowForecast };

export class CashFlowEngine {
  private coreEngine: CoreCashFlowEngine;

  constructor(private db: BudgetDatabase) {
    this.coreEngine = new CoreCashFlowEngine({
      getAccountById: (id: string) => this.db.getAccountById(id),
      // Use the unified recurring_items table instead of legacy recurring_transactions
      // This ensures consistency with BillCalendar/CashFlowOptimizationEngine
      getRecurringTransactionsByAccount: (accountId: string): RecurringTransaction[] => {
        const items = this.db.getRecurringItemsByAccount(accountId);
        // Map RecurringItem to RecurringTransaction format
        return items
          .filter(item => item.isActive)
          .map(item => ({
            id: item.id,
            accountId: accountId,
            description: item.description,
            amount: item.amount,
            categoryId: item.categoryId,
            frequency: item.frequency,
            startDate: item.startDate,
            endDate: item.endDate,
            nextOccurrence: item.nextOccurrence,
          }));
      },
    });
  }

  /**
   * Calculate the next occurrence date based on frequency
   * Uses UTC to avoid timezone issues
   */
  calculateNextOccurrence(currentDate: Date, frequency: RecurringFrequency): Date {
    return this.coreEngine.calculateNextOccurrence(currentDate, frequency);
  }

  /**
   * Project all recurring transactions for an account within a date range
   */
  projectRecurringTransactions(
    accountId: string,
    startDate: Date,
    endDate: Date
  ): ProjectedTransaction[] {
    return this.coreEngine.projectRecurringTransactions(accountId, startDate, endDate);
  }

  /**
   * Forecast account balance over time with recurring transactions
   */
  forecastCashFlow(accountId: string, startDate: Date, endDate: Date): CashFlowForecast {
    return this.coreEngine.forecastCashFlow(accountId, startDate, endDate);
  }
}
