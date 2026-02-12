import { CashFlowEngine } from '../cashflow-engine';
import { BudgetDatabase } from '../database';
import * as path from 'path';
import * as fs from 'fs';

describe('CashFlowEngine', () => {
  let db: BudgetDatabase;
  let engine: CashFlowEngine;
  const dbPath = path.join(__dirname, 'test-cashflow.db');

  beforeEach(() => {
    // Remove existing test database
    if (fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath);
    }

    db = new BudgetDatabase(dbPath);
    engine = new CashFlowEngine(db);
  });

  afterEach(() => {
    db.close();
    if (fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath);
    }
  });

  describe('Date Calculations', () => {
    it('should calculate next occurrence for monthly frequency', () => {
      const currentDate = new Date('2026-01-15');
      const nextDate = engine.calculateNextOccurrence(currentDate, 'monthly');

      expect(nextDate.getTime()).toBe(new Date('2026-02-15').getTime());
    });

    it('should calculate next occurrence for weekly frequency', () => {
      const currentDate = new Date('2026-01-15');
      const nextDate = engine.calculateNextOccurrence(currentDate, 'weekly');

      expect(nextDate.getTime()).toBe(new Date('2026-01-22').getTime());
    });

    it('should calculate next occurrence for daily frequency', () => {
      const currentDate = new Date('2026-01-15');
      const nextDate = engine.calculateNextOccurrence(currentDate, 'daily');

      expect(nextDate.getTime()).toBe(new Date('2026-01-16').getTime());
    });

    it('should calculate next occurrence for yearly frequency', () => {
      const currentDate = new Date('2026-01-15');
      const nextDate = engine.calculateNextOccurrence(currentDate, 'yearly');

      expect(nextDate.getTime()).toBe(new Date('2027-01-15').getTime());
    });
  });

  describe('Recurring Transactions Projection', () => {
    let accountId: string;

    beforeEach(() => {
      const account = db.createAccount({
        name: 'Test Checking',
        type: 'checking',
        institution: 'Test Bank',
        balance: 5000,
        lastSynced: null,
      });
      accountId = account.id;
    });

    it('should project monthly recurring transactions', () => {
      const categories = db.getCategories();
      const salaryCategory = categories.find(c => c.name === 'Salary');

      db.createRecurringItem({
        accountId,
        description: 'Monthly Salary',
        amount: 500000,
        categoryId: salaryCategory!.id,
        frequency: 'monthly',
        startDate: new Date('2026-01-01'),
        endDate: null,
        nextOccurrence: new Date('2026-02-01'),
        itemType: 'cashflow',
        isActive: true,
        enableReminders: false,
        reminderDays: null,
        autopay: false,
        dayOfMonth: 1,
        dayOfWeek: null,
      });

      const projections = engine.projectRecurringTransactions(
        accountId,
        new Date('2026-02-01'),
        new Date('2026-04-30')
      );

      expect(projections.length).toBe(3);
      expect(projections[0].amount).toBe(500000);
      expect(projections[0].date.getTime()).toBe(new Date('2026-02-01').getTime());
      expect(projections[1].date.getTime()).toBe(new Date('2026-03-01').getTime());
      expect(projections[2].date.getTime()).toBe(new Date('2026-04-01').getTime());
    });

    it('should project weekly recurring transactions', () => {
      const categories = db.getCategories();
      const groceryCategory = categories.find(c => c.name === 'Groceries');

      db.createRecurringItem({
        accountId,
        description: 'Weekly Groceries',
        amount: -15000,
        categoryId: groceryCategory!.id,
        frequency: 'weekly',
        startDate: new Date('2026-01-01'),
        endDate: null,
        nextOccurrence: new Date('2026-02-01'),
        itemType: 'cashflow',
        isActive: true,
        enableReminders: false,
        reminderDays: null,
        autopay: false,
        dayOfMonth: null,
        dayOfWeek: null,
      });

      const projections = engine.projectRecurringTransactions(
        accountId,
        new Date('2026-02-01'),
        new Date('2026-02-28')
      );

      expect(projections.length).toBe(4);
      expect(projections.every(p => p.amount === -15000)).toBe(true);
    });

    it('should respect endDate of recurring transaction', () => {
      const categories = db.getCategories();
      const salaryCategory = categories.find(c => c.name === 'Salary');

      db.createRecurringItem({
        accountId,
        description: 'Contract Payment',
        amount: 300000,
        categoryId: salaryCategory!.id,
        frequency: 'monthly',
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-03-01'),
        nextOccurrence: new Date('2026-02-01'),
        itemType: 'cashflow',
        isActive: true,
        enableReminders: false,
        reminderDays: null,
        autopay: false,
        dayOfMonth: 1,
        dayOfWeek: null,
      });

      const projections = engine.projectRecurringTransactions(
        accountId,
        new Date('2026-02-01'),
        new Date('2026-04-30')
      );

      expect(projections.length).toBe(2);
      expect(projections[projections.length - 1].date.getTime()).toBe(new Date('2026-03-01').getTime());
    });

    it('should handle multiple recurring transactions', () => {
      const categories = db.getCategories();
      const salaryCategory = categories.find(c => c.name === 'Salary');
      const rentCategory = categories.find(c => c.name === 'Rent');

      db.createRecurringItem({
        accountId,
        description: 'Monthly Salary',
        amount: 500000,
        categoryId: salaryCategory!.id,
        frequency: 'monthly',
        startDate: new Date('2026-01-01'),
        endDate: null,
        nextOccurrence: new Date('2026-02-01'),
        itemType: 'cashflow',
        isActive: true,
        enableReminders: false,
        reminderDays: null,
        autopay: false,
        dayOfMonth: 1,
        dayOfWeek: null,
      });

      db.createRecurringItem({
        accountId,
        description: 'Rent',
        amount: -150000,
        categoryId: rentCategory!.id,
        frequency: 'monthly',
        startDate: new Date('2026-01-01'),
        endDate: null,
        nextOccurrence: new Date('2026-02-01'),
        itemType: 'bill',
        isActive: true,
        enableReminders: true,
        reminderDays: null,
        autopay: false,
        dayOfMonth: 1,
        dayOfWeek: null,
      });

      const projections = engine.projectRecurringTransactions(
        accountId,
        new Date('2026-02-01'),
        new Date('2026-02-28')
      );

      expect(projections.length).toBe(2);
      const totalChange = projections.reduce((sum, p) => sum + p.amount, 0);
      expect(totalChange).toBe(350000);
    });
  });

  describe('Cash Flow Forecast', () => {
    let accountId: string;

    beforeEach(() => {
      const account = db.createAccount({
        name: 'Test Checking',
        type: 'checking',
        institution: 'Test Bank',
        balance: 5000,
        lastSynced: null,
      });
      accountId = account.id;
    });

    it('should forecast account balance with recurring transactions', () => {
      const categories = db.getCategories();
      const salaryCategory = categories.find(c => c.name === 'Salary');
      const rentCategory = categories.find(c => c.name === 'Rent');

      db.createRecurringItem({
        accountId,
        description: 'Monthly Salary',
        amount: 500000,
        categoryId: salaryCategory!.id,
        frequency: 'monthly',
        startDate: new Date('2026-01-01'),
        endDate: null,
        nextOccurrence: new Date('2026-02-01'),
        itemType: 'cashflow',
        isActive: true,
        enableReminders: false,
        reminderDays: null,
        autopay: false,
        dayOfMonth: 1,
        dayOfWeek: null,
      });

      db.createRecurringItem({
        accountId,
        description: 'Rent',
        amount: -150000,
        categoryId: rentCategory!.id,
        frequency: 'monthly',
        startDate: new Date('2026-01-01'),
        endDate: null,
        nextOccurrence: new Date('2026-02-05'),
        itemType: 'bill',
        isActive: true,
        enableReminders: true,
        reminderDays: null,
        autopay: false,
        dayOfMonth: 5,
        dayOfWeek: null,
      });

      const forecast = engine.forecastCashFlow(
        accountId,
        new Date('2026-02-01'),
        new Date('2026-02-28')
      );

      expect(forecast.startingBalance).toBe(5000);
      expect(forecast.projections.length).toBe(2);

      expect(forecast.projections[0].date.getTime()).toBe(new Date('2026-02-01').getTime());
      expect(forecast.projections[0].balance).toBe(505000);

      expect(forecast.projections[1].date.getTime()).toBe(new Date('2026-02-05').getTime());
      expect(forecast.projections[1].balance).toBe(355000);

      expect(Array.isArray(forecast.warnings)).toBe(true);
    });

    it('should detect when balance goes negative', () => {
      const categories = db.getCategories();
      const rentCategory = categories.find(c => c.name === 'Rent');

      const account = db.createAccount({
        name: 'Low Balance Account',
        type: 'checking',
        institution: 'Test Bank',
        balance: 100000,
        lastSynced: null,
      });

      db.createRecurringItem({
        accountId: account.id,
        description: 'Rent',
        amount: -150000,
        categoryId: rentCategory!.id,
        frequency: 'monthly',
        startDate: new Date('2026-01-01'),
        endDate: null,
        nextOccurrence: new Date('2026-02-01'),
        itemType: 'bill',
        isActive: true,
        enableReminders: true,
        reminderDays: null,
        autopay: false,
        dayOfMonth: 1,
        dayOfWeek: null,
      });

      const forecast = engine.forecastCashFlow(
        account.id,
        new Date('2026-02-01'),
        new Date('2026-02-28')
      );

      expect(forecast.projections.length).toBe(1);
      expect(forecast.projections[0].date.getTime()).toBe(new Date('2026-02-01').getTime());
      expect(forecast.projections[0].balance).toBe(-50000); // 100000 - 150000

      expect(forecast.warnings.length).toBeGreaterThan(0);
      expect(forecast.warnings[0].type).toBe('negative_balance');
    });

    it('should return empty forecast when no recurring transactions exist', () => {
      const forecast = engine.forecastCashFlow(
        accountId,
        new Date('2026-02-01'),
        new Date('2026-02-28')
      );

      expect(forecast.startingBalance).toBe(5000);
      expect(forecast.projections.length).toBe(0);
      expect(forecast.warnings.length).toBe(0);
    });
  });
});
