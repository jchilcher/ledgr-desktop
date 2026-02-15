import { ForecastEngine } from '../forecast-engine';
import { BudgetDatabase } from '../database';
import * as path from 'path';
import * as fs from 'fs';

describe('ForecastEngine', () => {
  let db: BudgetDatabase;
  let engine: ForecastEngine;
  const dbPath = path.join(__dirname, 'test-forecast.db');

  beforeEach(() => {
    // Remove existing test database
    if (fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath);
    }

    db = new BudgetDatabase(dbPath);
    engine = new ForecastEngine({
      getTransactions: () => db.getTransactions(),
      getCategories: () => db.getCategories(),
    });
  });

  afterEach(() => {
    db.close();
    if (fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath);
    }
  });

  describe('Linear Regression', () => {
    it('should calculate linear regression coefficients', () => {
      const dataPoints = [
        { x: 1, y: 100 },
        { x: 2, y: 150 },
        { x: 3, y: 200 },
        { x: 4, y: 250 },
        { x: 5, y: 300 },
      ];

      const result = engine.calculateLinearRegression(dataPoints);

      expect(result!.slope).toBeCloseTo(50, 1); // ~50 increase per unit
      expect(result!.intercept).toBeCloseTo(50, 1); // ~50 at x=0
      expect(result!.rSquared).toBeGreaterThan(0.99); // Perfect fit
    });

    it('should handle flat trends', () => {
      const dataPoints = [
        { x: 1, y: 100 },
        { x: 2, y: 100 },
        { x: 3, y: 100 },
        { x: 4, y: 100 },
      ];

      const result = engine.calculateLinearRegression(dataPoints);

      expect(result!.slope).toBeCloseTo(0, 1);
      expect(result!.intercept).toBeCloseTo(100, 1);
    });

    it('should return null for insufficient data points', () => {
      const dataPoints = [{ x: 1, y: 100 }];

      const result = engine.calculateLinearRegression(dataPoints);

      expect(result).toBeNull();
    });
  });

  describe('Spending Forecast', () => {
    it('should forecast future spending based on historical data', async () => {
      // Create an account
      const account = await db.createAccount({
        name: 'Test Account',
        type: 'checking',
        institution: 'Test Bank',
        balance: 5000,
      });

      const groceryCategory = db.getCategories().find(c => c.name === 'Groceries');

      // Create transactions over the past 90 days with increasing spending trend
      const today = new Date();
      for (let i = 90; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);

        await db.createTransaction({
          accountId: account.id,
          date,
          description: 'Grocery purchase',
          amount: -100 - (90 - i) * 0.5, // Increasing spending trend (more negative over time)
          categoryId: groceryCategory!.id,
          importSource: 'file',
          isRecurring: false,
        });
      }

      const forecast = await engine.forecastSpending(30);

      expect(forecast).toBeDefined();
      expect(forecast!.period).toBe(30);
      expect(forecast!.projectedSpending).toBeGreaterThan(0);
      expect(forecast!.confidence).toBeGreaterThan(0);
      expect(forecast!.confidence).toBeLessThanOrEqual(1);
      expect(forecast!.historicalAverage).toBeGreaterThan(0);
      expect(forecast!.trend).toBe('increasing');
    });

    it('should detect decreasing spending trend', async () => {
      const account = await db.createAccount({
        name: 'Test Account',
        type: 'checking',
        institution: 'Test Bank',
        balance: 5000,
      });

      const groceryCategory = db.getCategories().find(c => c.name === 'Groceries');

      // Create transactions with decreasing spending trend
      const today = new Date();
      for (let i = 60; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);

        await db.createTransaction({
          accountId: account.id,
          date,
          description: 'Grocery purchase',
          amount: -200 + (60 - i) * 1, // Decreasing spending (less negative over time)
          categoryId: groceryCategory!.id,
          importSource: 'file',
          isRecurring: false,
        });
      }

      const forecast = await engine.forecastSpending(30);

      expect(forecast!.trend).toBe('decreasing');
    });

    it('should detect stable spending trend', async () => {
      const account = await db.createAccount({
        name: 'Test Account',
        type: 'checking',
        institution: 'Test Bank',
        balance: 5000,
      });

      const groceryCategory = db.getCategories().find(c => c.name === 'Groceries');

      // Create transactions with stable spending
      const today = new Date();
      for (let i = 60; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);

        await db.createTransaction({
          accountId: account.id,
          date,
          description: 'Grocery purchase',
          amount: -150 + Math.random() * 10, // Stable with small variance
          categoryId: groceryCategory!.id,
          importSource: 'file',
          isRecurring: false,
        });
      }

      const forecast = await engine.forecastSpending(30);

      expect(forecast!.trend).toBe('stable');
    });

    it('should return null when insufficient historical data', async () => {
      const account = await db.createAccount({
        name: 'Test Account',
        type: 'checking',
        institution: 'Test Bank',
        balance: 5000,
      });

      const groceryCategory = db.getCategories().find(c => c.name === 'Groceries');

      // Create only 2 transactions
      await db.createTransaction({
        accountId: account.id,
        date: new Date('2024-01-01'),
        description: 'Grocery purchase',
        amount: -100,
        categoryId: groceryCategory!.id,
        importSource: 'file',
          isRecurring: false,
      });

      await db.createTransaction({
        accountId: account.id,
        date: new Date('2024-01-05'),
        description: 'Grocery purchase',
        amount: -120,
        categoryId: groceryCategory!.id,
        importSource: 'file',
          isRecurring: false,
      });

      const forecast = await engine.forecastSpending(30);

      expect(forecast).toBeNull();
    });

    it('should support configurable history window', async () => {
      const account = await db.createAccount({
        name: 'Test Account',
        type: 'checking',
        institution: 'Test Bank',
        balance: 5000,
      });

      const groceryCategory = db.getCategories().find(c => c.name === 'Groceries');

      // Create 180 days of transactions
      const today = new Date();
      for (let i = 180; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);

        await db.createTransaction({
          accountId: account.id,
          date,
          description: 'Grocery purchase',
          amount: -100,
          categoryId: groceryCategory!.id,
          importSource: 'file',
          isRecurring: false,
        });
      }

      // Test with 90-day history window
      const forecast90 = await engine.forecastSpending(30, 90);
      expect(forecast90).toBeDefined();

      // Test with 180-day history window
      const forecast180 = await engine.forecastSpending(30, 180);
      expect(forecast180).toBeDefined();
    });
  });

  describe('Multiple Period Forecasts', () => {
    it('should generate forecasts for 30/60/90 day periods', async () => {
      const account = await db.createAccount({
        name: 'Test Account',
        type: 'checking',
        institution: 'Test Bank',
        balance: 5000,
      });

      const groceryCategory = db.getCategories().find(c => c.name === 'Groceries');

      // Create 120 days of transactions
      const today = new Date();
      for (let i = 120; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);

        await db.createTransaction({
          accountId: account.id,
          date,
          description: 'Grocery purchase',
          amount: -100,
          categoryId: groceryCategory!.id,
          importSource: 'file',
          isRecurring: false,
        });
      }

      const forecasts = await engine.generateMultiPeriodForecasts([30, 60, 90]);

      expect(forecasts).toHaveLength(3);
      expect(forecasts[0].period).toBe(30);
      expect(forecasts[1].period).toBe(60);
      expect(forecasts[2].period).toBe(90);

      // 60-day forecast should be roughly 2x the 30-day forecast
      expect(forecasts[1].projectedSpending).toBeGreaterThan(forecasts[0].projectedSpending);
      expect(forecasts[2].projectedSpending).toBeGreaterThan(forecasts[1].projectedSpending);
    });
  });

  describe('Category-Based Forecasting', () => {
    it('should forecast spending for a specific category', async () => {
      const account = await db.createAccount({
        name: 'Test Account',
        type: 'checking',
        institution: 'Test Bank',
        balance: 5000,
      });

      const groceryCategory = db.getCategories().find(c => c.name === 'Groceries');

      // Create 30 days of grocery transactions
      const today = new Date();
      for (let i = 30; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);

        await db.createTransaction({
          accountId: account.id,
          date,
          description: 'Grocery purchase',
          amount: -100,
          categoryId: groceryCategory!.id,
          importSource: 'file',
          isRecurring: false,
        });
      }

      const forecast = await engine.forecastCategorySpending(groceryCategory!.id, 30);

      expect(forecast).not.toBeNull();
      expect(forecast!.categoryId).toBe(groceryCategory!.id);
      expect(forecast!.period).toBe(30);
      expect(forecast!.projectedSpending).toBeGreaterThan(0);
      expect(forecast!.confidence).toBeGreaterThanOrEqual(0);
      expect(forecast!.confidence).toBeLessThanOrEqual(1);
      expect(forecast!.transactionCount).toBeGreaterThan(0);
    });

    it('should return null for categories with insufficient data', async () => {
      const account = await db.createAccount({
        name: 'Test Account',
        type: 'checking',
        institution: 'Test Bank',
        balance: 5000,
      });

      const groceryCategory = db.getCategories().find(c => c.name === 'Groceries');

      // Create only 3 days of transactions (not enough)
      const today = new Date();
      for (let i = 3; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);

        await db.createTransaction({
          accountId: account.id,
          date,
          description: 'Grocery purchase',
          amount: -50,
          categoryId: groceryCategory!.id,
          importSource: 'file',
          isRecurring: false,
        });
      }

      const forecast = await engine.forecastCategorySpending(groceryCategory!.id, 30);

      expect(forecast).toBeNull();
    });

    it('should detect seasonality in category spending', async () => {
      const account = await db.createAccount({
        name: 'Test Account',
        type: 'checking',
        institution: 'Test Bank',
        balance: 5000,
      });

      const groceryCategory = db.getCategories().find(c => c.name === 'Groceries');

      // Create 90 days with increasing trend (seasonality > 1)
      const today = new Date();
      for (let i = 90; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);

        // Lower spending in first half, higher in second half
        const amount = i > 45 ? -80 : -120;

        await db.createTransaction({
          accountId: account.id,
          date,
          description: 'Grocery purchase',
          amount,
          categoryId: groceryCategory!.id,
          importSource: 'file',
          isRecurring: false,
        });
      }

      const forecast = await engine.forecastCategorySpending(groceryCategory!.id, 30);

      expect(forecast).not.toBeNull();
      expect(forecast!.seasonalityFactor).not.toBe(1);
      expect(forecast!.seasonalityFactor).toBeGreaterThan(1); // Increasing seasonality
    });

    it('should generate forecasts for all categories', async () => {
      const account = await db.createAccount({
        name: 'Test Account',
        type: 'checking',
        institution: 'Test Bank',
        balance: 5000,
      });

      const groceryCategory = db.getCategories().find(c => c.name === 'Groceries');
      const diningCategory = db.getCategories().find(c => c.name === 'Dining Out');

      const today = new Date();

      // Add grocery transactions
      for (let i = 30; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);

        await db.createTransaction({
          accountId: account.id,
          date,
          description: 'Grocery purchase',
          amount: -100,
          categoryId: groceryCategory!.id,
          importSource: 'file',
          isRecurring: false,
        });
      }

      // Add dining transactions
      for (let i = 30; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);

        await db.createTransaction({
          accountId: account.id,
          date,
          description: 'Restaurant',
          amount: -50,
          categoryId: diningCategory!.id,
          importSource: 'file',
          isRecurring: false,
        });
      }

      const forecasts = await engine.forecastAllCategories(30);

      expect(forecasts.length).toBeGreaterThanOrEqual(2);

      const groceryForecast = forecasts.find(f => f.categoryId === groceryCategory!.id);
      const diningForecast = forecasts.find(f => f.categoryId === diningCategory!.id);

      expect(groceryForecast).toBeDefined();
      expect(diningForecast).toBeDefined();

      // Groceries should have higher projected spending than dining (100 vs 50)
      expect(groceryForecast!.projectedSpending).toBeGreaterThan(diningForecast!.projectedSpending);
    });

    it('should only forecast expense categories', async () => {
      const account = await db.createAccount({
        name: 'Test Account',
        type: 'checking',
        institution: 'Test Bank',
        balance: 5000,
      });

      const salaryCategory = db.getCategories().find(c => c.name === 'Salary');
      const groceryCategory = db.getCategories().find(c => c.name === 'Groceries');

      const today = new Date();

      // Add income transactions (should be ignored)
      for (let i = 30; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);

        await db.createTransaction({
          accountId: account.id,
          date,
          description: 'Salary payment',
          amount: 3000,
          categoryId: salaryCategory!.id,
          importSource: 'file',
          isRecurring: false,
        });
      }

      // Add expense transactions
      for (let i = 30; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);

        await db.createTransaction({
          accountId: account.id,
          date,
          description: 'Grocery purchase',
          amount: -100,
          categoryId: groceryCategory!.id,
          importSource: 'file',
          isRecurring: false,
        });
      }

      const forecasts = await engine.forecastAllCategories(30);

      // Should only have grocery forecast, not salary
      const salaryForecast = forecasts.find(f => f.categoryId === salaryCategory!.id);
      const groceryForecast = forecasts.find(f => f.categoryId === groceryCategory!.id);

      expect(salaryForecast).toBeUndefined(); // Income category should not be forecasted
      expect(groceryForecast).toBeDefined(); // Expense category should be forecasted
    });
  });
});
