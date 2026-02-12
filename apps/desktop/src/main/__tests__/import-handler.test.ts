import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { BudgetDatabase } from '../database';
import { importTransactionsFromCSV, importTransactionsFromFile } from '../import-handler';

describe('Import Handler', () => {
  let db: BudgetDatabase;
  let testDbPath: string;
  let testCsvPath: string;

  beforeEach(() => {
    // Create a temporary database
    testDbPath = path.join(__dirname, 'test-import.db');
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
    db = new BudgetDatabase(testDbPath);

    // Create a test CSV file
    testCsvPath = path.join(__dirname, 'test-import.csv');
    const csvContent = `Date,Description,Amount
2026-01-15,Grocery Store,-50.00
2026-01-14,Salary,2000.00
2026-01-13,Coffee Shop,-5.50`;
    fs.writeFileSync(testCsvPath, csvContent);
  });

  afterEach(() => {
    db.close();
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
    if (fs.existsSync(testCsvPath)) {
      fs.unlinkSync(testCsvPath);
    }
  });

  describe('importTransactionsFromCSV', () => {
    it('should import transactions from CSV file into account', async () => {
      // Create an account
      const account = db.createAccount({
        name: 'Test Checking',
        type: 'checking',
        institution: 'Test Bank',
        balance: 1000,
        lastSynced: null,
      });

      // Import transactions
      const result = await importTransactionsFromCSV(db, account.id, testCsvPath);

      // Verify result
      expect(result.success).toBe(true);
      expect(result.imported).toBe(3);
      expect(result.duplicates).toBe(0);
      expect(result.errors).toBe(0);

      // Verify transactions were saved to database
      const transactions = db.getTransactionsByAccount(account.id);
      expect(transactions).toHaveLength(3);

      // Verify transaction details
      expect(transactions[0].description).toBe('Grocery Store');
      expect(transactions[0].amount).toBe(-5000);
      expect(transactions[1].description).toBe('Salary');
      expect(transactions[1].amount).toBe(200000);
      expect(transactions[2].description).toBe('Coffee Shop');
      expect(transactions[2].amount).toBe(-550);
    });

    it('should detect duplicate transactions', async () => {
      // Create an account
      const account = db.createAccount({
        name: 'Test Checking',
        type: 'checking',
        institution: 'Test Bank',
        balance: 1000,
        lastSynced: null,
      });

      // Import once
      await importTransactionsFromCSV(db, account.id, testCsvPath);

      // Import again (should detect duplicates)
      const result = await importTransactionsFromCSV(db, account.id, testCsvPath);

      expect(result.success).toBe(true);
      expect(result.imported).toBe(0);
      expect(result.duplicates).toBe(3);
      expect(result.errors).toBe(0);

      // Should still only have 3 transactions
      const transactions = db.getTransactionsByAccount(account.id);
      expect(transactions).toHaveLength(3);
    });

    it('should handle invalid CSV file', async () => {
      const account = db.createAccount({
        name: 'Test Checking',
        type: 'checking',
        institution: 'Test Bank',
        balance: 1000,
        lastSynced: null,
      });

      const result = await importTransactionsFromCSV(db, account.id, '/nonexistent/file.csv');

      expect(result.success).toBe(false);
      expect(result.imported).toBe(0);
      expect(result.error).toBeDefined();
    });

    it('should assign uncategorized category to transactions without category', async () => {
      const account = db.createAccount({
        name: 'Test Checking',
        type: 'checking',
        institution: 'Test Bank',
        balance: 1000,
        lastSynced: null,
      });

      await importTransactionsFromCSV(db, account.id, testCsvPath);

      const transactions = db.getTransactionsByAccount(account.id);
      const uncategorizedCategory = db.getCategories().find(c => c.name === 'Uncategorized');

      expect(uncategorizedCategory).toBeDefined();
      transactions.forEach(t => {
        expect(t.categoryId).toBe(uncategorizedCategory!.id);
      });
    });

    describe('importTransactionsFromFile', () => {
      let tempDir: string;
      let testOfxPath: string;

      beforeEach(() => {
        tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'import-test-'));

        // Create a test OFX file
        const ofxContent = `OFXHEADER:100
DATA:OFXSGML
VERSION:102

<OFX>
<BANKMSGSRSV1>
<STMTTRNRS>
<STMTRS>
<BANKTRANLIST>
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20260115120000
<TRNAMT>-75.00
<FITID>TXN001
<NAME>WALMART SUPERCENTER
</STMTTRN>
<STMTTRN>
<TRNTYPE>CREDIT
<DTPOSTED>20260110120000
<TRNAMT>3000.00
<FITID>TXN002
<NAME>PAYROLL DEPOSIT
</STMTTRN>
</BANKTRANLIST>
</STMTRS>
</STMTTRNRS>
</BANKMSGSRSV1>
</OFX>`;
        testOfxPath = path.join(tempDir, 'test-import.ofx');
        fs.writeFileSync(testOfxPath, ofxContent);
      });

      afterEach(() => {
        if (fs.existsSync(tempDir)) {
          fs.rmSync(tempDir, { recursive: true, force: true });
        }
      });

      it('should import transactions from OFX file', async () => {
        const account = db.createAccount({
          name: 'Test Checking',
          type: 'checking',
          institution: 'Test Bank',
          balance: 1000,
          lastSynced: null,
          });

        const result = await importTransactionsFromFile(db, account.id, testOfxPath);

        expect(result.success).toBe(true);
        expect(result.imported).toBe(2);
        expect(result.duplicates).toBe(0);

        const transactions = db.getTransactionsByAccount(account.id);
        expect(transactions).toHaveLength(2);
        expect(transactions[0].description).toBe('WALMART SUPERCENTER');
        expect(transactions[0].amount).toBe(-7500);
        expect(transactions[1].description).toBe('PAYROLL DEPOSIT');
        expect(transactions[1].amount).toBe(300000);
      });

      it('should import transactions from QFX file', async () => {
        const qfxPath = path.join(tempDir, 'test-import.qfx');
        fs.copyFileSync(testOfxPath, qfxPath); // QFX same format as OFX

        const account = db.createAccount({
          name: 'Test Checking',
          type: 'checking',
          institution: 'Test Bank',
          balance: 1000,
          lastSynced: null,
          });

        const result = await importTransactionsFromFile(db, account.id, qfxPath);

        expect(result.success).toBe(true);
        expect(result.imported).toBe(2);
      });

      it('should import transactions from CSV file via importTransactionsFromFile', async () => {
        const account = db.createAccount({
          name: 'Test Checking',
          type: 'checking',
          institution: 'Test Bank',
          balance: 1000,
          lastSynced: null,
          });

        const result = await importTransactionsFromFile(db, account.id, testCsvPath);

        expect(result.success).toBe(true);
        expect(result.imported).toBe(3);
      });

      it('should return error for unsupported file format', async () => {
        const account = db.createAccount({
          name: 'Test Checking',
          type: 'checking',
          institution: 'Test Bank',
          balance: 1000,
          lastSynced: null,
          });

        const unsupportedPath = path.join(tempDir, 'test.txt');
        fs.writeFileSync(unsupportedPath, 'some text');

        const result = await importTransactionsFromFile(db, account.id, unsupportedPath);

        expect(result.success).toBe(false);
        expect(result.error).toContain('Unsupported file format');
      });

      it('should detect duplicates in OFX imports', async () => {
        const account = db.createAccount({
          name: 'Test Checking',
          type: 'checking',
          institution: 'Test Bank',
          balance: 1000,
          lastSynced: null,
          });

        // Import once
        await importTransactionsFromFile(db, account.id, testOfxPath);

        // Import again (should detect duplicates)
        const result = await importTransactionsFromFile(db, account.id, testOfxPath);

        expect(result.success).toBe(true);
        expect(result.imported).toBe(0);
        expect(result.duplicates).toBe(2);

        // Should still only have 2 transactions
        const transactions = db.getTransactionsByAccount(account.id);
        expect(transactions).toHaveLength(2);
      });
    });
  });
});
