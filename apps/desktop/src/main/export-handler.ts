import { dialog } from 'electron';
import * as fs from 'fs';
import { BudgetDatabase } from './database';
import { Transaction, Category, Account, Tag } from '../shared/types';

export interface ExportOptions {
  format: 'csv' | 'json';
  includeCategories?: boolean;
  includeTags?: boolean;
  accountId?: string;
  startDate?: Date;
  endDate?: Date;
}

export interface ExportResult {
  success: boolean;
  filePath?: string;
  recordCount?: number;
  error?: string;
}

export class ExportHandler {
  constructor(private db: BudgetDatabase) {}

  async exportTransactions(options: ExportOptions): Promise<ExportResult> {
    try {
      // Get transactions
      let transactions: Transaction[];
      if (options.accountId) {
        transactions = this.db.getTransactionsByAccount(options.accountId);
      } else {
        transactions = this.db.getTransactions();
      }

      // Filter by date range
      if (options.startDate) {
        transactions = transactions.filter(t => t.date >= options.startDate!);
      }
      if (options.endDate) {
        transactions = transactions.filter(t => t.date <= options.endDate!);
      }

      if (transactions.length === 0) {
        return { success: false, error: 'No transactions to export' };
      }

      // Get categories for lookup
      const categories = this.db.getCategories();
      const categoryMap = new Map(categories.map(c => [c.id, c]));

      // Get accounts for lookup
      const accounts = this.db.getAccounts();
      const accountMap = new Map(accounts.map(a => [a.id, a]));

      // Get tags for each transaction if requested
      const tagsMap = new Map<string, Tag[]>();
      if (options.includeTags) {
        for (const tx of transactions) {
          const tags = this.db.getTagsForTransaction(tx.id);
          tagsMap.set(tx.id, tags);
        }
      }

      // Show save dialog
      const defaultName = `budget-export-${new Date().toISOString().split('T')[0]}`;
      const result = await dialog.showSaveDialog({
        defaultPath: `${defaultName}.${options.format}`,
        filters: options.format === 'csv'
          ? [{ name: 'CSV Files', extensions: ['csv'] }]
          : [{ name: 'JSON Files', extensions: ['json'] }],
      });

      if (result.canceled || !result.filePath) {
        return { success: false, error: 'Export cancelled' };
      }

      const filePath = result.filePath;

      if (options.format === 'csv') {
        const csv = this.transactionsToCSV(transactions, categoryMap, accountMap, tagsMap);
        fs.writeFileSync(filePath, csv, 'utf8');
      } else {
        const json = this.transactionsToJSON(transactions, categoryMap, accountMap, tagsMap);
        fs.writeFileSync(filePath, json, 'utf8');
      }

      return {
        success: true,
        filePath,
        recordCount: transactions.length,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private transactionsToCSV(
    transactions: Transaction[],
    categoryMap: Map<string, Category>,
    accountMap: Map<string, Account>,
    tagsMap: Map<string, Tag[]>
  ): string {
    const hasTags = tagsMap.size > 0;
    const headers = [
      'Date',
      'Description',
      'Amount',
      'Category',
      'Account',
      'Type',
      'Is Recurring',
      'Import Source',
      ...(hasTags ? ['Tags'] : []),
    ];

    const rows = transactions.map(tx => {
      const category = tx.categoryId ? categoryMap.get(tx.categoryId) : null;
      const account = accountMap.get(tx.accountId);
      const tags = tagsMap.get(tx.id) || [];
      const type = tx.amount >= 0 ? 'Income' : 'Expense';

      return [
        this.formatDateForCSV(tx.date),
        this.escapeCSV(tx.description),
        tx.amount.toFixed(2),
        category ? this.escapeCSV(category.name) : '',
        account ? this.escapeCSV(account.name) : '',
        type,
        tx.isRecurring ? 'Yes' : 'No',
        tx.importSource,
        ...(hasTags ? [this.escapeCSV(tags.map(t => t.name).join(', '))] : []),
      ].join(',');
    });

    return [headers.join(','), ...rows].join('\n');
  }

  private transactionsToJSON(
    transactions: Transaction[],
    categoryMap: Map<string, Category>,
    accountMap: Map<string, Account>,
    tagsMap: Map<string, Tag[]>
  ): string {
    const data = transactions.map(tx => {
      const category = tx.categoryId ? categoryMap.get(tx.categoryId) : null;
      const account = accountMap.get(tx.accountId);
      const tags = tagsMap.get(tx.id) || [];

      return {
        id: tx.id,
        date: tx.date.toISOString(),
        description: tx.description,
        amount: tx.amount,
        type: tx.amount >= 0 ? 'income' : 'expense',
        category: category ? {
          id: category.id,
          name: category.name,
          icon: category.icon,
          color: category.color,
        } : null,
        account: account ? {
          id: account.id,
          name: account.name,
          type: account.type,
          institution: account.institution,
        } : null,
        isRecurring: tx.isRecurring,
        importSource: tx.importSource,
        tags: tags.map(t => ({ id: t.id, name: t.name, color: t.color })),
        createdAt: tx.createdAt.toISOString(),
      };
    });

    return JSON.stringify({ transactions: data, exportedAt: new Date().toISOString() }, null, 2);
  }

  private formatDateForCSV(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  private escapeCSV(value: string): string {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }

  async exportAllData(): Promise<ExportResult> {
    try {
      const result = await dialog.showSaveDialog({
        defaultPath: `budget-full-export-${new Date().toISOString().split('T')[0]}.json`,
        filters: [{ name: 'JSON Files', extensions: ['json'] }],
      });

      if (result.canceled || !result.filePath) {
        return { success: false, error: 'Export cancelled' };
      }

      const data = {
        exportedAt: new Date().toISOString(),
        accounts: this.db.getAccounts(),
        categories: this.db.getCategories(),
        transactions: this.db.getTransactions(),
        tags: this.db.getTags(),
        categoryRules: this.db.getCategoryRules(),
        recurringTransactions: this.db.getRecurringTransactions(),
        budgetGoals: this.db.getBudgetGoals(),
        spendingAlerts: this.db.getSpendingAlerts(),
        bills: this.db.getBills(),
        assets: this.db.getAssets(),
        liabilities: this.db.getLiabilities(),
        savingsGoals: this.db.getSavingsGoals(),
        investments: this.db.getInvestments(),
      };

      fs.writeFileSync(result.filePath, JSON.stringify(data, null, 2), 'utf8');

      const totalRecords =
        data.accounts.length +
        data.categories.length +
        data.transactions.length +
        data.tags.length;

      return {
        success: true,
        filePath: result.filePath,
        recordCount: totalRecords,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}
