import { parseCSV } from '../csv-parser';
import * as fs from 'fs';
import * as path from 'path';

describe('CSV Parser', () => {
  const testFilesDir = path.join(__dirname, 'test-files');

  beforeAll(() => {
    // Create test files directory
    if (!fs.existsSync(testFilesDir)) {
      fs.mkdirSync(testFilesDir, { recursive: true });
    }
  });

  afterAll(() => {
    // Clean up test files
    if (fs.existsSync(testFilesDir)) {
      fs.readdirSync(testFilesDir).forEach(file => {
        fs.unlinkSync(path.join(testFilesDir, file));
      });
      fs.rmdirSync(testFilesDir);
    }
  });

  describe('Standard CSV Format', () => {
    it('should parse CSV with standard headers', () => {
      const csvContent = `Date,Description,Amount
2026-01-15,Grocery Store,-50.00
2026-01-16,Salary Deposit,2000.00
2026-01-17,Coffee Shop,-5.50`;

      const csvPath = path.join(testFilesDir, 'standard.csv');
      fs.writeFileSync(csvPath, csvContent);

      const result = parseCSV(csvPath);

      expect(result.success).toBe(true);
      expect(result.transactions.length).toBe(3);
      expect(result.transactions[0]).toMatchObject({
        date: new Date('2026-01-15'),
        description: 'Grocery Store',
        amount: -50.00,
      });
      expect(result.transactions[1]).toMatchObject({
        date: new Date('2026-01-16'),
        description: 'Salary Deposit',
        amount: 2000.00,
      });
    });

    it('should handle CSV with optional category column', () => {
      const csvContent = `Date,Description,Amount,Category
2026-01-15,Grocery Store,-50.00,Groceries
2026-01-16,Gas Station,-40.00,Transportation`;

      const csvPath = path.join(testFilesDir, 'with-category.csv');
      fs.writeFileSync(csvPath, csvContent);

      const result = parseCSV(csvPath);

      expect(result.success).toBe(true);
      expect(result.transactions.length).toBe(2);
      expect(result.transactions[0].category).toBe('Groceries');
      expect(result.transactions[1].category).toBe('Transportation');
    });

    it('should handle different date formats', () => {
      const csvContent = `Date,Description,Amount
01/15/2026,Format 1,-50.00
2026-01-16,Format 2,-40.00
15-Jan-2026,Format 3,-30.00`;

      const csvPath = path.join(testFilesDir, 'date-formats.csv');
      fs.writeFileSync(csvPath, csvContent);

      const result = parseCSV(csvPath);

      expect(result.success).toBe(true);
      expect(result.transactions.length).toBe(3);
      expect(result.transactions[0].date.getMonth()).toBe(0); // January
      expect(result.transactions[0].date.getDate()).toBe(15);
    });
  });

  describe('Alternative Delimiters', () => {
    it('should parse CSV with semicolon delimiter', () => {
      const csvContent = `Date;Description;Amount
2026-01-15;Grocery Store;-50.00
2026-01-16;Coffee Shop;-5.50`;

      const csvPath = path.join(testFilesDir, 'semicolon.csv');
      fs.writeFileSync(csvPath, csvContent);

      const result = parseCSV(csvPath);

      expect(result.success).toBe(true);
      expect(result.transactions.length).toBe(2);
    });

    it('should parse CSV with tab delimiter', () => {
      const csvContent = `Date\tDescription\tAmount
2026-01-15\tGrocery Store\t-50.00
2026-01-16\tCoffee Shop\t-5.50`;

      const csvPath = path.join(testFilesDir, 'tab.csv');
      fs.writeFileSync(csvPath, csvContent);

      const result = parseCSV(csvPath);

      expect(result.success).toBe(true);
      expect(result.transactions.length).toBe(2);
    });
  });

  describe('Error Handling', () => {
    it('should return error for missing required columns', () => {
      const csvContent = `Date,Description
2026-01-15,Grocery Store
2026-01-16,Coffee Shop`;

      const csvPath = path.join(testFilesDir, 'missing-amount.csv');
      fs.writeFileSync(csvPath, csvContent);

      const result = parseCSV(csvPath);

      expect(result.success).toBe(false);
      expect(result.error).toContain('required');
    });

    it('should return error for non-existent file', () => {
      const result = parseCSV('/non/existent/file.csv');

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should skip invalid rows but parse valid ones', () => {
      const csvContent = `Date,Description,Amount
2026-01-15,Valid Row,-50.00
invalid-date,Invalid Row,-40.00
2026-01-17,Another Valid,-30.00`;

      const csvPath = path.join(testFilesDir, 'with-invalid.csv');
      fs.writeFileSync(csvPath, csvContent);

      const result = parseCSV(csvPath);

      expect(result.success).toBe(true);
      expect(result.transactions.length).toBe(2);
      expect(result.skipped).toBe(1);
    });

    it('should handle empty file', () => {
      const csvPath = path.join(testFilesDir, 'empty.csv');
      fs.writeFileSync(csvPath, '');

      const result = parseCSV(csvPath);

      expect(result.success).toBe(false);
      expect(result.error).toContain('empty');
    });
  });

  describe('Data Validation', () => {
    it('should handle positive and negative amounts correctly', () => {
      const csvContent = `Date,Description,Amount
2026-01-15,Expense,-50.00
2026-01-16,Income,2000.00
2026-01-17,Expense with +,-30.00`;

      const csvPath = path.join(testFilesDir, 'amounts.csv');
      fs.writeFileSync(csvPath, csvContent);

      const result = parseCSV(csvPath);

      expect(result.success).toBe(true);
      expect(result.transactions[0].amount).toBe(-50.00);
      expect(result.transactions[1].amount).toBe(2000.00);
      expect(result.transactions[2].amount).toBe(-30.00);
    });

    it('should trim whitespace from fields', () => {
      const csvContent = `Date,Description,Amount
  2026-01-15  ,  Grocery Store  ,  -50.00  `;

      const csvPath = path.join(testFilesDir, 'whitespace.csv');
      fs.writeFileSync(csvPath, csvContent);

      const result = parseCSV(csvPath);

      expect(result.success).toBe(true);
      expect(result.transactions[0].description).toBe('Grocery Store');
    });
  });

  describe('Bank-Specific Formats', () => {
    it('should parse Wells Fargo headerless CSV format', () => {
      // Wells Fargo format: "Date","Amount","*","","Description"
      const csvContent = `"01/16/2026","-2.00","*","","SAVE AS YOU GO TRANSFER DEBIT TO XXXXXXXXXXX8671"
"01/15/2026","-50.00","*","","GROCERY STORE PURCHASE"
"01/14/2026","1500.00","*","","DIRECT DEPOSIT PAYROLL"`;

      const csvPath = path.join(testFilesDir, 'wells-fargo.csv');
      fs.writeFileSync(csvPath, csvContent);

      const result = parseCSV(csvPath);

      expect(result.success).toBe(true);
      expect(result.transactions.length).toBe(3);
      expect(result.transactions[0]).toMatchObject({
        description: 'SAVE AS YOU GO TRANSFER DEBIT TO XXXXXXXXXXX8671',
        amount: -2.00,
      });
      expect(result.transactions[0].date.getMonth()).toBe(0); // January
      expect(result.transactions[0].date.getDate()).toBe(16);
      expect(result.transactions[1].amount).toBe(-50.00);
      expect(result.transactions[2].amount).toBe(1500.00);
    });

    it('should parse Chase CSV format', () => {
      // Chase format: "Transaction Date","Post Date","Description","Category","Type","Amount","Memo"
      const csvContent = `"Transaction Date","Post Date","Description","Category","Type","Amount","Memo"
"01/15/2026","01/16/2026","AMAZON","Shopping","Sale","-25.00",""
"01/14/2026","01/15/2026","STARBUCKS","Food & Drink","Sale","-5.50",""`;

      const csvPath = path.join(testFilesDir, 'chase.csv');
      fs.writeFileSync(csvPath, csvContent);

      const result = parseCSV(csvPath);

      expect(result.success).toBe(true);
      expect(result.transactions.length).toBe(2);
      expect(result.transactions[0]).toMatchObject({
        description: 'AMAZON',
        amount: -25.00,
        category: 'Shopping',
      });
      expect(result.transactions[1]).toMatchObject({
        description: 'STARBUCKS',
        amount: -5.50,
        category: 'Food & Drink',
      });
    });
  });
});
