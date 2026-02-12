import { BudgetDatabase } from './database';
import {
  ForecastEngine as CoreForecastEngine,
  DataPoint,
  LinearRegressionResult,
  SpendingForecast,
  CategorySpendingForecast,
  excludeTransfers,
} from '@ledgr/core';

// Re-export types from core
export { DataPoint, LinearRegressionResult, SpendingForecast, CategorySpendingForecast };

export class ForecastEngine {
  private coreEngine: CoreForecastEngine;

  constructor(private db: BudgetDatabase) {
    this.coreEngine = new CoreForecastEngine({
      getTransactions: () => excludeTransfers(this.db.getTransactions()),
      getCategories: () => this.db.getCategories(),
    });
  }

  /**
   * Calculate linear regression coefficients from data points
   * Returns null if insufficient data points (need at least 2)
   */
  calculateLinearRegression(dataPoints: DataPoint[]): LinearRegressionResult | null {
    return this.coreEngine.calculateLinearRegression(dataPoints);
  }

  /**
   * Forecast spending for a future period based on historical data
   */
  async forecastSpending(
    forecastDays: number,
    historyDays: number = 90
  ): Promise<SpendingForecast | null> {
    return this.coreEngine.forecastSpending(forecastDays, historyDays);
  }

  /**
   * Generate forecasts for multiple periods
   */
  async generateMultiPeriodForecasts(periods: number[]): Promise<SpendingForecast[]> {
    return this.coreEngine.generateMultiPeriodForecasts(periods);
  }

  /**
   * Forecast spending for a specific category
   */
  async forecastCategorySpending(
    categoryId: string,
    forecastDays: number,
    historyDays: number = 90
  ): Promise<CategorySpendingForecast | null> {
    return this.coreEngine.forecastCategorySpending(categoryId, forecastDays, historyDays);
  }

  /**
   * Generate category forecasts for all categories with sufficient data
   */
  async forecastAllCategories(
    forecastDays: number = 30,
    historyDays: number = 90
  ): Promise<CategorySpendingForecast[]> {
    return this.coreEngine.forecastAllCategories(forecastDays, historyDays);
  }
}
