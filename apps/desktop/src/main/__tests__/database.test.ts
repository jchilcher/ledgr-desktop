import { BudgetDatabase } from '../database';
import { Account, Transaction, Category } from '../../shared/types';
import * as fs from 'fs';
import * as path from 'path';

describe('Database', () => {
  let db: BudgetDatabase;
  const testDbPath = path.join(__dirname, 'test.db');

  beforeEach(() => {
    // Remove test database if it exists
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
    db = new BudgetDatabase(testDbPath);
  });

  afterEach(() => {
    db.close();
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });

  describe('Initialization', () => {
    it('should create database file', () => {
      expect(fs.existsSync(testDbPath)).toBe(true);
    });

    it('should create default categories', () => {
      const categories = db.getCategories();
      expect(categories.length).toBeGreaterThan(0);
      expect(categories.some(c => c.name === 'Salary')).toBe(true);
      expect(categories.some(c => c.name === 'Groceries')).toBe(true);
    });
  });

  describe('Account Operations', () => {
    it('should create an account', () => {
      const account: Omit<Account, 'id' | 'createdAt'> = {
        name: 'Test Checking',
        type: 'checking',
        institution: 'Test Bank',
        balance: 1000,
        lastSynced: null,
      };

      const created = db.createAccount(account);
      expect(created.id).toBeDefined();
      expect(created.name).toBe('Test Checking');
      expect(created.balance).toBe(1000);
      expect(created.createdAt).toBeInstanceOf(Date);
    });

    it('should get all accounts', () => {
      db.createAccount({
        name: 'Account 1',
        type: 'checking',
        institution: 'Bank 1',
        balance: 1000,
        lastSynced: null,
      });

      db.createAccount({
        name: 'Account 2',
        type: 'savings',
        institution: 'Bank 2',
        balance: 5000,
        lastSynced: null,
      });

      const accounts = db.getAccounts();
      expect(accounts.length).toBe(2);
    });

    it('should get account by id', () => {
      const account = db.createAccount({
        name: 'Test Account',
        type: 'checking',
        institution: 'Test Bank',
        balance: 1000,
        lastSynced: null,
      });

      const retrieved = db.getAccountById(account.id);
      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(account.id);
      expect(retrieved?.name).toBe('Test Account');
    });

    it('should update an account', () => {
      const account = db.createAccount({
        name: 'Test Account',
        type: 'checking',
        institution: 'Test Bank',
        balance: 1000,
        lastSynced: null,
      });

      const updated = db.updateAccount(account.id, {
        name: 'Updated Account',
        balance: 2000,
      });

      expect(updated?.name).toBe('Updated Account');
      expect(updated?.balance).toBe(2000);
    });

    it('should delete an account', () => {
      const account = db.createAccount({
        name: 'Test Account',
        type: 'checking',
        institution: 'Test Bank',
        balance: 1000,
        lastSynced: null,
      });

      const deleted = db.deleteAccount(account.id);
      expect(deleted).toBe(true);

      const retrieved = db.getAccountById(account.id);
      expect(retrieved).toBeNull();
    });
  });

  describe('Transaction Operations', () => {
    let accountId: string;

    beforeEach(() => {
      const account = db.createAccount({
        name: 'Test Account',
        type: 'checking',
        institution: 'Test Bank',
        balance: 1000,
        lastSynced: null,
      });
      accountId = account.id;
    });

    it('should create a transaction', () => {
      const transaction: Omit<Transaction, 'id' | 'createdAt'> = {
        accountId,
        date: new Date('2026-01-15'),
        description: 'Test Purchase',
        amount: -50.00,
        categoryId: null,
        isRecurring: false,
        importSource: 'file',
      };

      const created = db.createTransaction(transaction);
      expect(created.id).toBeDefined();
      expect(created.description).toBe('Test Purchase');
      expect(created.amount).toBe(-50.00);
    });

    it('should get transactions by account', () => {
      db.createTransaction({
        accountId,
        date: new Date('2026-01-15'),
        description: 'Transaction 1',
        amount: -25.00,
        categoryId: null,
        isRecurring: false,
        importSource: 'file',
      });

      db.createTransaction({
        accountId,
        date: new Date('2026-01-16'),
        description: 'Transaction 2',
        amount: -35.00,
        categoryId: null,
        isRecurring: false,
        importSource: 'file',
      });

      const transactions = db.getTransactionsByAccount(accountId);
      expect(transactions.length).toBe(2);
    });

    it('should get all transactions', () => {
      db.createTransaction({
        accountId,
        date: new Date('2026-01-15'),
        description: 'Transaction 1',
        amount: -25.00,
        categoryId: null,
        isRecurring: false,
        importSource: 'file',
      });

      const transactions = db.getTransactions();
      expect(transactions.length).toBe(1);
    });

    it('should update a transaction', () => {
      const transaction = db.createTransaction({
        accountId,
        date: new Date('2026-01-15'),
        description: 'Test Transaction',
        amount: -25.00,
        categoryId: null,
        isRecurring: false,
        importSource: 'file',
      });

      const category = db.getCategories().find(c => c.name === 'Groceries');

      const updated = db.updateTransaction(transaction.id, {
        categoryId: category!.id,
        description: 'Updated Transaction',
      });

      expect(updated?.description).toBe('Updated Transaction');
      expect(updated?.categoryId).toBe(category!.id);
    });

    it('should delete a transaction', () => {
      const transaction = db.createTransaction({
        accountId,
        date: new Date('2026-01-15'),
        description: 'Test Transaction',
        amount: -25.00,
        categoryId: null,
        isRecurring: false,
        importSource: 'file',
      });

      const deleted = db.deleteTransaction(transaction.id);
      expect(deleted).toBe(true);

      const transactions = db.getTransactions();
      expect(transactions.length).toBe(0);
    });
  });

  describe('Category Operations', () => {
    it('should create a custom category', () => {
      const category: Omit<Category, 'id'> = {
        name: 'Custom Category',
        type: 'expense',
        icon: '🎯',
        color: '#FF5733',
        isDefault: false,
        parentId: null,
      };

      const created = db.createCategory(category);
      expect(created.id).toBeDefined();
      expect(created.name).toBe('Custom Category');
      expect(created.isDefault).toBe(false);
    });

    it('should get all categories', () => {
      const categories = db.getCategories();
      expect(categories.length).toBeGreaterThan(0);
    });

    it('should get category by id', () => {
      const categories = db.getCategories();
      const firstCategory = categories[0];

      const retrieved = db.getCategoryById(firstCategory.id);
      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(firstCategory.id);
    });

    it('should update a category', () => {
      const category = db.createCategory({
        name: 'Test Category',
        type: 'expense',
        isDefault: false,
        parentId: null,
      });

      const updated = db.updateCategory(category.id, {
        name: 'Updated Category',
        color: '#00FF00',
      });

      expect(updated?.name).toBe('Updated Category');
      expect(updated?.color).toBe('#00FF00');
    });

    it('should delete a custom category', () => {
      const category = db.createCategory({
        name: 'Test Category',
        type: 'expense',
        isDefault: false,
        parentId: null,
      });

      const deleted = db.deleteCategory(category.id);
      expect(deleted).toBe(true);

      const retrieved = db.getCategoryById(category.id);
      expect(retrieved).toBeNull();
    });

    it('should delete a default category', () => {
      const categories = db.getCategories();
      const defaultCategory = categories.find(c => c.isDefault);

      const deleted = db.deleteCategory(defaultCategory!.id);
      expect(deleted).toBe(true);

      const retrieved = db.getCategoryById(defaultCategory!.id);
      expect(retrieved).toBeNull();
    });
  });

  describe('Analytics Operations', () => {
    let accountId: string;

    beforeEach(() => {
      const account = db.createAccount({
        name: 'Test Analytics Account',
        type: 'checking',
        institution: 'Test Bank',
        balance: 1000,
        lastSynced: null,
      });
      accountId = account.id;
    });

    it('should get spending by category', () => {
      const categories = db.getCategories();
      const groceryCategory = categories.find(c => c.name === 'Groceries');
      const diningCategory = categories.find(c => c.name === 'Dining Out');

      // Create some expense transactions
      db.createTransaction({
        accountId,
        date: new Date('2026-01-15'),
        description: 'Grocery Store',
        amount: -150.00,
        categoryId: groceryCategory!.id,
        isRecurring: false,
        importSource: 'file',
      });

      db.createTransaction({
        accountId,
        date: new Date('2026-01-16'),
        description: 'Restaurant',
        amount: -45.50,
        categoryId: diningCategory!.id,
        isRecurring: false,
        importSource: 'file',
      });

      db.createTransaction({
        accountId,
        date: new Date('2026-01-17'),
        description: 'Another Grocery Store',
        amount: -75.25,
        categoryId: groceryCategory!.id,
        isRecurring: false,
        importSource: 'file',
      });

      // Create an income transaction (should be excluded)
      db.createTransaction({
        accountId,
        date: new Date('2026-01-17'),
        description: 'Salary',
        amount: 3000.00,
        categoryId: null,
        isRecurring: false,
        importSource: 'file',
      });

      const spending = db.getSpendingByCategory();

      expect(spending.length).toBe(2);

      const grocerySpending = spending.find(s => s.categoryName === 'Groceries');
      expect(grocerySpending?.total).toBe(225.25);
      expect(grocerySpending?.count).toBe(2);

      const diningSpending = spending.find(s => s.categoryName === 'Dining Out');
      expect(diningSpending?.total).toBe(45.50);
      expect(diningSpending?.count).toBe(1);
    });

    it('should filter spending by date range', () => {
      const categories = db.getCategories();
      const groceryCategory = categories.find(c => c.name === 'Groceries');

      db.createTransaction({
        accountId,
        date: new Date('2026-01-10'),
        description: 'Grocery Store 1',
        amount: -100.00,
        categoryId: groceryCategory!.id,
        isRecurring: false,
        importSource: 'file',
      });

      db.createTransaction({
        accountId,
        date: new Date('2026-01-20'),
        description: 'Grocery Store 2',
        amount: -150.00,
        categoryId: groceryCategory!.id,
        isRecurring: false,
        importSource: 'file',
      });

      db.createTransaction({
        accountId,
        date: new Date('2026-01-30'),
        description: 'Grocery Store 3',
        amount: -200.00,
        categoryId: groceryCategory!.id,
        isRecurring: false,
        importSource: 'file',
      });

      const spending = db.getSpendingByCategory(
        new Date('2026-01-15'),
        new Date('2026-01-25')
      );

      expect(spending.length).toBe(1);
      expect(spending[0].total).toBe(150.00);
      expect(spending[0].count).toBe(1);
    });

    it('should return empty array when no spending exists', () => {
      const spending = db.getSpendingByCategory();
      expect(spending).toEqual([]);
    });

    it('should get income vs expenses over time with monthly grouping', () => {
      const categories = db.getCategories();
      const salaryCategory = categories.find(c => c.name === 'Salary');
      const groceryCategory = categories.find(c => c.name === 'Groceries');

      // January 2026 - income and expenses
      db.createTransaction({
        accountId,
        date: new Date('2026-01-05'),
        description: 'Paycheck',
        amount: 3000.00,
        categoryId: salaryCategory!.id,
        isRecurring: false,
        importSource: 'file',
      });

      db.createTransaction({
        accountId,
        date: new Date('2026-01-10'),
        description: 'Groceries',
        amount: -200.00,
        categoryId: groceryCategory!.id,
        isRecurring: false,
        importSource: 'file',
      });

      db.createTransaction({
        accountId,
        date: new Date('2026-01-15'),
        description: 'More Groceries',
        amount: -150.00,
        categoryId: groceryCategory!.id,
        isRecurring: false,
        importSource: 'file',
      });

      // February 2026 - income and expenses
      db.createTransaction({
        accountId,
        date: new Date('2026-02-05'),
        description: 'Paycheck',
        amount: 3000.00,
        categoryId: salaryCategory!.id,
        isRecurring: false,
        importSource: 'file',
      });

      db.createTransaction({
        accountId,
        date: new Date('2026-02-10'),
        description: 'Groceries',
        amount: -250.00,
        categoryId: groceryCategory!.id,
        isRecurring: false,
        importSource: 'file',
      });

      const data = db.getIncomeVsExpensesOverTime('month');

      expect(data.length).toBeGreaterThanOrEqual(2);

      const jan2026 = data.find(d => d.period === '2026-01');
      expect(jan2026).toBeDefined();
      expect(jan2026?.income).toBe(3000.00);
      expect(jan2026?.expenses).toBe(350.00);
      expect(jan2026?.net).toBe(2650.00);

      const feb2026 = data.find(d => d.period === '2026-02');
      expect(feb2026).toBeDefined();
      expect(feb2026?.income).toBe(3000.00);
      expect(feb2026?.expenses).toBe(250.00);
      expect(feb2026?.net).toBe(2750.00);
    });

    it('should get income vs expenses over time with weekly grouping', () => {
      const categories = db.getCategories();
      const salaryCategory = categories.find(c => c.name === 'Salary');
      const groceryCategory = categories.find(c => c.name === 'Groceries');

      // Week 1 of 2026
      db.createTransaction({
        accountId,
        date: new Date('2026-01-02'),
        description: 'Paycheck',
        amount: 1000.00,
        categoryId: salaryCategory!.id,
        isRecurring: false,
        importSource: 'file',
      });

      db.createTransaction({
        accountId,
        date: new Date('2026-01-03'),
        description: 'Groceries',
        amount: -100.00,
        categoryId: groceryCategory!.id,
        isRecurring: false,
        importSource: 'file',
      });

      // Week 2 of 2026
      db.createTransaction({
        accountId,
        date: new Date('2026-01-09'),
        description: 'More Groceries',
        amount: -150.00,
        categoryId: groceryCategory!.id,
        isRecurring: false,
        importSource: 'file',
      });

      const data = db.getIncomeVsExpensesOverTime('week');

      expect(data.length).toBeGreaterThanOrEqual(2);

      // Check that we have different weeks
      const periods = data.map(d => d.period);
      const uniquePeriods = new Set(periods);
      expect(uniquePeriods.size).toBeGreaterThanOrEqual(2);

      // Check that totals are correct
      const totalIncome = data.reduce((sum, d) => sum + d.income, 0);
      const totalExpenses = data.reduce((sum, d) => sum + d.expenses, 0);
      expect(totalIncome).toBe(1000.00);
      expect(totalExpenses).toBe(250.00);
    });

    it('should get income vs expenses over time with yearly grouping', () => {
      const categories = db.getCategories();
      const salaryCategory = categories.find(c => c.name === 'Salary');
      const groceryCategory = categories.find(c => c.name === 'Groceries');

      // 2025
      db.createTransaction({
        accountId,
        date: new Date('2025-06-15'),
        description: 'Paycheck',
        amount: 10000.00,
        categoryId: salaryCategory!.id,
        isRecurring: false,
        importSource: 'file',
      });

      db.createTransaction({
        accountId,
        date: new Date('2025-07-20'),
        description: 'Groceries',
        amount: -1000.00,
        categoryId: groceryCategory!.id,
        isRecurring: false,
        importSource: 'file',
      });

      // 2026
      db.createTransaction({
        accountId,
        date: new Date('2026-01-15'),
        description: 'Paycheck',
        amount: 12000.00,
        categoryId: salaryCategory!.id,
        isRecurring: false,
        importSource: 'file',
      });

      db.createTransaction({
        accountId,
        date: new Date('2026-02-20'),
        description: 'Groceries',
        amount: -1500.00,
        categoryId: groceryCategory!.id,
        isRecurring: false,
        importSource: 'file',
      });

      const data = db.getIncomeVsExpensesOverTime('year');

      expect(data.length).toBeGreaterThanOrEqual(2);

      const year2025 = data.find(d => d.period === '2025');
      expect(year2025).toBeDefined();
      expect(year2025?.income).toBe(10000.00);
      expect(year2025?.expenses).toBe(1000.00);
      expect(year2025?.net).toBe(9000.00);

      const year2026 = data.find(d => d.period === '2026');
      expect(year2026).toBeDefined();
      expect(year2026?.income).toBe(12000.00);
      expect(year2026?.expenses).toBe(1500.00);
      expect(year2026?.net).toBe(10500.00);
    });

    it('should filter income vs expenses by date range', () => {
      const categories = db.getCategories();
      const salaryCategory = categories.find(c => c.name === 'Salary');
      const groceryCategory = categories.find(c => c.name === 'Groceries');

      db.createTransaction({
        accountId,
        date: new Date('2026-01-05'),
        description: 'Paycheck',
        amount: 3000.00,
        categoryId: salaryCategory!.id,
        isRecurring: false,
        importSource: 'file',
      });

      db.createTransaction({
        accountId,
        date: new Date('2026-01-15'),
        description: 'Groceries',
        amount: -200.00,
        categoryId: groceryCategory!.id,
        isRecurring: false,
        importSource: 'file',
      });

      db.createTransaction({
        accountId,
        date: new Date('2026-02-05'),
        description: 'Paycheck',
        amount: 3000.00,
        categoryId: salaryCategory!.id,
        isRecurring: false,
        importSource: 'file',
      });

      db.createTransaction({
        accountId,
        date: new Date('2026-02-15'),
        description: 'Groceries',
        amount: -250.00,
        categoryId: groceryCategory!.id,
        isRecurring: false,
        importSource: 'file',
      });

      // Filter to only January 2026
      const data = db.getIncomeVsExpensesOverTime(
        'month',
        new Date('2026-01-01'),
        new Date('2026-01-31')
      );

      expect(data.length).toBe(1);
      expect(data[0].period).toBe('2026-01');
      expect(data[0].income).toBe(3000.00);
      expect(data[0].expenses).toBe(200.00);
      expect(data[0].net).toBe(2800.00);
    });

    it('should return empty array when no transactions exist', () => {
      const data = db.getIncomeVsExpensesOverTime('month');
      expect(data).toEqual([]);
    });

    it('should get spending trends by category over time', () => {
      const categories = db.getCategories();
      const groceryCategory = categories.find(c => c.name === 'Groceries');
      const diningCategory = categories.find(c => c.name === 'Dining Out');

      // Create transactions across multiple months for the same categories
      db.createTransaction({
        accountId,
        date: new Date('2026-01-15'),
        description: 'Grocery Store Jan',
        amount: -150.00,
        categoryId: groceryCategory!.id,
        isRecurring: false,
        importSource: 'file',
      });

      db.createTransaction({
        accountId,
        date: new Date('2026-02-15'),
        description: 'Grocery Store Feb',
        amount: -175.00,
        categoryId: groceryCategory!.id,
        isRecurring: false,
        importSource: 'file',
      });

      db.createTransaction({
        accountId,
        date: new Date('2026-01-20'),
        description: 'Restaurant Jan',
        amount: -45.00,
        categoryId: diningCategory!.id,
        isRecurring: false,
        importSource: 'file',
      });

      db.createTransaction({
        accountId,
        date: new Date('2026-02-20'),
        description: 'Restaurant Feb',
        amount: -60.00,
        categoryId: diningCategory!.id,
        isRecurring: false,
        importSource: 'file',
      });

      const results = db.getCategoryTrendsOverTime([groceryCategory!.id, diningCategory!.id], 'month');

      expect(results.length).toBeGreaterThan(0);

      // Should have trends for both categories
      const groceryTrends = results.filter(r => r.categoryId === groceryCategory!.id);
      const diningTrends = results.filter(r => r.categoryId === diningCategory!.id);

      expect(groceryTrends.length).toBe(2); // Jan and Feb
      expect(diningTrends.length).toBe(2); // Jan and Feb

      // Verify increasing trend for groceries
      expect(groceryTrends[1].total).toBeGreaterThan(groceryTrends[0].total);
    });

    it('should filter category trends by date range', () => {
      const categories = db.getCategories();
      const groceryCategory = categories.find(c => c.name === 'Groceries');

      db.createTransaction({
        accountId,
        date: new Date('2026-01-15'),
        description: 'Grocery Jan',
        amount: -100.00,
        categoryId: groceryCategory!.id,
        isRecurring: false,
        importSource: 'file',
      });

      db.createTransaction({
        accountId,
        date: new Date('2026-02-15'),
        description: 'Grocery Feb',
        amount: -150.00,
        categoryId: groceryCategory!.id,
        isRecurring: false,
        importSource: 'file',
      });

      db.createTransaction({
        accountId,
        date: new Date('2026-03-15'),
        description: 'Grocery Mar',
        amount: -120.00,
        categoryId: groceryCategory!.id,
        isRecurring: false,
        importSource: 'file',
      });

      // Filter to only February
      const results = db.getCategoryTrendsOverTime(
        [groceryCategory!.id],
        'month',
        new Date('2026-02-01'),
        new Date('2026-02-28')
      );

      expect(results.length).toBe(1);
      expect(results[0].period).toContain('2026-02');
      expect(results[0].total).toBe(150.00);
    });

    it('should return empty array when no transactions match category trend criteria', () => {
      const categories = db.getCategories();
      const groceryCategory = categories.find(c => c.name === 'Groceries');

      const results = db.getCategoryTrendsOverTime([groceryCategory!.id], 'month');

      expect(results).toEqual([]);
    });
  });

  describe('RecurringTransaction Operations', () => {
    let accountId: string;

    beforeEach(() => {
      const account = db.createAccount({
        name: 'Test Checking',
        type: 'checking',
        institution: 'Test Bank',
        balance: 1000,
        lastSynced: null,
      });
      accountId = account.id;
    });

    it('should create a recurring transaction', () => {
      const categories = db.getCategories();
      const salaryCategory = categories.find(c => c.name === 'Salary');

      const recurringTx = db.createRecurringTransaction({
        accountId,
        description: 'Monthly Salary',
        amount: 5000.00,
        categoryId: salaryCategory!.id,
        frequency: 'monthly',
        startDate: new Date('2026-01-01'),
        endDate: null,
        nextOccurrence: new Date('2026-02-01'),
      });

      expect(recurringTx.id).toBeDefined();
      expect(recurringTx.description).toBe('Monthly Salary');
      expect(recurringTx.amount).toBe(5000.00);
      expect(recurringTx.frequency).toBe('monthly');
    });

    it('should get all recurring transactions', () => {
      const categories = db.getCategories();
      const salaryCategory = categories.find(c => c.name === 'Salary');

      db.createRecurringTransaction({
        accountId,
        description: 'Monthly Salary',
        amount: 5000.00,
        categoryId: salaryCategory!.id,
        frequency: 'monthly',
        startDate: new Date('2026-01-01'),
        endDate: null,
        nextOccurrence: new Date('2026-02-01'),
      });

      const recurringTxs = db.getRecurringTransactions();
      expect(recurringTxs.length).toBe(1);
      expect(recurringTxs[0].description).toBe('Monthly Salary');
    });

    it('should get recurring transactions by account', () => {
      const categories = db.getCategories();
      const salaryCategory = categories.find(c => c.name === 'Salary');

      // Create second account
      const account2 = db.createAccount({
        name: 'Second Account',
        type: 'savings',
        institution: 'Test Bank',
        balance: 500,
        lastSynced: null,
      });

      db.createRecurringTransaction({
        accountId,
        description: 'Salary Account 1',
        amount: 5000.00,
        categoryId: salaryCategory!.id,
        frequency: 'monthly',
        startDate: new Date('2026-01-01'),
        endDate: null,
        nextOccurrence: new Date('2026-02-01'),
      });

      db.createRecurringTransaction({
        accountId: account2.id,
        description: 'Salary Account 2',
        amount: 3000.00,
        categoryId: salaryCategory!.id,
        frequency: 'monthly',
        startDate: new Date('2026-01-01'),
        endDate: null,
        nextOccurrence: new Date('2026-02-01'),
      });

      const recurringTxs = db.getRecurringTransactionsByAccount(accountId);
      expect(recurringTxs.length).toBe(1);
      expect(recurringTxs[0].description).toBe('Salary Account 1');
    });

    it('should update a recurring transaction', () => {
      const categories = db.getCategories();
      const salaryCategory = categories.find(c => c.name === 'Salary');

      const recurringTx = db.createRecurringTransaction({
        accountId,
        description: 'Monthly Salary',
        amount: 5000.00,
        categoryId: salaryCategory!.id,
        frequency: 'monthly',
        startDate: new Date('2026-01-01'),
        endDate: null,
        nextOccurrence: new Date('2026-02-01'),
      });

      db.updateRecurringTransaction(recurringTx.id, {
        amount: 5500.00,
        nextOccurrence: new Date('2026-03-01'),
      });

      const updated = db.getRecurringTransactionById(recurringTx.id);
      expect(updated?.amount).toBe(5500.00);
      expect(updated?.nextOccurrence.getTime()).toBe(new Date('2026-03-01').getTime());
    });

    it('should delete a recurring transaction', () => {
      const categories = db.getCategories();
      const salaryCategory = categories.find(c => c.name === 'Salary');

      const recurringTx = db.createRecurringTransaction({
        accountId,
        description: 'Monthly Salary',
        amount: 5000.00,
        categoryId: salaryCategory!.id,
        frequency: 'monthly',
        startDate: new Date('2026-01-01'),
        endDate: null,
        nextOccurrence: new Date('2026-02-01'),
      });

      db.deleteRecurringTransaction(recurringTx.id);

      const deleted = db.getRecurringTransactionById(recurringTx.id);
      expect(deleted).toBeNull();
    });
  });
});
