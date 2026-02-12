import { ipcMain, dialog, BrowserWindow, app, shell } from 'electron';
import { BudgetDatabase } from './database';
import { SecurityManager } from './security';
import { exportDatabase } from './database-export';
import { selectImportFile as selectDatabaseImportFile, extractDatabaseMetadata, performDatabaseImport } from './database-import';
import path from 'path';
import {
  Account,
  Transaction,
  Category,
  CategoryRule,
  RecurringTransaction,
  RecurringItem,
  RecurringPayment,
  Tag,

  TransactionSplit,
  BudgetGoal,
  SpendingAlert,
  Bill,
  BillPayment,
  CategoryCorrection,
  Asset,
  Liability,
  SavingsGoal,
  SavingsContribution,
  Investment,
  InvestmentHistory,
  Receipt,
  RecurringSuggestion,
  InvestmentAccount,
  Holding,
  CostBasisLot,
  PriceCacheEntry,
  ColumnMapping,
  ImportPreviewRow,
  DuplicateAction,
  InvestmentTransaction,
  InvestmentSettings,
  ManualAsset,
  ManualLiability,
  NetWorthSnapshot,
  AssetValueHistory,
  LiabilityValueHistory,
  TransactionColumnMapping,
  TransactionImportPreviewRow,
} from '../shared/types';
import { PriceService, PriceResult, excludeTransfers, NetWorthProjectionConfig } from '@ledgr/core';
import { priceStorage } from './storage/priceStorage';
import { importTransactionsFromFile } from './import-handler';
import { ExportHandler, ExportOptions } from './export-handler';
import { ForecastEngine } from './forecast-engine';
import { CashFlowEngine } from './cashflow-engine';
import { CategorizationEngine } from './categorization-engine';
import { NetWorthEngine } from './net-worth-engine';
import { OFXDirectConnect, OFXCredentials } from './ofx-direct-connect';
import { getAllBanks, getBankById, BankInfo } from './bank-directory';
import { detectRecurringPayments, toRecurringFrequency, toBillFrequency, toUnifiedFrequency } from './recurring-detection-engine';
import {
  selectImportFile,
  generateImportPreview,
  commitImport,
  getAvailableFormats,
} from './holdings-import-handler';
import {
  selectTransactionImportFile,
  generateTransactionImportPreview,
  commitTransactionImport,
} from './transaction-import-handler';
import {
  AnomalyDetectionEngine,
  SeasonalAnalysisEngine,
  IncomeAnalysisEngine,
  SpendingVelocityEngine,
  ComparisonEngine,
  SubscriptionAuditEngine,
  FinancialHealthEngine,
  SavingsProjectionEngine,
  DebtPayoffEngine,
  NetWorthProjectionEngine,
  CategoryMigrationEngine,
  CashFlowOptimizationEngine,
  EnhancedForecastEngine,
  EnhancedCashFlowEngine,
  ExtendedForecastOptions,
  BudgetSuggestionEngine,
  RecoveryPlanEngine,
  ScenarioModification,
  QuickWin,
  PerformanceEngine,
  BenchmarkService,
  type HoldingData,
  type SellTransaction,
  type CashFlowEvent,
} from '@ledgr/core';
import type { PerformanceOptions } from '../shared/types';

// Module-level reference for lock guard in secureHandle
let securityManagerRef: SecurityManager | null = null;

function validateSender(event: Electron.IpcMainInvokeEvent): void {
  const senderUrl = event.senderFrame?.url || '';
  // Allow file:// protocol (packaged app) and http://localhost (dev mode)
  if (!senderUrl.startsWith('file://') && !senderUrl.startsWith('http://localhost')) {
    throw new Error('Unauthorized IPC request: invalid sender origin');
  }
}

function secureHandle(
  channel: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handler: (event: Electron.IpcMainInvokeEvent, ...args: any[]) => any
): void {
  ipcMain.handle(channel, (event, ...args) => {
    validateSender(event);
    // Lock guard: reject non-security IPC calls when locked
    if (securityManagerRef?.getIsLocked() && !channel.startsWith('security:')) {
      throw new Error('Application is locked');
    }
    return handler(event, ...args);
  });
}

export class IPCHandlers {
  private forecastEngine: ForecastEngine;
  private cashFlowEngine: CashFlowEngine;
  private categorizationEngine: CategorizationEngine;
  private netWorthEngine: NetWorthEngine;
  private exportHandler: ExportHandler;
  private anomalyDetectionEngine: AnomalyDetectionEngine;
  private seasonalAnalysisEngine: SeasonalAnalysisEngine;
  private incomeAnalysisEngine: IncomeAnalysisEngine;
  private spendingVelocityEngine: SpendingVelocityEngine;
  private comparisonEngine: ComparisonEngine;
  private subscriptionAuditEngine: SubscriptionAuditEngine;
  private financialHealthEngine: FinancialHealthEngine;
  private savingsProjectionEngine: SavingsProjectionEngine;
  private debtPayoffEngine: DebtPayoffEngine;
  private netWorthProjectionEngine: NetWorthProjectionEngine;
  private categoryMigrationEngine: CategoryMigrationEngine;
  private cashFlowOptimizationEngine: CashFlowOptimizationEngine;
  private enhancedForecastEngine: EnhancedForecastEngine;
  private enhancedCashFlowEngine: EnhancedCashFlowEngine;
  private budgetSuggestionEngine: BudgetSuggestionEngine;
  private recoveryPlanEngine: RecoveryPlanEngine;
  private priceService: PriceService;
  private performanceEngine: PerformanceEngine;
  private benchmarkService: BenchmarkService;
  private ofxConnections: Map<string, { bank: BankInfo; credentials: OFXCredentials }> = new Map();

  constructor(private db: BudgetDatabase, private securityManager?: SecurityManager) {
    if (securityManager) {
      securityManagerRef = securityManager;
    }
    this.forecastEngine = new ForecastEngine(db);
    this.cashFlowEngine = new CashFlowEngine(db);
    this.categorizationEngine = new CategorizationEngine(db);
    this.netWorthEngine = new NetWorthEngine(db);
    this.exportHandler = new ExportHandler(db);

    // Phase 7 engines
    this.anomalyDetectionEngine = new AnomalyDetectionEngine({
      getTransactions: () => excludeTransfers(db.getTransactions()),
      getRecurringItems: () => db.getRecurringItems(),
      getCategories: () => db.getCategories(),
    });
    this.seasonalAnalysisEngine = new SeasonalAnalysisEngine({
      getTransactions: () => excludeTransfers(db.getTransactions()),
      getCategories: () => db.getCategories(),
    });
    this.incomeAnalysisEngine = new IncomeAnalysisEngine({
      getTransactions: () => excludeTransfers(db.getTransactions()),
    });
    this.spendingVelocityEngine = new SpendingVelocityEngine({
      getTransactions: () => excludeTransfers(db.getTransactions()),
      getBudgetGoals: () => db.getBudgetGoals(),
      getCategories: () => db.getCategories(),
    });
    this.comparisonEngine = new ComparisonEngine({
      getTransactions: () => excludeTransfers(db.getTransactions()),
      getCategories: () => db.getCategories(),
      getBudgetGoals: () => db.getBudgetGoals(),
    });
    this.subscriptionAuditEngine = new SubscriptionAuditEngine({
      getRecurringItems: () => db.getRecurringItems(),
    });
    this.financialHealthEngine = new FinancialHealthEngine({
      getTransactions: () => excludeTransfers(db.getTransactions()),
      getBudgetGoals: () => db.getBudgetGoals(),
      getAssets: () => db.getAssets(),
      getLiabilities: () => {
        // Primary: manual_liabilities (Net Worth page - canonical source)
        const manualLiabilities = db.getManualLiabilities().map(l => ({
          id: l.id,
          name: l.name,
          balance: l.balance,
          interestRate: l.interestRate,
          minimumPayment: l.monthlyPayment || null,
        }));
        // Secondary: legacy liabilities (deduplicate by name)
        const manualNames = new Set(manualLiabilities.map(l => l.name.toLowerCase()));
        const legacyLiabilities = db.getLiabilities()
          .filter(l => !manualNames.has(l.name.toLowerCase()));
        return [...manualLiabilities, ...legacyLiabilities];
      },
      getSavingsGoals: () => db.getSavingsGoals(),
      getNetWorthHistory: () => db.getNetWorthHistory().map(h => ({ date: h.date, netWorth: h.netWorth })),
    });

    // Phase 3: Goal & Debt Projection engines
    this.savingsProjectionEngine = new SavingsProjectionEngine({
      getSavingsGoals: () => db.getSavingsGoals().map(g => ({
        id: g.id,
        name: g.name,
        targetAmount: g.targetAmount,
        currentAmount: g.currentAmount,
        targetDate: g.targetDate,
        monthlyContribution: 0, // Calculated from contribution history
      })),
      getSavingsContributions: (goalId: string) => db.getSavingsContributions(goalId).map(c => ({
        id: c.id,
        goalId: c.goalId,
        amount: c.amount,
        date: c.date,
      })),
    });
    this.debtPayoffEngine = new DebtPayoffEngine({
      getLiabilities: () => {
        // Primary: manual_liabilities (Net Worth page - canonical source)
        const manualLiabilities = db.getManualLiabilities().map(l => ({
          id: l.id,
          name: l.name,
          balance: l.balance,
          interestRate: l.interestRate * 100, // decimal → percentage (0.065 → 6.5)
          minimumPayment: l.monthlyPayment || l.balance * 0.02,
          type: l.type,
        }));
        // Secondary: legacy liabilities (deduplicate by name)
        const manualNames = new Set(manualLiabilities.map(l => l.name.toLowerCase()));
        const legacyLiabilities = db.getLiabilities()
          .filter(l => !manualNames.has(l.name.toLowerCase()))
          .map(l => ({
            id: l.id,
            name: l.name,
            balance: l.balance,
            interestRate: l.interestRate || 0,
            minimumPayment: l.minimumPayment || l.balance * 0.02,
            type: l.type,
          }));
        return [...manualLiabilities, ...legacyLiabilities];
      },
    });
    this.netWorthProjectionEngine = new NetWorthProjectionEngine({
      getNetWorthHistory: () => db.getNetWorthHistory().map(h => ({
        id: h.id,
        date: h.date,
        totalAssets: h.totalAssets,
        totalLiabilities: h.totalLiabilities,
        netWorth: h.netWorth,
      })),
      getCurrentNetWorth: async () => {
        const totalAssets = db.getTotalAssets();
        const totalLiabilities = db.getTotalLiabilities();
        return totalAssets - totalLiabilities;
      },
    });

    // Phase 4: Cash Flow Intelligence engines
    this.categoryMigrationEngine = new CategoryMigrationEngine({
      getTransactions: () => excludeTransfers(db.getTransactions()).map(t => ({
        id: t.id,
        date: t.date,
        amount: t.amount,
        categoryId: t.categoryId ?? null,
        type: t.amount >= 0 ? 'income' as const : 'expense' as const,
      })),
      getCategories: () => db.getCategories(),
    });
    this.cashFlowOptimizationEngine = new CashFlowOptimizationEngine({
      getRecurringItems: () => db.getRecurringItems().map(item => ({
        id: item.id,
        name: item.description,
        amount: item.amount,
        frequency: item.frequency,
        nextDueDate: item.nextOccurrence,
        dayOfMonth: item.dayOfMonth,
        isActive: item.isActive,
        type: item.amount < 0 ? 'expense' as const : 'income' as const,
        accountId: item.accountId,
      })),
      getAccounts: () => db.getAccounts(),
      getBillPreferences: () => db.getBillPreferences(),
    });

    // Enhanced Forecast Engine (long-term with seasonal + trend)
    this.enhancedForecastEngine = new EnhancedForecastEngine({
      getTransactions: () => excludeTransfers(db.getTransactions()),
      getCategories: () => db.getCategories(),
      getRecurringItems: () => db.getRecurringItems(),
    });

    // Enhanced CashFlow Engine (combines recurring + category trends)
    this.enhancedCashFlowEngine = new EnhancedCashFlowEngine({
      getAccountById: (id: string) => db.getAccountById(id),
      getRecurringTransactionsByAccount: (accountId: string) => db.getRecurringTransactionsByAccount(accountId),
      getTransactions: () => excludeTransfers(db.getTransactions()),
      getCategories: () => db.getCategories(),
      getRecurringItems: () => db.getRecurringItems(),
    });

    // Budget Suggestion Engine
    this.budgetSuggestionEngine = new BudgetSuggestionEngine({
      getTransactions: (startDate?: Date) => {
        const txs = excludeTransfers(db.getTransactions());
        if (!startDate) return txs;
        return txs.filter(t => {
          const txDate = t.date instanceof Date ? t.date : new Date(t.date);
          return txDate >= startDate;
        });
      },
      getCategories: () => db.getCategories(),
      getBudgetGoals: () => db.getBudgetGoals(),
    });

    // Recovery Plan Engine
    this.recoveryPlanEngine = new RecoveryPlanEngine({
      getCashFlowOptimization: () => this.cashFlowOptimizationEngine.optimize(),
      getSubscriptionAudit: async () => this.subscriptionAuditEngine.auditSubscriptions(),
      getBudgetSuggestions: () => this.budgetSuggestionEngine.generateSuggestions(),
      getDebtPayoffReport: () => this.debtPayoffEngine.generateReport(),
      getRecurringItems: () => db.getRecurringItems().map(item => ({
        id: item.id,
        description: item.description,
        amount: item.amount,
        frequency: item.frequency,
        nextOccurrence: item.nextOccurrence,
        categoryId: item.categoryId,
        isActive: item.isActive,
        itemType: item.itemType,
      })),
      getAccounts: () => db.getAccounts(),
      getCategories: () => db.getCategories(),
    });

    // Phase 2: Price Service
    this.priceService = new PriceService();

    // Phase 4: Performance Analytics
    this.performanceEngine = new PerformanceEngine();
    this.benchmarkService = new BenchmarkService();

    this.registerHandlers();
  }

  private registerHandlers(): void {
    // Account handlers
    secureHandle('accounts:getAll', () => {
      return this.db.getAccounts();
    });

    secureHandle('accounts:getById', (_event, id: string) => {
      return this.db.getAccountById(id);
    });

    secureHandle('accounts:create', (_event, account: Omit<Account, 'id' | 'createdAt'>) => {
      return this.db.createAccount(account);
    });

    secureHandle('accounts:update', (_event, id: string, updates: Partial<Omit<Account, 'id' | 'createdAt'>>) => {
      return this.db.updateAccount(id, updates);
    });

    secureHandle('accounts:delete', (_event, id: string) => {
      return this.db.deleteAccount(id);
    });

    secureHandle('accounts:getDefault', () => {
      return this.db.getSetting('defaultAccountId', '');
    });

    secureHandle('accounts:setDefault', (_event, accountId: string) => {
      this.db.setSetting('defaultAccountId', accountId);
      return true;
    });

    // Transaction handlers
    secureHandle('transactions:getAll', () => {
      return this.db.getTransactions();
    });

    secureHandle('transactions:getByAccount', (_event, accountId: string) => {
      return this.db.getTransactionsByAccount(accountId);
    });

    secureHandle('transactions:create', (_event, transaction: Omit<Transaction, 'id' | 'createdAt'>) => {
      return this.db.createTransaction(transaction);
    });

    secureHandle('transactions:update', (_event, id: string, updates: Partial<Omit<Transaction, 'id' | 'createdAt'>>) => {
      return this.db.updateTransaction(id, updates);
    });

    secureHandle('transactions:delete', (_event, id: string) => {
      return this.db.deleteTransaction(id);
    });

    secureHandle('transactions:bulkUpdateCategory', (
      _event,
      pattern: string,
      categoryId: string,
      createRule: boolean,
      filterCategoryId: string | null
    ) => {
      return this.db.bulkUpdateCategoryByPattern(pattern, categoryId, createRule, filterCategoryId);
    });

    secureHandle('transactions:countByPattern', (_event, pattern: string, filterCategoryId?: string | null) => {
      return this.db.getTransactionCountByPattern(pattern, filterCategoryId ?? null);
    });

    secureHandle('transactions:samplesByPattern', (_event, pattern: string, limit?: number, filterCategoryId?: string | null) => {
      return this.db.getTransactionSamplesByPattern(pattern, limit, filterCategoryId ?? null);
    });

    secureHandle('transactions:bulkDelete', (_event, ids: string[]) => {
      return this.db.bulkDeleteTransactions(ids);
    });

    secureHandle('transactions:bulkUpdateCategoryByIds', (_event, ids: string[], categoryId: string | null) => {
      return this.db.bulkUpdateCategoryByIds(ids, categoryId);
    });

    // Category handlers
    secureHandle('categories:getAll', () => {
      return this.db.getCategories();
    });

    secureHandle('categories:getById', (_event, id: string) => {
      return this.db.getCategoryById(id);
    });

    secureHandle('categories:create', (_event, category: Omit<Category, 'id'>) => {
      return this.db.createCategory(category);
    });

    secureHandle('categories:update', (_event, id: string, updates: Partial<Omit<Category, 'id'>>) => {
      return this.db.updateCategory(id, updates);
    });

    secureHandle('categories:delete', (_event, id: string) => {
      return this.db.deleteCategory(id);
    });

    secureHandle('categories:addMissingDefaults', () => {
      return this.db.addMissingDefaultCategories();
    });

    // Category Rules handlers
    secureHandle('categoryRules:getAll', () => {
      return this.db.getCategoryRules();
    });

    secureHandle('categoryRules:getById', (_event, id: string) => {
      return this.db.getCategoryRuleById(id);
    });

    secureHandle('categoryRules:create', (_event, rule: Omit<CategoryRule, 'id' | 'createdAt'>) => {
      return this.db.createCategoryRule(rule);
    });

    secureHandle('categoryRules:update', (_event, id: string, updates: Partial<Omit<CategoryRule, 'id' | 'createdAt'>>) => {
      return this.db.updateCategoryRule(id, updates);
    });

    secureHandle('categoryRules:delete', (_event, id: string) => {
      return this.db.deleteCategoryRule(id);
    });

    secureHandle('categoryRules:applyToTransactions', (_event, onlyUncategorized: boolean) => {
      return this.categorizationEngine.applyRulesToTransactions(onlyUncategorized);
    });

    secureHandle('categoryRules:suggestCategory', (_event, description: string) => {
      return this.categorizationEngine.categorize(description);
    });

    // Import handlers
    secureHandle('import:selectFile', async () => {
      const result = await dialog.showOpenDialog({
        properties: ['openFile'],
        filters: [
          { name: 'CSV Files', extensions: ['csv'] },
          { name: 'OFX Files', extensions: ['ofx'] },
          { name: 'QFX Files', extensions: ['qfx'] },
          { name: 'All Files', extensions: ['*'] },
        ],
      });

      if (result.canceled || result.filePaths.length === 0) {
        return null;
      }

      return result.filePaths[0];
    });

    secureHandle('import:file', async (_event, accountId: string, filePath: string) => {
      return await importTransactionsFromFile(this.db, accountId, filePath);
    });

    // Legacy handler for backwards compatibility
    secureHandle('import:csv', async (_event, accountId: string, filePath: string) => {
      return await importTransactionsFromFile(this.db, accountId, filePath);
    });

    // Analytics handlers
    secureHandle('analytics:getSpendingByCategory', (_event, startDate?: string, endDate?: string) => {
      const start = startDate ? new Date(startDate) : undefined;
      const end = endDate ? new Date(endDate) : undefined;
      return this.db.getSpendingByCategory(start, end);
    });

    secureHandle('analytics:getIncomeVsExpensesOverTime', (_event, grouping: 'day' | 'week' | 'month' | 'year', startDate?: string, endDate?: string) => {
      const start = startDate ? new Date(startDate) : undefined;
      const end = endDate ? new Date(endDate) : undefined;
      return this.db.getIncomeVsExpensesOverTime(grouping, start, end);
    });

    secureHandle('analytics:getCategoryTrendsOverTime', (_event, categoryIds: string[], grouping: 'day' | 'week' | 'month' | 'year', startDate?: string, endDate?: string) => {
      const start = startDate ? new Date(startDate) : undefined;
      const end = endDate ? new Date(endDate) : undefined;
      return this.db.getCategoryTrendsOverTime(categoryIds, grouping, start, end);
    });

    // Forecast handlers
    secureHandle('forecast:spending', (_event, forecastDays: number, historyDays?: number) => {
      return this.forecastEngine.forecastSpending(forecastDays, historyDays);
    });

    secureHandle('forecast:multiPeriod', (_event, periods: number[]) => {
      return this.forecastEngine.generateMultiPeriodForecasts(periods);
    });

    // Recurring transaction handlers
    secureHandle('recurringTransactions:getAll', () => {
      return this.db.getRecurringTransactions();
    });

    secureHandle('recurringTransactions:getByAccount', (_event, accountId: string) => {
      return this.db.getRecurringTransactionsByAccount(accountId);
    });

    secureHandle('recurringTransactions:getById', (_event, id: string) => {
      return this.db.getRecurringTransactionById(id);
    });

    secureHandle('recurringTransactions:create', (_event, recurringTx: Omit<RecurringTransaction, 'id'>) => {
      return this.db.createRecurringTransaction(recurringTx);
    });

    secureHandle('recurringTransactions:update', (_event, id: string, updates: Partial<Omit<RecurringTransaction, 'id'>>) => {
      return this.db.updateRecurringTransaction(id, updates);
    });

    secureHandle('recurringTransactions:delete', (_event, id: string) => {
      return this.db.deleteRecurringTransaction(id);
    });

    // Cash flow forecast handlers
    secureHandle('cashflow:forecast', (_event, accountId: string, startDate: string, endDate: string) => {
      return this.cashFlowEngine.forecastCashFlow(
        accountId,
        new Date(startDate),
        new Date(endDate)
      );
    });

    secureHandle('cashflow:projectTransactions', (_event, accountId: string, startDate: string, endDate: string) => {
      return this.cashFlowEngine.projectRecurringTransactions(
        accountId,
        new Date(startDate),
        new Date(endDate)
      );
    });

    // Category forecast handlers
    secureHandle('forecast:categorySpending', (_event, categoryId: string, forecastDays: number, historyDays?: number) => {
      return this.forecastEngine.forecastCategorySpending(categoryId, forecastDays, historyDays);
    });

    secureHandle('forecast:allCategories', (_event, forecastDays?: number, historyDays?: number) => {
      return this.forecastEngine.forecastAllCategories(forecastDays, historyDays);
    });

    // OFX Direct Connect handlers
    secureHandle('ofx:getBanks', () => {
      return getAllBanks();
    });

    secureHandle('ofx:searchBanks', (_event, query: string) => {
      const allBanks = getAllBanks();
      return allBanks.filter(b => b.name.toLowerCase().includes(query.toLowerCase()));
    });

    secureHandle('ofx:testConnection', async (_event, bankId: string, username: string, password: string) => {
      const bank = getBankById(bankId);
      if (!bank) {
        return { success: false, error: 'Bank not found' };
      }
      const credentials: OFXCredentials = { bankId, username, password };
      return await OFXDirectConnect.testConnection(bank, credentials);
    });

    secureHandle('ofx:saveConnection', async (_event, connectionData: {
      bankId: string;
      bankName: string;
      ofxUrl: string;
      org: string;
      fid: string;
      username: string;
      accountId: string;
      accountType: string;
    }) => {
      // Create account in database with OFX connection info
      const account = await this.db.createAccount({
        name: `${connectionData.bankName} - ${connectionData.accountType}`,
        type: connectionData.accountType === 'creditcard' ? 'credit' :
              connectionData.accountType === 'savings' ? 'savings' : 'checking',
        institution: connectionData.bankName,
        balance: 0,
        lastSynced: null,
        ofxUrl: connectionData.ofxUrl,
        ofxOrg: connectionData.org,
        ofxFid: connectionData.fid,
        ofxUsername: connectionData.username,
        ofxAccountId: connectionData.accountId,
      });

      // Store credentials in memory for syncing (encrypted storage would be better for production)
      const bank: BankInfo = {
        id: connectionData.bankId,
        name: connectionData.bankName,
        ofxUrl: connectionData.ofxUrl,
        org: connectionData.org,
        fid: connectionData.fid,
      };
      this.ofxConnections.set(account.id, {
        bank,
        credentials: {
          bankId: connectionData.bankId,
          username: connectionData.username,
          password: '', // Don't store password - user will need to re-enter for sync
          accountId: connectionData.accountId,
          accountType: connectionData.accountType.toUpperCase() as OFXCredentials['accountType'],
        },
      });

      return account;
    });

    secureHandle('ofx:syncTransactions', async (_event, accountId: string, password: string, startDate?: string, endDate?: string) => {
      const account = await this.db.getAccountById(accountId);
      if (!account || !account.ofxUrl) {
        return { success: false, error: 'Account not configured for OFX' };
      }

      const bank: BankInfo = {
        id: accountId,
        name: account.institution,
        ofxUrl: account.ofxUrl,
        org: account.ofxOrg || '',
        fid: account.ofxFid || '',
      };

      const credentials: OFXCredentials = {
        bankId: accountId,
        username: account.ofxUsername || '',
        password: password,
        accountId: account.ofxAccountId || undefined,
        accountType: account.type === 'credit' ? 'CREDITCARD' :
                     account.type === 'savings' ? 'SAVINGS' : 'CHECKING',
      };

      const start = startDate ? new Date(startDate) : new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
      const end = endDate ? new Date(endDate) : new Date();

      const result = await OFXDirectConnect.getTransactions(bank, credentials, start, end);

      if (!result.success) {
        return result;
      }

      // Import transactions
      let imported = 0;
      let duplicates = 0;

      for (const txn of result.transactions || []) {
        // Check for duplicates by fitId
        const existing = await this.db.getTransactionByFitId(txn.fitId);
        if (existing) {
          duplicates++;
          continue;
        }

        await this.db.createTransaction({
          accountId,
          date: txn.datePosted,
          description: txn.memo || txn.name,
          amount: txn.amount,
          categoryId: null,
          isRecurring: false,
          importSource: 'ofx',
          fitId: txn.fitId,
        });
        imported++;
      }

      // Update account balance and last synced
      if (result.balance !== undefined) {
        await this.db.updateAccount(accountId, {
          balance: result.balance,
          lastSynced: new Date(),
        });
      }

      return {
        success: true,
        imported,
        duplicates,
        balance: result.balance,
      };
    });

    secureHandle('ofx:disconnectAccount', async (_event, accountId: string) => {
      // Clear OFX connection data
      await this.db.updateAccount(accountId, {
        ofxUrl: null,
        ofxOrg: null,
        ofxFid: null,
        ofxUsername: null,
        ofxAccountId: null,
      });
      this.ofxConnections.delete(accountId);
      return { success: true };
    });

    // ==================== Phase 1: Data Export ====================
    secureHandle('export:transactions', async (_event, options: ExportOptions) => {
      const parsedOptions = {
        ...options,
        startDate: options.startDate ? new Date(options.startDate as unknown as string) : undefined,
        endDate: options.endDate ? new Date(options.endDate as unknown as string) : undefined,
      };
      return await this.exportHandler.exportTransactions(parsedOptions);
    });

    secureHandle('export:allData', async () => {
      return await this.exportHandler.exportAllData();
    });

    // ==================== Phase 1: Tags ====================
    secureHandle('tags:getAll', () => {
      return this.db.getTags();
    });

    secureHandle('tags:getById', (_event, id: string) => {
      return this.db.getTagById(id);
    });

    secureHandle('tags:create', (_event, tag: Omit<Tag, 'id' | 'createdAt'>) => {
      return this.db.createTag(tag);
    });

    secureHandle('tags:update', (_event, id: string, updates: Partial<Omit<Tag, 'id' | 'createdAt'>>) => {
      return this.db.updateTag(id, updates);
    });

    secureHandle('tags:delete', (_event, id: string) => {
      return this.db.deleteTag(id);
    });

    secureHandle('tags:getForTransaction', (_event, transactionId: string) => {
      return this.db.getTagsForTransaction(transactionId);
    });

    secureHandle('tags:addToTransaction', (_event, transactionId: string, tagId: string) => {
      return this.db.addTagToTransaction(transactionId, tagId);
    });

    secureHandle('tags:removeFromTransaction', (_event, transactionId: string, tagId: string) => {
      return this.db.removeTagFromTransaction(transactionId, tagId);
    });

    secureHandle('tags:setForTransaction', (_event, transactionId: string, tagIds: string[]) => {
      return this.db.setTransactionTags(transactionId, tagIds);
    });

    secureHandle('tags:getTransactions', (_event, tagId: string) => {
      return this.db.getTransactionsByTag(tagId);
    });

    // ==================== Phase 1: Split Transactions ====================
    secureHandle('splits:getAll', (_event, parentTransactionId: string) => {
      return this.db.getTransactionSplits(parentTransactionId);
    });

    secureHandle('splits:getById', (_event, id: string) => {
      return this.db.getTransactionSplitById(id);
    });

    secureHandle('splits:create', (_event, split: Omit<TransactionSplit, 'id' | 'createdAt'>) => {
      return this.db.createTransactionSplit(split);
    });

    secureHandle('splits:update', (_event, id: string, updates: Partial<Omit<TransactionSplit, 'id' | 'createdAt' | 'parentTransactionId'>>) => {
      return this.db.updateTransactionSplit(id, updates);
    });

    secureHandle('splits:delete', (_event, id: string) => {
      return this.db.deleteTransactionSplit(id);
    });

    secureHandle('splits:deleteAll', (_event, parentTransactionId: string) => {
      return this.db.deleteAllTransactionSplits(parentTransactionId);
    });

    secureHandle('splits:getTransactionIds', () => {
      return this.db.getTransactionIdsWithSplits();
    });

    secureHandle('splits:getByTransactionIds', (_event, ids: string[]) => {
      return this.db.getTransactionSplitsByIds(ids);
    });

    // ==================== Phase 1: Search ====================
    secureHandle('transactions:search', (_event, query: string, options?: {
      accountId?: string;
      categoryId?: string;
      startDate?: string;
      endDate?: string;
      minAmount?: number;
      maxAmount?: number;
      tagIds?: string[];
      limit?: number;
      offset?: number;
    }) => {
      const parsedOptions = options ? {
        ...options,
        startDate: options.startDate ? new Date(options.startDate) : undefined,
        endDate: options.endDate ? new Date(options.endDate) : undefined,
      } : undefined;
      return this.db.searchTransactions(query, parsedOptions);
    });

    // ==================== Phase 2: Budget Goals ====================
    secureHandle('budgetGoals:getAll', () => {
      return this.db.getBudgetGoals();
    });

    secureHandle('budgetGoals:getById', (_event, id: string) => {
      return this.db.getBudgetGoalById(id);
    });

    secureHandle('budgetGoals:getByCategory', (_event, categoryId: string) => {
      return this.db.getBudgetGoalByCategory(categoryId);
    });

    secureHandle('budgetGoals:create', (_event, goal: Omit<BudgetGoal, 'id' | 'createdAt'>) => {
      return this.db.createBudgetGoal({
        ...goal,
        startDate: new Date(goal.startDate),
      });
    });

    secureHandle('budgetGoals:update', (_event, id: string, updates: Partial<Omit<BudgetGoal, 'id' | 'createdAt'>>) => {
      const parsedUpdates = updates.startDate
        ? { ...updates, startDate: new Date(updates.startDate) }
        : updates;
      return this.db.updateBudgetGoal(id, parsedUpdates);
    });

    secureHandle('budgetGoals:delete', (_event, id: string) => {
      return this.db.deleteBudgetGoal(id);
    });

    // ==================== Budget Suggestions ====================
    secureHandle('budgetSuggestions:getAll', async (_event, options?: { historyMonths?: number; bufferPercent?: number }) => {
      return this.budgetSuggestionEngine.generateSuggestions(options);
    });

    secureHandle('budgetSuggestions:forCategory', async (_event, categoryId: string, options?: { historyMonths?: number; userGoal?: 'reduce_spending' }) => {
      return this.budgetSuggestionEngine.suggestForCategory(categoryId, options?.userGoal, options);
    });

    secureHandle('budgetSuggestions:apply', async (_event, suggestion: { categoryId: string; suggestedAmount: number; period: string }) => {
      // Check if budget already exists for this category
      const existingBudget = this.db.getBudgetGoalByCategory(suggestion.categoryId);

      if (existingBudget) {
        // Update existing budget
        return this.db.updateBudgetGoal(existingBudget.id, {
          amount: suggestion.suggestedAmount,
          period: suggestion.period as 'weekly' | 'monthly' | 'yearly',
        });
      } else {
        // Create new budget
        return this.db.createBudgetGoal({
          categoryId: suggestion.categoryId,
          amount: suggestion.suggestedAmount,
          period: suggestion.period as 'weekly' | 'monthly' | 'yearly',
          rolloverEnabled: false,
          rolloverAmount: 0,
          startDate: new Date(),
        });
      }
    });

    // ==================== Phase 2: Spending Alerts ====================
    secureHandle('spendingAlerts:getAll', () => {
      return this.db.getSpendingAlerts();
    });

    secureHandle('spendingAlerts:getById', (_event, id: string) => {
      return this.db.getSpendingAlertById(id);
    });

    secureHandle('spendingAlerts:getActive', () => {
      return this.db.getActiveSpendingAlerts();
    });

    secureHandle('spendingAlerts:create', (_event, alert: Omit<SpendingAlert, 'id' | 'createdAt'>) => {
      return this.db.createSpendingAlert({
        ...alert,
        lastTriggered: alert.lastTriggered ? new Date(alert.lastTriggered) : null,
      });
    });

    secureHandle('spendingAlerts:update', (_event, id: string, updates: Partial<Omit<SpendingAlert, 'id' | 'createdAt'>>) => {
      const parsedUpdates = updates.lastTriggered
        ? { ...updates, lastTriggered: new Date(updates.lastTriggered) }
        : updates;
      return this.db.updateSpendingAlert(id, parsedUpdates);
    });

    secureHandle('spendingAlerts:delete', (_event, id: string) => {
      return this.db.deleteSpendingAlert(id);
    });

    // ==================== Phase 3: Bills ====================
    secureHandle('bills:getAll', () => {
      return this.db.getBills();
    });

    secureHandle('bills:getActive', () => {
      return this.db.getActiveBills();
    });

    secureHandle('bills:getById', (_event, id: string) => {
      return this.db.getBillById(id);
    });

    secureHandle('bills:create', (_event, bill: Omit<Bill, 'id' | 'createdAt'>) => {
      return this.db.createBill(bill);
    });

    secureHandle('bills:update', (_event, id: string, updates: Partial<Omit<Bill, 'id' | 'createdAt'>>) => {
      return this.db.updateBill(id, updates);
    });

    secureHandle('bills:delete', (_event, id: string) => {
      return this.db.deleteBill(id);
    });

    // Bill Payments
    secureHandle('billPayments:getAll', (_event, billId: string) => {
      return this.db.getBillPayments(billId);
    });

    secureHandle('billPayments:getById', (_event, id: string) => {
      return this.db.getBillPaymentById(id);
    });

    secureHandle('billPayments:getUpcoming', (_event, days?: number) => {
      return this.db.getUpcomingBillPayments(days);
    });

    secureHandle('billPayments:create', (_event, payment: Omit<BillPayment, 'id' | 'createdAt'>) => {
      return this.db.createBillPayment({
        ...payment,
        dueDate: new Date(payment.dueDate),
        paidDate: payment.paidDate ? new Date(payment.paidDate) : null,
      });
    });

    secureHandle('billPayments:update', (_event, id: string, updates: Partial<Omit<BillPayment, 'id' | 'createdAt' | 'billId'>>) => {
      const parsedUpdates: Partial<Omit<BillPayment, 'id' | 'createdAt' | 'billId'>> = { ...updates };
      if (updates.dueDate) parsedUpdates.dueDate = new Date(updates.dueDate);
      if (updates.paidDate) parsedUpdates.paidDate = new Date(updates.paidDate);
      return this.db.updateBillPayment(id, parsedUpdates);
    });

    secureHandle('billPayments:delete', (_event, id: string) => {
      return this.db.deleteBillPayment(id);
    });

    // ==================== Phase 3: Category Corrections ====================
    secureHandle('categoryCorrections:getAll', () => {
      return this.db.getCategoryCorrections();
    });

    secureHandle('categoryCorrections:getById', (_event, id: string) => {
      return this.db.getCategoryCorrectionById(id);
    });

    secureHandle('categoryCorrections:find', (_event, description: string) => {
      return this.db.findCategoryCorrection(description);
    });

    secureHandle('categoryCorrections:create', (_event, correction: Omit<CategoryCorrection, 'id' | 'createdAt'>) => {
      return this.db.createCategoryCorrection(correction);
    });

    secureHandle('categoryCorrections:update', (_event, id: string, updates: Partial<Omit<CategoryCorrection, 'id' | 'createdAt'>>) => {
      return this.db.updateCategoryCorrection(id, updates);
    });

    secureHandle('categoryCorrections:delete', (_event, id: string) => {
      return this.db.deleteCategoryCorrection(id);
    });

    secureHandle('categoryCorrections:incrementUsage', (_event, id: string) => {
      return this.db.incrementCategoryCorrectionUsage(id);
    });

    // ==================== Phase 4: Assets ====================
    secureHandle('assets:getAll', () => {
      return this.db.getAssets();
    });

    secureHandle('assets:getById', (_event, id: string) => {
      return this.db.getAssetById(id);
    });

    secureHandle('assets:create', (_event, asset: Omit<Asset, 'id' | 'createdAt'>) => {
      return this.db.createAsset({
        ...asset,
        lastUpdated: new Date(asset.lastUpdated),
      });
    });

    secureHandle('assets:update', (_event, id: string, updates: Partial<Omit<Asset, 'id' | 'createdAt'>>) => {
      const parsedUpdates = updates.lastUpdated
        ? { ...updates, lastUpdated: new Date(updates.lastUpdated) }
        : updates;
      return this.db.updateAsset(id, parsedUpdates);
    });

    secureHandle('assets:delete', (_event, id: string) => {
      return this.db.deleteAsset(id);
    });

    secureHandle('assets:getTotal', () => {
      return this.db.getTotalAssets();
    });

    // ==================== Phase 4: Liabilities ====================
    secureHandle('liabilities:getAll', () => {
      return this.db.getLiabilities();
    });

    secureHandle('liabilities:getById', (_event, id: string) => {
      return this.db.getLiabilityById(id);
    });

    secureHandle('liabilities:create', (_event, liability: Omit<Liability, 'id' | 'createdAt'>) => {
      return this.db.createLiability({
        ...liability,
        lastUpdated: new Date(liability.lastUpdated),
      });
    });

    secureHandle('liabilities:update', (_event, id: string, updates: Partial<Omit<Liability, 'id' | 'createdAt'>>) => {
      const parsedUpdates = updates.lastUpdated
        ? { ...updates, lastUpdated: new Date(updates.lastUpdated) }
        : updates;
      return this.db.updateLiability(id, parsedUpdates);
    });

    secureHandle('liabilities:delete', (_event, id: string) => {
      return this.db.deleteLiability(id);
    });

    secureHandle('liabilities:getTotal', () => {
      return this.db.getTotalLiabilities();
    });

    // ==================== Phase 4: Net Worth (Legacy) ====================
    secureHandle('netWorth:createHistory', () => {
      return this.db.createNetWorthHistory();
    });

    secureHandle('netWorth:getHistory', (_event, limit?: number) => {
      return this.db.getNetWorthHistory(limit);
    });

    secureHandle('netWorth:getById', (_event, id: string) => {
      return this.db.getNetWorthHistoryById(id);
    });

    // ==================== Phase 5: Net Worth Integration (v1.1) ====================
    // Manual Assets handlers
    secureHandle('manualAssets:getAll', () => {
      return this.db.getManualAssets();
    });

    secureHandle('manualAssets:getById', (_event, id: string) => {
      return this.db.getManualAssetById(id);
    });

    secureHandle('manualAssets:create', (_event, asset: Omit<ManualAsset, 'id' | 'createdAt' | 'lastUpdated'>) => {
      return this.db.createManualAsset(asset);
    });

    secureHandle('manualAssets:update', (_event, id: string, updates: Partial<Omit<ManualAsset, 'id' | 'createdAt'>>) => {
      const parsedUpdates = {
        ...updates,
        lastReminderDate: updates.lastReminderDate ? new Date(updates.lastReminderDate) : updates.lastReminderDate === null ? null : undefined,
        nextReminderDate: updates.nextReminderDate ? new Date(updates.nextReminderDate) : updates.nextReminderDate === null ? null : undefined,
        lastUpdated: updates.lastUpdated ? new Date(updates.lastUpdated) : undefined,
      };
      // Remove undefined values
      Object.keys(parsedUpdates).forEach(key => {
        if (parsedUpdates[key as keyof typeof parsedUpdates] === undefined) {
          delete parsedUpdates[key as keyof typeof parsedUpdates];
        }
      });
      return this.db.updateManualAsset(id, parsedUpdates as Partial<Omit<ManualAsset, 'id' | 'createdAt'>>);
    });

    secureHandle('manualAssets:delete', (_event, id: string) => {
      return this.db.deleteManualAsset(id);
    });

    secureHandle('manualAssets:getDueReminders', () => {
      return this.db.getAssetsWithDueReminders();
    });

    // Manual Liabilities handlers
    secureHandle('manualLiabilities:getAll', () => {
      return this.db.getManualLiabilities();
    });

    secureHandle('manualLiabilities:getById', (_event, id: string) => {
      return this.db.getManualLiabilityById(id);
    });

    secureHandle('manualLiabilities:create', (_event, liability: Omit<ManualLiability, 'id' | 'createdAt' | 'lastUpdated'>) => {
      return this.db.createManualLiability(liability);
    });

    secureHandle('manualLiabilities:update', (_event, id: string, updates: Partial<Omit<ManualLiability, 'id' | 'createdAt'>>) => {
      const parsedUpdates = {
        ...updates,
        startDate: updates.startDate ? new Date(updates.startDate) : updates.startDate === null ? null : undefined,
        payoffDate: updates.payoffDate ? new Date(updates.payoffDate) : updates.payoffDate === null ? null : undefined,
        lastUpdated: updates.lastUpdated ? new Date(updates.lastUpdated) : undefined,
      };
      // Remove undefined values
      Object.keys(parsedUpdates).forEach(key => {
        if (parsedUpdates[key as keyof typeof parsedUpdates] === undefined) {
          delete parsedUpdates[key as keyof typeof parsedUpdates];
        }
      });
      return this.db.updateManualLiability(id, parsedUpdates as Partial<Omit<ManualLiability, 'id' | 'createdAt'>>);
    });

    secureHandle('manualLiabilities:delete', (_event, id: string) => {
      return this.db.deleteManualLiability(id);
    });

    // Net Worth Snapshots handlers
    secureHandle('netWorth:getSnapshots', (_event, limit?: number) => {
      return this.db.getNetWorthSnapshots(limit);
    });

    secureHandle('netWorth:getSnapshotsByRange', (_event, startDate: number, endDate: number) => {
      return this.db.getNetWorthSnapshotsByDateRange(startDate, endDate);
    });

    secureHandle('netWorth:getLatest', () => {
      return this.db.getLatestNetWorthSnapshot();
    });

    secureHandle('netWorth:createSnapshot', (_event, snapshot: Omit<NetWorthSnapshot, 'id' | 'createdAt'>) => {
      return this.db.createNetWorthSnapshot({
        ...snapshot,
        date: new Date(snapshot.date),
      });
    });

    // Net Worth Calculation handlers (Phase 5 - v1.1)
    secureHandle('netWorth:calculate', () => {
      return this.netWorthEngine.calculateCurrent();
    });

    secureHandle('netWorth:forceSnapshot', () => {
      return this.netWorthEngine.calculateAndSnapshot();
    });

    secureHandle('netWorth:getChangeSummary', (_event, startDate: number, endDate: number) => {
      return this.netWorthEngine.getChangeSummary(startDate, endDate);
    });

    secureHandle('netWorth:getProjections', (_event, config: NetWorthProjectionConfig) => {
      return this.netWorthEngine.generateProjections(config);
    });

    secureHandle('netWorth:calculateLoanPayoff', (_event, liabilityId: string) => {
      return this.netWorthEngine.calculateLoanPayoff(liabilityId);
    });

    secureHandle('netWorth:calculateExtraPaymentImpact', (_event, liabilityId: string, extraPayment: number) => {
      return this.netWorthEngine.calculateExtraPaymentImpact(liabilityId, extraPayment);
    });

    // Asset Value History handlers
    secureHandle('assetHistory:getByAsset', (_event, assetId: string) => {
      return this.db.getAssetValueHistory(assetId);
    });

    secureHandle('assetHistory:create', (_event, history: Omit<AssetValueHistory, 'id' | 'createdAt'>) => {
      return this.db.createAssetValueHistory({
        ...history,
        date: new Date(history.date),
      });
    });

    // Liability Value History handlers
    secureHandle('liabilityHistory:getByLiability', (_event, liabilityId: string) => {
      return this.db.getLiabilityValueHistory(liabilityId);
    });

    secureHandle('liabilityHistory:create', (_event, history: Omit<LiabilityValueHistory, 'id' | 'createdAt'>) => {
      return this.db.createLiabilityValueHistory({
        ...history,
        date: new Date(history.date),
      });
    });

    // ==================== Phase 4: Savings Goals ====================
    secureHandle('savingsGoals:getAll', () => {
      return this.db.getSavingsGoals();
    });

    secureHandle('savingsGoals:getActive', () => {
      return this.db.getActiveSavingsGoals();
    });

    secureHandle('savingsGoals:getById', (_event, id: string) => {
      return this.db.getSavingsGoalById(id);
    });

    secureHandle('savingsGoals:create', (_event, goal: Omit<SavingsGoal, 'id' | 'createdAt'>) => {
      return this.db.createSavingsGoal({
        ...goal,
        targetDate: goal.targetDate ? new Date(goal.targetDate) : null,
      });
    });

    secureHandle('savingsGoals:update', (_event, id: string, updates: Partial<Omit<SavingsGoal, 'id' | 'createdAt'>>) => {
      const parsedUpdates = updates.targetDate
        ? { ...updates, targetDate: new Date(updates.targetDate) }
        : updates;
      return this.db.updateSavingsGoal(id, parsedUpdates);
    });

    secureHandle('savingsGoals:delete', (_event, id: string) => {
      return this.db.deleteSavingsGoal(id);
    });

    // Savings Contributions
    secureHandle('savingsContributions:getAll', (_event, goalId: string) => {
      return this.db.getSavingsContributions(goalId);
    });

    secureHandle('savingsContributions:getById', (_event, id: string) => {
      return this.db.getSavingsContributionById(id);
    });

    secureHandle('savingsContributions:create', (_event, contribution: Omit<SavingsContribution, 'id' | 'createdAt'>) => {
      return this.db.createSavingsContribution({
        ...contribution,
        date: new Date(contribution.date),
      });
    });

    secureHandle('savingsContributions:delete', (_event, id: string) => {
      return this.db.deleteSavingsContribution(id);
    });

    // Savings Goal Account Pinning
    secureHandle('savingsGoals:pinAccount', (_event, goalId: string, accountId: string) => {
      // Update the goal's accountId
      this.db.updateSavingsGoal(goalId, { accountId });

      // Retroactively create contributions from existing account transactions
      this.db.createContributionsFromAccountTransactions(goalId, accountId);

      // Sync the goal's currentAmount with the account balance
      this.db.syncSavingsGoalWithAccount(goalId);

      // Mark all account transactions as internal transfers
      const transactions = this.db.getTransactionsByAccount(accountId);
      for (const txn of transactions) {
        if (!txn.isInternalTransfer) {
          this.db.updateTransaction(txn.id, { isInternalTransfer: true });
        }
      }

      return this.db.getSavingsGoalById(goalId);
    });

    secureHandle('savingsGoals:unpinAccount', (_event, goalId: string) => {
      // Set accountId to null; currentAmount keeps last synced value
      this.db.updateSavingsGoal(goalId, { accountId: null });
      return this.db.getSavingsGoalById(goalId);
    });

    secureHandle('savingsGoals:syncWithAccount', (_event, goalId: string) => {
      this.db.syncSavingsGoalWithAccount(goalId);
      return this.db.getSavingsGoalById(goalId);
    });

    secureHandle('savingsGoals:getGrowthData', (_event, goalId: string) => {
      return this.db.getSavingsGrowthData(goalId);
    });

    secureHandle('savingsGoals:getMonthlyContributions', (_event, goalId: string) => {
      return this.db.getMonthlyContributionSummary(goalId);
    });

    secureHandle('savingsGoals:getAlerts', () => {
      const goals = this.db.getActiveSavingsGoals();
      const now = new Date();
      const alerts: Array<{
        goalId: string;
        goalName: string;
        type: 'milestone' | 'deadline_warning' | 'completed' | 'at_risk';
        message: string;
        color: string | null;
        progress: number;
        severity: 'info' | 'warning' | 'success';
      }> = [];

      for (const goal of goals) {
        const progress = goal.targetAmount > 0 ? (goal.currentAmount / goal.targetAmount) * 100 : 0;

        // Completed
        if (progress >= 100) {
          alerts.push({
            goalId: goal.id,
            goalName: goal.name,
            type: 'completed',
            message: `Goal reached! ${goal.name} is fully funded.`,
            color: goal.color ?? null,
            progress,
            severity: 'success',
          });
          continue;
        }

        // Deadline passed
        if (goal.targetDate && new Date(goal.targetDate) < now && progress < 100) {
          alerts.push({
            goalId: goal.id,
            goalName: goal.name,
            type: 'deadline_warning',
            message: `Deadline passed for ${goal.name} (${progress.toFixed(0)}% complete).`,
            color: goal.color ?? null,
            progress,
            severity: 'warning',
          });
          continue;
        }

        // At risk (deadline within 30 days, progress < 90%)
        if (goal.targetDate) {
          const daysLeft = Math.ceil((new Date(goal.targetDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          if (daysLeft <= 30 && daysLeft > 0 && progress < 90) {
            alerts.push({
              goalId: goal.id,
              goalName: goal.name,
              type: 'at_risk',
              message: `${goal.name} is at risk — ${daysLeft} days left, only ${progress.toFixed(0)}% funded.`,
              color: goal.color ?? null,
              progress,
              severity: 'warning',
            });
            continue;
          }
        }

        // Milestone crossings (25%, 50%, 75%, 80%)
        for (const milestone of [80, 75, 50, 25]) {
          if (progress >= milestone && progress < milestone + 10) {
            alerts.push({
              goalId: goal.id,
              goalName: goal.name,
              type: 'milestone',
              message: `${goal.name} passed ${milestone}% — keep it up!`,
              color: goal.color ?? null,
              progress,
              severity: 'info',
            });
            break;
          }
        }
      }

      return alerts;
    });

    // ==================== Phase 5: Investments ====================
    secureHandle('investments:getAll', () => {
      return this.db.getInvestments();
    });

    secureHandle('investments:getById', (_event, id: string) => {
      return this.db.getInvestmentById(id);
    });

    secureHandle('investments:create', (_event, investment: Omit<Investment, 'id' | 'createdAt'>) => {
      return this.db.createInvestment({
        ...investment,
        lastUpdated: new Date(investment.lastUpdated),
      });
    });

    secureHandle('investments:update', (_event, id: string, updates: Partial<Omit<Investment, 'id' | 'createdAt'>>) => {
      const parsedUpdates = updates.lastUpdated
        ? { ...updates, lastUpdated: new Date(updates.lastUpdated) }
        : updates;
      return this.db.updateInvestment(id, parsedUpdates);
    });

    secureHandle('investments:delete', (_event, id: string) => {
      return this.db.deleteInvestment(id);
    });

    secureHandle('investments:getTotal', () => {
      return this.db.getTotalInvestmentValue();
    });

    // Investment History
    secureHandle('investmentHistory:getAll', (_event, investmentId: string) => {
      return this.db.getInvestmentHistory(investmentId);
    });

    secureHandle('investmentHistory:create', (_event, history: Omit<InvestmentHistory, 'id'>) => {
      return this.db.createInvestmentHistory({
        ...history,
        date: new Date(history.date),
      });
    });

    // ==================== Phase 6: Receipts ====================
    secureHandle('receipts:getAll', () => {
      return this.db.getReceipts();
    });

    secureHandle('receipts:getById', (_event, id: string) => {
      return this.db.getReceiptById(id);
    });

    secureHandle('receipts:getByTransaction', (_event, transactionId: string) => {
      return this.db.getReceiptByTransaction(transactionId);
    });

    secureHandle('receipts:create', (_event, receipt: Omit<Receipt, 'id'>) => {
      return this.db.createReceipt({
        ...receipt,
        uploadedAt: new Date(receipt.uploadedAt),
        processedAt: receipt.processedAt ? new Date(receipt.processedAt) : null,
      });
    });

    secureHandle('receipts:update', (_event, id: string, updates: Partial<Omit<Receipt, 'id'>>) => {
      const parsedUpdates: Partial<Omit<Receipt, 'id'>> = { ...updates };
      if (updates.uploadedAt) parsedUpdates.uploadedAt = new Date(updates.uploadedAt);
      if (updates.processedAt) parsedUpdates.processedAt = new Date(updates.processedAt);
      return this.db.updateReceipt(id, parsedUpdates);
    });

    secureHandle('receipts:delete', (_event, id: string) => {
      return this.db.deleteReceipt(id);
    });

    // ==================== Unified Recurring Items ====================
    secureHandle('recurring:getAll', () => {
      return this.db.getRecurringItems();
    });

    secureHandle('recurring:migrate', () => {
      // Force re-run migration to pick up any missed items from old tables
      this.db.migrateToRecurringItems();
      return this.db.getRecurringItems();
    });

    secureHandle('recurring:getActive', () => {
      return this.db.getActiveRecurringItems();
    });

    secureHandle('recurring:getById', (_event, id: string) => {
      return this.db.getRecurringItemById(id);
    });

    secureHandle('recurring:getByAccount', (_event, accountId: string) => {
      return this.db.getRecurringItemsByAccount(accountId);
    });

    secureHandle('recurring:create', (_event, item: Omit<RecurringItem, 'id' | 'createdAt'>) => {
      return this.db.createRecurringItem({
        ...item,
        startDate: new Date(item.startDate),
        nextOccurrence: new Date(item.nextOccurrence),
        endDate: item.endDate ? new Date(item.endDate) : null,
      });
    });

    secureHandle('recurring:update', (_event, id: string, updates: Partial<Omit<RecurringItem, 'id' | 'createdAt'>>) => {
      const parsedUpdates: Partial<Omit<RecurringItem, 'id' | 'createdAt'>> = { ...updates };
      if (updates.startDate) parsedUpdates.startDate = new Date(updates.startDate);
      if (updates.nextOccurrence) parsedUpdates.nextOccurrence = new Date(updates.nextOccurrence);
      if (updates.endDate) parsedUpdates.endDate = new Date(updates.endDate);
      return this.db.updateRecurringItem(id, parsedUpdates);
    });

    secureHandle('recurring:delete', (_event, id: string) => {
      return this.db.deleteRecurringItem(id);
    });

    // Recurring Payments
    secureHandle('recurringPayments:getAll', (_event, recurringItemId: string) => {
      return this.db.getRecurringPayments(recurringItemId);
    });

    secureHandle('recurringPayments:getById', (_event, id: string) => {
      return this.db.getRecurringPaymentById(id);
    });

    secureHandle('recurringPayments:getUpcoming', (_event, days?: number) => {
      return this.db.getUpcomingRecurringPayments(days);
    });

    secureHandle('recurringPayments:create', (_event, payment: Omit<RecurringPayment, 'id' | 'createdAt'>) => {
      return this.db.createRecurringPayment({
        ...payment,
        dueDate: new Date(payment.dueDate),
        paidDate: payment.paidDate ? new Date(payment.paidDate) : null,
      });
    });

    secureHandle('recurringPayments:update', (_event, id: string, updates: Partial<Omit<RecurringPayment, 'id' | 'createdAt' | 'recurringItemId'>>) => {
      const parsedUpdates: Partial<Omit<RecurringPayment, 'id' | 'createdAt' | 'recurringItemId'>> = { ...updates };
      if (updates.dueDate) parsedUpdates.dueDate = new Date(updates.dueDate);
      if (updates.paidDate) parsedUpdates.paidDate = new Date(updates.paidDate);
      return this.db.updateRecurringPayment(id, parsedUpdates);
    });

    secureHandle('recurringPayments:delete', (_event, id: string) => {
      return this.db.deleteRecurringPayment(id);
    });

    // Recurring Detection handlers
    secureHandle('recurringDetection:analyze', () => {
      const transactions = excludeTransfers(this.db.getTransactions());
      // Use unified recurring items for detection
      const recurringItems = this.db.getRecurringItems();
      const existingDescriptions = recurringItems.map(r => r.description);

      return detectRecurringPayments(
        transactions,
        existingDescriptions,
        [] // No separate bills anymore
      );
    });

    // New unified approve handler
    secureHandle('recurringDetection:approve', async (_event, suggestion: RecurringSuggestion, enableReminders: boolean, itemType?: string) => {
      const resolvedItemType = (itemType as 'bill' | 'subscription' | 'cashflow') || (enableReminders ? 'bill' : 'cashflow');
      const item = this.db.createRecurringItem({
        description: suggestion.description,
        amount: suggestion.type === 'income' ? Math.abs(suggestion.averageAmount) : -Math.abs(suggestion.averageAmount),
        frequency: toUnifiedFrequency(suggestion.frequency),
        startDate: suggestion.lastOccurrence,
        nextOccurrence: suggestion.nextExpected,
        accountId: suggestion.accountId,
        endDate: null,
        categoryId: suggestion.categoryId,
        dayOfMonth: suggestion.dayOfMonth ?? null,
        dayOfWeek: suggestion.dayOfWeek ?? null,
        itemType: resolvedItemType,
        enableReminders,
        reminderDays: enableReminders ? 3 : null,
        autopay: false,
        isActive: true,
      });

      return { success: true, item };
    });

    // Legacy handlers for backwards compatibility
    secureHandle('recurringDetection:approveAsBill', async (_event, suggestion: RecurringSuggestion) => {
      // Create a bill from the suggestion (legacy - now creates a recurring item with reminders)
      const bill = this.db.createBill({
        name: suggestion.description,
        amount: suggestion.averageAmount,
        dueDay: suggestion.dayOfMonth || new Date(suggestion.lastOccurrence).getDate(),
        frequency: toBillFrequency(suggestion.frequency),
        categoryId: suggestion.categoryId,
        autopay: false,
        reminderDays: 3,
        isActive: true,
      });

      return { success: true, bill };
    });

    secureHandle('recurringDetection:approveAsRecurring', async (_event, suggestion: RecurringSuggestion) => {
      // Create a recurring transaction from the suggestion (legacy)
      const recurring = this.db.createRecurringTransaction({
        accountId: suggestion.accountId,
        description: suggestion.description,
        amount: -suggestion.averageAmount, // Negative for expenses
        categoryId: suggestion.categoryId,
        frequency: toRecurringFrequency(suggestion.frequency),
        startDate: suggestion.lastOccurrence,
        endDate: null,
        nextOccurrence: suggestion.nextExpected,
      });

      return { success: true, recurring };
    });

    // ==================== Phase 7: Prediction & Reporting ====================

    // Anomaly Detection
    secureHandle('anomalyDetection:detect', (_event, options?: {
      zScoreThreshold?: number;
      historyDays?: number;
      lookbackDays?: number;
      gracePeriodDays?: number;
      duplicateWindowDays?: number;
    }) => {
      return this.anomalyDetectionEngine.detectAnomalies(options);
    });

    secureHandle('anomalyDetection:detectUnusualAmounts', (_event, zScoreThreshold?: number, historyDays?: number, lookbackDays?: number) => {
      return this.anomalyDetectionEngine.detectUnusualAmounts(zScoreThreshold, historyDays, lookbackDays);
    });

    secureHandle('anomalyDetection:detectMissingRecurring', (_event, gracePeriodDays?: number) => {
      return this.anomalyDetectionEngine.detectMissingRecurring(gracePeriodDays);
    });

    secureHandle('anomalyDetection:detectDuplicateCharges', (_event, windowDays?: number, lookbackDays?: number) => {
      return this.anomalyDetectionEngine.detectDuplicateCharges(windowDays, lookbackDays);
    });

    // Seasonal Analysis
    secureHandle('seasonalAnalysis:analyze', (_event, options?: {
      minMonths?: number;
      spikeThreshold?: number;
    }) => {
      const result = this.seasonalAnalysisEngine.analyzeSeasonalPatterns(options);

      // Store patterns in database for caching
      for (const pattern of result.patterns) {
        this.db.upsertSeasonalPattern({
          categoryId: pattern.categoryId,
          year: pattern.year,
          month: pattern.month,
          averageSpending: pattern.averageSpending,
          transactionCount: pattern.transactionCount,
          seasonalIndex: pattern.seasonalIndex,
        });
      }

      return result;
    });

    secureHandle('seasonalAnalysis:getPatterns', (_event, categoryId?: string) => {
      return this.db.getSeasonalPatterns(categoryId);
    });

    secureHandle('seasonalAnalysis:predictMonthlySpending', (_event, categoryId: string, month: number) => {
      return this.seasonalAnalysisEngine.predictMonthlySpending(categoryId, month);
    });

    secureHandle('seasonalAnalysis:detectHolidaySpikes', (_event, spikeThreshold?: number) => {
      return this.seasonalAnalysisEngine.detectHolidaySpikes(spikeThreshold);
    });

    // Income Analysis
    secureHandle('incomeAnalysis:analyze', (_event, options?: {
      historyDays?: number;
      minOccurrences?: number;
    }) => {
      return this.incomeAnalysisEngine.analyzeIncome(options);
    });

    secureHandle('incomeAnalysis:identifyStreams', (_event, options?: {
      historyDays?: number;
      minOccurrences?: number;
    }) => {
      return this.incomeAnalysisEngine.identifyIncomeStreams(options);
    });

    secureHandle('incomeAnalysis:getSmoothedIncome', (_event, windowMonths?: number) => {
      return this.incomeAnalysisEngine.calculateSmoothedIncome(windowMonths);
    });

    // Financial Health History
    secureHandle('financialHealth:getHistory', (_event, limit?: number) => {
      return this.db.getFinancialHealthHistory(limit);
    });

    secureHandle('financialHealth:getLatest', () => {
      return this.db.getLatestFinancialHealthScore();
    });

    secureHandle('financialHealth:createSnapshot', (_event, data: {
      overallScore: number;
      factorScores: string;
    }) => {
      return this.db.createFinancialHealthSnapshot(data);
    });

    // Bill Preferences (for cash flow optimization)
    secureHandle('billPreferences:getAll', () => {
      return this.db.getBillPreferences();
    });

    secureHandle('billPreferences:getByRecurringItem', (_event, recurringItemId: string) => {
      return this.db.getBillPreferenceByRecurringItem(recurringItemId);
    });

    secureHandle('billPreferences:upsert', (_event, data: {
      recurringItemId: string;
      preferredDueDay?: number | null;
      notes?: string | null;
    }) => {
      return this.db.upsertBillPreference(data);
    });

    secureHandle('billPreferences:delete', (_event, recurringItemId: string) => {
      return this.db.deleteBillPreference(recurringItemId);
    });

    // Spending Velocity
    secureHandle('spendingVelocity:calculate', (_event, period?: 'weekly' | 'monthly' | 'yearly') => {
      return this.spendingVelocityEngine.calculateSpendingVelocity(period);
    });

    secureHandle('spendingVelocity:forCategory', (_event, categoryId: string, period?: 'weekly' | 'monthly' | 'yearly') => {
      return this.spendingVelocityEngine.calculateCategoryVelocity(categoryId, period);
    });

    // Comparison Reports
    secureHandle('comparison:generate', (_event, type?: 'month_over_month' | 'year_over_year') => {
      return this.comparisonEngine.generateComparisonReport(type);
    });

    secureHandle('comparison:budgetAdherenceHistory', (_event, monthsBack?: number) => {
      return this.comparisonEngine.getBudgetAdherenceHistory(monthsBack);
    });

    // Subscription Audit
    secureHandle('subscriptionAudit:audit', (_event, options?: {
      includeInactive?: boolean;
      minMonthlyCost?: number;
    }) => {
      return this.subscriptionAuditEngine.auditSubscriptions(options);
    });

    // Financial Health
    secureHandle('financialHealthCalc:calculate', () => {
      const previousScore = this.db.getLatestFinancialHealthScore()?.overallScore;
      const result = this.financialHealthEngine.calculateFinancialHealth(previousScore);

      // Save snapshot to history
      this.db.createFinancialHealthSnapshot({
        overallScore: result.overallScore,
        factorScores: JSON.stringify(result.factors),
      });

      return result;
    });

    // ==================== Phase 3: Goal & Debt Projections ====================

    // Savings Projections
    secureHandle('savingsProjection:generate', (_event, options?: {
      aggressiveMultiplier?: number;
      conservativeMultiplier?: number;
    }) => {
      return this.savingsProjectionEngine.generateReport(options);
    });

    secureHandle('savingsProjection:forGoal', (_event, goalId: string, options?: {
      aggressiveMultiplier?: number;
      conservativeMultiplier?: number;
    }) => {
      return this.savingsProjectionEngine.projectGoal(goalId, options);
    });

    // Debt Payoff
    secureHandle('debtPayoff:generate', (_event, options?: {
      extraPaymentAmounts?: number[];
    }) => {
      return this.debtPayoffEngine.generateReport(options);
    });

    secureHandle('debtPayoff:calculateStrategy', (_event, strategy: 'minimum' | 'snowball' | 'avalanche', extraMonthly?: number) => {
      return this.debtPayoffEngine.calculateStrategy(strategy, extraMonthly);
    });

    // Net Worth Projection
    secureHandle('netWorthProjection:generate', (_event, options?: {
      projectionMonths?: number;
      confidenceLevel?: number;
    }) => {
      return this.netWorthProjectionEngine.generateProjection(options);
    });

    secureHandle('netWorthProjection:getTrend', () => {
      return this.netWorthProjectionEngine.getTrend();
    });

    secureHandle('netWorthProjection:getMilestones', () => {
      return this.netWorthProjectionEngine.getMilestones();
    });

    // ==================== Phase 4: Cash Flow Intelligence ====================

    // Category Migration
    secureHandle('categoryMigration:analyze', (_event, options?: {
      monthsBack?: number;
      shiftThreshold?: number;
    }) => {
      return this.categoryMigrationEngine.analyze(options);
    });

    secureHandle('categoryMigration:getPeriods', (_event, monthsBack?: number) => {
      return this.categoryMigrationEngine.getPeriodBreakdowns(monthsBack);
    });

    // Cash Flow Optimization
    secureHandle('cashFlowOptimization:optimize', (_event, options?: {
      projectionDays?: number;
      warningThreshold?: number;
      criticalThreshold?: number;
    }) => {
      return this.cashFlowOptimizationEngine.optimize(options);
    });

    secureHandle('cashFlowOptimization:getProjections', (_event, days?: number) => {
      return this.cashFlowOptimizationEngine.getProjections(days);
    });

    // ==================== Enhanced Forecast (5-Year Support) ====================

    secureHandle('forecast:categoryLongTerm', (_event, categoryId: string, options: {
      forecastDays: number;
      granularity?: 'daily' | 'weekly' | 'monthly';
      trendDampeningFactor?: number;
      historyMonths?: number;
    }) => {
      return this.enhancedForecastEngine.forecastCategorySpendingLongTerm(categoryId, {
        ...options,
        includeCategoryTrends: true,
      });
    });

    secureHandle('forecast:allCategoriesLongTerm', (_event, options: {
      forecastDays: number;
      granularity?: 'daily' | 'weekly' | 'monthly';
      trendDampeningFactor?: number;
      historyMonths?: number;
    }) => {
      return this.enhancedForecastEngine.forecastAllCategoriesLongTerm({
        ...options,
        includeCategoryTrends: true,
      });
    });

    secureHandle('cashflow:forecastEnhanced', (_event, accountId: string, options: {
      forecastDays: number;
      granularity?: 'daily' | 'weekly' | 'monthly';
      includeCategoryTrends?: boolean;
      trendDampeningFactor?: number;
      historyMonths?: number;
    }, lowBalanceThreshold?: number) => {
      return this.enhancedCashFlowEngine.forecastCashFlowEnhanced(
        accountId,
        options as ExtendedForecastOptions,
        lowBalanceThreshold
      );
    });

    secureHandle('forecast:selectGranularity', (_event, forecastDays: number) => {
      return this.enhancedCashFlowEngine.selectGranularity(forecastDays);
    });

    // ==================== Recovery Plan ====================
    secureHandle('recoveryPlan:generate', (_event, options?: { thresholdDays?: number }) => {
      return this.recoveryPlanEngine.generateRecoveryPlan(options);
    });

    secureHandle('recoveryPlan:getQuickWins', () => {
      return this.recoveryPlanEngine.getQuickWins();
    });

    secureHandle('recoveryPlan:simulateScenario', (_event, modifications: ScenarioModification[], projectionDays?: number) => {
      return this.recoveryPlanEngine.simulateScenario(modifications, projectionDays);
    });

    secureHandle('recoveryPlan:getEmergencyStatus', (_event, thresholdDays?: number) => {
      return this.recoveryPlanEngine.getEmergencyStatus(thresholdDays);
    });

    secureHandle('recoveryPlan:getSurvivalMode', () => {
      return this.recoveryPlanEngine.getSurvivalMode();
    });

    secureHandle('recoveryPlan:applyQuickWin', async (_event, quickWin: QuickWin) => {
      // Apply quick win based on type
      switch (quickWin.type) {
        case 'cancel_subscription':
        case 'pause_expense': {
          const recurringItemId = quickWin.metadata.recurringItemId as string;
          if (recurringItemId) {
            await this.db.updateRecurringItem(recurringItemId, { isActive: false });
            return { success: true, action: 'deactivated', itemId: recurringItemId };
          }
          break;
        }
        case 'move_bill_due_date': {
          const itemId = quickWin.metadata.recurringItemId as string;
          const newDay = quickWin.metadata.recommendedDay as number;
          if (itemId && newDay) {
            await this.db.updateRecurringItem(itemId, { dayOfMonth: newDay });
            return { success: true, action: 'updated_due_date', itemId, newDay };
          }
          break;
        }
        case 'reduce_budget': {
          const categoryId = quickWin.metadata.categoryId as string;
          const suggestedAmount = quickWin.metadata.suggestedAmount as number;
          if (categoryId && suggestedAmount) {
            const existingGoal = this.db.getBudgetGoalByCategory(categoryId);
            if (existingGoal) {
              await this.db.updateBudgetGoal(existingGoal.id, { amount: suggestedAmount });
              return { success: true, action: 'updated_budget', goalId: existingGoal.id };
            }
          }
          break;
        }
        default:
          return { success: false, error: 'Action not implemented' };
      }
      return { success: false, error: 'Missing required metadata' };
    });

    // Investment Account handlers (v1.1)
    secureHandle('investmentAccounts:getAll', () => {
      return this.db.getInvestmentAccounts();
    });

    secureHandle('investmentAccounts:getById', (_event, id: string) => {
      return this.db.getInvestmentAccountById(id);
    });

    secureHandle('investmentAccounts:create', (_event, account: Omit<InvestmentAccount, 'id' | 'createdAt'>) => {
      return this.db.createInvestmentAccount(account);
    });

    secureHandle('investmentAccounts:update', (_event, id: string, updates: Partial<Omit<InvestmentAccount, 'id' | 'createdAt'>>) => {
      return this.db.updateInvestmentAccount(id, updates);
    });

    secureHandle('investmentAccounts:delete', (_event, id: string) => {
      return this.db.deleteInvestmentAccount(id);
    });

    // Holdings handlers (v1.1)
    secureHandle('holdings:getAll', () => {
      return this.db.getHoldings();
    });

    secureHandle('holdings:getByAccount', (_event, accountId: string) => {
      return this.db.getHoldingsByAccount(accountId);
    });

    secureHandle('holdings:getById', (_event, id: string) => {
      return this.db.getHoldingById(id);
    });

    secureHandle('holdings:create', (_event, holding: Omit<Holding, 'id' | 'createdAt' | 'sharesOwned' | 'avgCostPerShare'>) => {
      return this.db.createHolding(holding);
    });

    secureHandle('holdings:update', (_event, id: string, updates: Partial<Omit<Holding, 'id' | 'createdAt' | 'sharesOwned' | 'avgCostPerShare'>>) => {
      return this.db.updateHolding(id, updates);
    });

    secureHandle('holdings:delete', (_event, id: string) => {
      return this.db.deleteHolding(id);
    });

    secureHandle('holdings:bulkDelete', (_event, ids: string[]) => {
      return this.db.bulkDeleteHoldings(ids);
    });

    // Cost Basis Lots handlers (v1.1)
    secureHandle('lots:getByHolding', (_event, holdingId: string) => {
      return this.db.getLotsByHolding(holdingId);
    });

    secureHandle('lots:getById', (_event, id: string) => {
      return this.db.getLotById(id);
    });

    secureHandle('lots:create', (_event, lot: Omit<CostBasisLot, 'id' | 'createdAt'>) => {
      return this.db.createLot(lot);
    });

    secureHandle('lots:update', (_event, id: string, updates: Partial<Omit<CostBasisLot, 'id' | 'createdAt' | 'holdingId'>>) => {
      return this.db.updateLot(id, updates);
    });

    secureHandle('lots:delete', (_event, id: string) => {
      return this.db.deleteLot(id);
    });

    // ============== Price Service Handlers ==============

    // Fetch price for single symbol (from cache or API)
    secureHandle('prices:get', async (_event, symbol: string): Promise<PriceCacheEntry | null> => {
      const cached = priceStorage.get(symbol);

      // Return cached if fresh or manual
      if (cached && (priceStorage.isFresh(symbol) || cached.manual)) {
        return cached;
      }

      // Fetch from API
      try {
        const result: PriceResult = await this.priceService.fetchPrice(symbol);
        const entry: PriceCacheEntry = {
          ...result,
          manual: false,
        };
        priceStorage.set(entry.symbol, entry.price, entry.change, entry.changePercent, entry.currency, false);
        return entry;
      } catch (error) {
        // Return stale cache on error, or null if no cache
        return cached ?? null;
      }
    });

    // Fetch price from API (force refresh, respects manual)
    secureHandle('prices:fetch', async (_event, symbol: string): Promise<PriceCacheEntry | null> => {
      // Skip if manual override exists
      const cached = priceStorage.get(symbol);
      if (cached && cached.manual) {
        return cached;
      }

      try {
        const result: PriceResult = await this.priceService.fetchPrice(symbol);
        const entry: PriceCacheEntry = {
          ...result,
          manual: false,
        };
        priceStorage.set(entry.symbol, entry.price, entry.change, entry.changePercent, entry.currency, false);
        return entry;
      } catch (error) {
        // Return cached on error
        return priceStorage.get(symbol);
      }
    });

    // Batch fetch prices with progress
    secureHandle('prices:fetchBatch', async (
      event,
      symbols: string[],
      options?: { skipManual?: boolean }
    ): Promise<{ results: PriceCacheEntry[]; errors: Array<{ symbol: string; error: string }> }> => {
      const skipManual = options?.skipManual ?? true;

      // Filter out manual symbols if requested
      const symbolsToFetch: string[] = [];
      if (skipManual) {
        for (const s of symbols) {
          const cached = priceStorage.get(s);
          if (!(cached && cached.manual)) {
            symbolsToFetch.push(s);
          }
        }
      } else {
        symbolsToFetch.push(...symbols);
      }

      // Send progress updates via IPC
      const sendProgress = (progress: { completed: number; total: number; currentSymbol: string }) => {
        event.sender.send('prices:progress', progress);
      };

      const results = await this.priceService.fetchPrices(symbolsToFetch, sendProgress);

      // Identify errors (prices with 0 value indicate fetch failures)
      const errors: Array<{ symbol: string; error: string }> = [];

      // Convert to cache entries and store only successful results
      const cacheEntries: PriceCacheEntry[] = results
        .filter(result => result.price > 0)
        .map((result: PriceResult) => ({
          ...result,
          manual: false,
        }));

      // Track errors for zero-price results
      results
        .filter(result => result.price === 0)
        .forEach(result => {
          errors.push({ symbol: result.symbol, error: 'Failed to fetch price' });
        });

      priceStorage.setMany(cacheEntries);

      // Include manual prices in results
      if (skipManual) {
        for (const s of symbols) {
          const cached = priceStorage.get(s);
          if (cached && cached.manual) {
            cacheEntries.push(cached);
          }
        }
      }

      return { results: cacheEntries, errors };
    });

    // Get cached prices (no API call)
    secureHandle('prices:getCached', async (_event, symbols: string[]): Promise<Record<string, PriceCacheEntry>> => {
      const result: Record<string, PriceCacheEntry> = {};
      for (const symbol of symbols) {
        const cached = priceStorage.get(symbol);
        if (cached) {
          result[symbol.toUpperCase()] = cached;
        }
      }
      return result;
    });

    // Set manual price override
    secureHandle('prices:setManual', async (_event, symbol: string, priceInCents: number): Promise<PriceCacheEntry> => {
      priceStorage.set(symbol, priceInCents, 0, 0, 'USD', true);
      return priceStorage.get(symbol)!;
    });

    // Clear manual price override
    secureHandle('prices:clearManual', async (_event, symbol: string): Promise<boolean> => {
      return priceStorage.clearManualPrice(symbol);
    });

    // Check if price is stale (>1 hour old)
    secureHandle('prices:isStale', async (_event, symbol: string): Promise<boolean> => {
      return priceStorage.isStale(symbol);
    });

    // Get cache statistics
    secureHandle('prices:getStats', async (): Promise<{ total: number; manual: number; stale: number; fresh: number }> => {
      const stats = priceStorage.getStatistics();
      return {
        total: stats.totalEntries,
        manual: stats.manualEntries,
        stale: stats.staleEntries,
        fresh: stats.freshEntries,
      };
    });

    // Validate symbol exists
    secureHandle('prices:validateSymbol', async (_event, symbol: string): Promise<boolean> => {
      // PriceService.validateSymbol is static, but for now we'll do a simple validation
      // or expose a public method
      const symbolPattern = /^[A-Z0-9]{1,5}(\.[A-Z]{1,3})?$/i;
      return symbolPattern.test(symbol.trim());
    });

    // ==================== Holdings Import IPC Handlers (Phase 6) ====================

    secureHandle('holdings:import:selectFile', async (event) => {
      const win = BrowserWindow.fromWebContents(event.sender);
      return selectImportFile(win);
    });

    secureHandle(
      'holdings:import:preview',
      async (
        _,
        filePath: string,
        accountId: string,
        columnMapping?: ColumnMapping
      ) => {
        return generateImportPreview(this.db, filePath, accountId, columnMapping);
      }
    );

    secureHandle(
      'holdings:import:commit',
      async (
        _,
        accountId: string,
        rows: ImportPreviewRow[],
        duplicateAction: DuplicateAction
      ) => {
        const result = commitImport(this.db, accountId, rows, duplicateAction);

        // Best-effort: fetch and persist prices for newly imported tickers
        if (result.imported > 0) {
          const importedTickers = rows
            .filter(r => r.selected && r.status !== 'error')
            .map(r => r.ticker.toUpperCase());
          const uniqueTickers = [...new Set(importedTickers)];

          // Fire-and-forget — don't block the import response
          this.priceService.fetchPrices(uniqueTickers).then(priceResults => {
            for (const pr of priceResults) {
              if (pr.price > 0) {
                priceStorage.set(pr.symbol, pr.price, pr.change, pr.changePercent, pr.currency, false);
                // Update holding's current_price in DB so it's correct even without live hook
                const holdings = this.db.getHoldingsByAccount(accountId);
                const holding = holdings.find(h => h.ticker.toUpperCase() === pr.symbol.toUpperCase());
                if (holding) {
                  this.db.updateHolding(holding.id, { currentPrice: pr.price });
                }
              }
            }
          }).catch(err => {
            console.error('Failed to fetch prices after import:', err);
          });
        }

        return result;
      }
    );

    secureHandle('holdings:import:formats', async () => {
      return getAvailableFormats();
    });

    // ==================== Transaction Import IPC Handlers ====================

    secureHandle('transactionImport:selectFile', async (event) => {
      const win = BrowserWindow.fromWebContents(event.sender);
      return selectTransactionImportFile(win);
    });

    secureHandle(
      'transactionImport:preview',
      async (
        _,
        filePath: string,
        accountId: string,
        columnMapping?: TransactionColumnMapping
      ) => {
        return generateTransactionImportPreview(this.db, filePath, accountId, columnMapping);
      }
    );

    secureHandle(
      'transactionImport:commit',
      async (
        _,
        accountId: string,
        rows: TransactionImportPreviewRow[],
        duplicateAction: DuplicateAction
      ) => {
        return commitTransactionImport(this.db, accountId, rows, duplicateAction, this.categorizationEngine);
      }
    );

    // ==================== Investment Transactions (Phase 3) ====================

    secureHandle('investmentTransactions:getAll', () => {
      return this.db.getInvestmentTransactions();
    });

    secureHandle('investmentTransactions:getByHolding', (_event, holdingId: string) => {
      return this.db.getInvestmentTransactionsByHolding(holdingId);
    });

    secureHandle('investmentTransactions:getById', (_event, id: string) => {
      return this.db.getInvestmentTransactionById(id);
    });

    secureHandle('investmentTransactions:create', (_event, tx: Omit<InvestmentTransaction, 'id' | 'createdAt' | 'lotId'>) => {
      return this.db.createInvestmentTransaction(tx);
    });

    secureHandle('investmentTransactions:update', (_event, id: string, updates: Partial<Omit<InvestmentTransaction, 'id' | 'createdAt'>>) => {
      return this.db.updateInvestmentTransaction(id, updates);
    });

    secureHandle('investmentTransactions:delete', (_event, id: string) => {
      return this.db.deleteInvestmentTransaction(id);
    });

    // Investment Settings handlers
    secureHandle('investmentSettings:get', () => {
      return this.db.getInvestmentSettings();
    });

    secureHandle('investmentSettings:update', (_event, settings: Partial<InvestmentSettings>) => {
      return this.db.createOrUpdateInvestmentSettings(settings);
    });

    // ==================== Performance Analytics handlers (Phase 4 - v1.1) ====================

    secureHandle('performance:getMetrics', async (_event, options: PerformanceOptions) => {
      // Get holdings data from database
      const holdings = this.db.getHoldings();
      const allPrices = priceStorage.getAll();

      // Transform to HoldingData format
      const holdingData: HoldingData[] = holdings.map(h => {
        const price = allPrices.get(h.ticker.toUpperCase());
        return {
          id: h.id,
          ticker: h.ticker,
          name: h.name ?? h.ticker,
          shares: h.sharesOwned / 10000, // Convert from storage format
          avgCostPerShare: h.avgCostPerShare,
          currentPrice: price?.price ?? h.currentPrice,
          previousClose: price ? price.price - price.change : undefined,
        };
      });

      // Get sell transactions
      const sellTxs = this.db.getSellTransactions();
      const sellTransactions: SellTransaction[] = sellTxs.map(tx => ({
        id: tx.id,
        holdingId: tx.holdingId,
        ticker: tx.ticker,
        date: new Date(tx.date),
        shares: tx.shares / 10000,
        pricePerShare: tx.pricePerShare,
        fees: tx.fees,
        costBasis: tx.costBasis,
        purchaseDate: new Date(tx.purchaseDate),
      }));

      // Get cash flow events (contributions/withdrawals)
      const cashFlowEvents = this.db.getInvestmentCashFlows();
      const cashFlows: CashFlowEvent[] = cashFlowEvents.map(cf => ({
        date: new Date(cf.date),
        amount: cf.amount,
        type: cf.type as 'contribution' | 'withdrawal' | 'dividend',
      }));

      // Calculate metrics
      const metrics = this.performanceEngine.calculatePerformanceMetrics(
        holdingData,
        sellTransactions,
        cashFlows,
        options
      );

      // Fetch benchmark if requested
      if (options.includeBenchmark) {
        try {
          const benchmark = await this.benchmarkService.fetchSP500Return(
            metrics.returns.startDate,
            metrics.returns.endDate
          );
          metrics.benchmarkReturn = benchmark.totalReturn;
          metrics.vsBenchmark = metrics.returns.twr - benchmark.totalReturn;
        } catch (error) {
          console.error('Failed to fetch benchmark:', error);
          // Continue without benchmark data
        }
      }

      return metrics;
    });

    secureHandle('performance:getPositionGainLoss', async (_event, holdingId: string) => {
      const holding = this.db.getHoldingById(holdingId);
      if (!holding) return null;

      const price = priceStorage.get(holding.ticker.toUpperCase());

      const holdingData: HoldingData = {
        id: holding.id,
        ticker: holding.ticker,
        name: holding.name ?? holding.ticker,
        shares: holding.sharesOwned / 10000,
        avgCostPerShare: holding.avgCostPerShare,
        currentPrice: price?.price ?? holding.currentPrice,
        previousClose: price ? price.price - price.change : undefined,
      };

      return this.performanceEngine.calculatePositionGainLoss(holdingData);
    });

    secureHandle('performance:getRealizedGains', async (_event, options: PerformanceOptions) => {
      const { startDate, endDate } = this.resolvePeriodDates(options);

      const sellTxs = this.db.getSellTransactionsByDateRange(startDate, endDate);

      return sellTxs.map(tx => {
        const sellTransaction: SellTransaction = {
          id: tx.id,
          holdingId: tx.holdingId,
          ticker: tx.ticker,
          date: new Date(tx.date),
          shares: tx.shares / 10000,
          pricePerShare: tx.pricePerShare,
          fees: tx.fees,
          costBasis: tx.costBasis,
          purchaseDate: new Date(tx.purchaseDate),
        };
        return this.performanceEngine.calculateRealizedGain(sellTransaction);
      });
    });

    secureHandle('performance:getBenchmark', async (_event, startDate: string, endDate: string) => {
      return this.benchmarkService.fetchSP500Return(new Date(startDate), new Date(endDate));
    });

    // User preference for period
    secureHandle('performance:getDefaultPeriod', () => {
      return this.db.getSetting('performancePeriod', 'YTD');
    });

    secureHandle('performance:setDefaultPeriod', (_event, period: string) => {
      this.db.setSetting('performancePeriod', period);
    });

    // Category Trends preferences
    secureHandle('categoryTrends:getSelectedCategories', () => {
      return this.db.getSetting('categoryTrendsSelectedCategories', '');
    });

    secureHandle('categoryTrends:setSelectedCategories', (_event, categoryIds: string) => {
      this.db.setSetting('categoryTrendsSelectedCategories', categoryIds);
    });

    // ==================== Budget Income Override ====================
    secureHandle('budgetIncome:getOverride', () => {
      const value = this.db.getSetting('budgetMonthlyIncomeOverride', '');
      if (!value) return null;
      const parsed = parseInt(value, 10);
      return isNaN(parsed) ? null : parsed;
    });

    secureHandle('budgetIncome:setOverride', (_event, amountCents: number | null) => {
      if (amountCents === null) {
        this.db.setSetting('budgetMonthlyIncomeOverride', '');
      } else {
        this.db.setSetting('budgetMonthlyIncomeOverride', String(amountCents));
      }
    });

    // ==================== Transaction Reimbursements ====================

    secureHandle('reimbursements:getForExpense', (_event, expenseId: string) => {
      return this.db.getReimbursementsForExpense(expenseId);
    });

    secureHandle('reimbursements:getForIncome', (_event, incomeId: string) => {
      return this.db.getReimbursementsForIncome(incomeId);
    });

    secureHandle('reimbursements:getAll', () => {
      return this.db.getAllReimbursementLinks();
    });

    secureHandle('reimbursements:create', (_event, data: { expenseTransactionId: string; reimbursementTransactionId: string; amount: number }) => {
      return this.db.createReimbursementLink(data);
    });

    secureHandle('reimbursements:delete', (_event, id: string) => {
      return this.db.deleteReimbursementLink(id);
    });

    secureHandle('reimbursements:getSummary', (_event, transactionId: string) => {
      return this.db.getReimbursementSummary(transactionId);
    });

    secureHandle('reimbursements:validate', (_event, expenseId: string, amount: number, excludeLinkId?: string) => {
      return this.db.validateReimbursementAmount(expenseId, amount, excludeLinkId);
    });

    secureHandle('reimbursements:getCandidates', (_event, expenseId: string) => {
      return this.db.getCandidateReimbursementTransactions(expenseId);
    });

    // ==================== Phase 10: Database Export/Import ====================

    secureHandle('database:export', async () => {
      return await exportDatabase(this.db.rawDb);
    });

    secureHandle('database:import:select', async () => {
      try {
        const result = await selectDatabaseImportFile();
        if (result.canceled || !result.filePath) {
          return { canceled: true };
        }

        const metadata = extractDatabaseMetadata(result.filePath);
        return { canceled: false, metadata, filePath: result.filePath };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return { canceled: false, error: errorMessage };
      }
    });

    secureHandle('database:import:metadata', async () => {
      const currentDbPath = path.join(app.getPath('userData'), 'ledgr.db');
      return extractDatabaseMetadata(currentDbPath);
    });

    secureHandle('database:import:confirm', async (_event, importPath: string) => {
      const currentDbPath = path.join(app.getPath('userData'), 'ledgr.db');

      // Validate schema version match before proceeding
      try {
        const currentMetadata = extractDatabaseMetadata(currentDbPath);
        const importMetadata = extractDatabaseMetadata(importPath);

        if (currentMetadata.schemaVersion !== importMetadata.schemaVersion) {
          return {
            success: false,
            error: `Schema version mismatch: current database is v${currentMetadata.schemaVersion}, import file is v${importMetadata.schemaVersion}. Cannot import different schema versions.`,
          };
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return { success: false, error: `Validation failed: ${errorMessage}` };
      }

      return await performDatabaseImport(importPath, currentDbPath, this.db.rawDb);
    });

    // ==================== Security ====================
    secureHandle('security:getStatus', () => {
      if (!this.securityManager) {
        return { enabled: false, isLocked: false, autoLockMinutes: 0 };
      }
      return {
        enabled: this.securityManager.isEnabled(),
        isLocked: this.securityManager.getIsLocked(),
        autoLockMinutes: this.securityManager.getAutoLockMinutes(),
      };
    });

    secureHandle('security:enable', (_event, password: string, autoLockMinutes: number) => {
      if (!this.securityManager) throw new Error('Security not available');
      this.securityManager.enableProtection(password, autoLockMinutes);
      this.securityManager.setSessionKey(password);
    });

    secureHandle('security:disable', (_event, password: string) => {
      if (!this.securityManager) throw new Error('Security not available');
      this.securityManager.disableProtection(password);
    });

    secureHandle('security:changePassword', (_event, currentPassword: string, newPassword: string) => {
      if (!this.securityManager) throw new Error('Security not available');
      this.securityManager.changePassword(currentPassword, newPassword);
      this.securityManager.setSessionKey(newPassword);
    });

    secureHandle('security:updateAutoLock', (_event, minutes: number) => {
      if (!this.securityManager) throw new Error('Security not available');
      this.securityManager.updateAutoLockMinutes(minutes);
    });

    secureHandle('security:lock', () => {
      if (!this.securityManager) throw new Error('Security not available');
      this.securityManager.setIsLocked(true);
      for (const win of BrowserWindow.getAllWindows()) {
        win.webContents.send('app:lock');
      }
    });

    secureHandle('security:unlock', (_event, password: string) => {
      if (!this.securityManager) throw new Error('Security not available');
      if (!this.securityManager.verifyPassword(password)) {
        return false;
      }
      this.securityManager.setIsLocked(false);
      for (const win of BrowserWindow.getAllWindows()) {
        win.webContents.send('app:unlock');
      }
      return true;
    });

    secureHandle('security:heartbeat', () => {
      // Handled in main.ts auto-lock timer reset
    });

    // ==================== Onboarding ====================
    secureHandle('onboarding:getStatus', () => {
      return this.db.getSetting('onboarding_completed', 'false');
    });

    secureHandle('onboarding:setComplete', (_event, value: string) => {
      this.db.setSetting('onboarding_completed', value);
    });

    secureHandle('app:restart', async () => {
      app.relaunch();
      app.quit();
    });

    // ==================== Shell ====================
    secureHandle('shell:openExternal', (_event, url: string) => {
      const allowedPrefixes = [
        'https://github.com/jchilcher/ledgr',
        'https://buymeacoffee.com/',
      ];
      if (!allowedPrefixes.some(p => url.startsWith(p))) {
        throw new Error('URL not allowed');
      }
      shell.openExternal(url);
    });
  }

  /**
   * Resolve period dates from options.
   */
  private resolvePeriodDates(options: PerformanceOptions): { startDate: Date; endDate: Date } {
    const endDate = options.customEndDate ? new Date(options.customEndDate) : new Date();
    let startDate: Date;

    switch (options.period) {
      case '1D':
        startDate = new Date(endDate);
        startDate.setDate(startDate.getDate() - 1);
        break;
      case '1W':
        startDate = new Date(endDate);
        startDate.setDate(startDate.getDate() - 7);
        break;
      case '1M':
        startDate = new Date(endDate);
        startDate.setMonth(startDate.getMonth() - 1);
        break;
      case '3M':
        startDate = new Date(endDate);
        startDate.setMonth(startDate.getMonth() - 3);
        break;
      case 'YTD':
        startDate = new Date(endDate.getFullYear(), 0, 1);
        break;
      case '1Y':
        startDate = new Date(endDate);
        startDate.setFullYear(startDate.getFullYear() - 1);
        break;
      case 'ALL':
        startDate = new Date(0);
        break;
      case 'CUSTOM':
        startDate = options.customStartDate ? new Date(options.customStartDate) : new Date(0);
        break;
      default:
        startDate = new Date(endDate.getFullYear(), 0, 1);
    }

    return { startDate, endDate };
  }

  removeHandlers(): void {
    // Remove all registered handlers
    ipcMain.removeHandler('accounts:getAll');
    ipcMain.removeHandler('accounts:getById');
    ipcMain.removeHandler('accounts:create');
    ipcMain.removeHandler('accounts:update');
    ipcMain.removeHandler('accounts:delete');
    ipcMain.removeHandler('accounts:getDefault');
    ipcMain.removeHandler('accounts:setDefault');

    ipcMain.removeHandler('transactions:getAll');
    ipcMain.removeHandler('transactions:getByAccount');
    ipcMain.removeHandler('transactions:create');
    ipcMain.removeHandler('transactions:update');
    ipcMain.removeHandler('transactions:delete');
    ipcMain.removeHandler('transactions:search');

    ipcMain.removeHandler('categories:getAll');
    ipcMain.removeHandler('categories:getById');
    ipcMain.removeHandler('categories:create');
    ipcMain.removeHandler('categories:update');
    ipcMain.removeHandler('categories:delete');
    ipcMain.removeHandler('categories:addMissingDefaults');

    ipcMain.removeHandler('categoryRules:getAll');
    ipcMain.removeHandler('categoryRules:getById');
    ipcMain.removeHandler('categoryRules:create');
    ipcMain.removeHandler('categoryRules:update');
    ipcMain.removeHandler('categoryRules:delete');
    ipcMain.removeHandler('categoryRules:applyToTransactions');
    ipcMain.removeHandler('categoryRules:suggestCategory');

    ipcMain.removeHandler('import:selectFile');
    ipcMain.removeHandler('import:file');
    ipcMain.removeHandler('import:csv');

    ipcMain.removeHandler('analytics:getSpendingByCategory');
    ipcMain.removeHandler('analytics:getIncomeVsExpensesOverTime');
    ipcMain.removeHandler('analytics:getCategoryTrendsOverTime');

    ipcMain.removeHandler('forecast:spending');
    ipcMain.removeHandler('forecast:multiPeriod');

    ipcMain.removeHandler('recurringTransactions:getAll');
    ipcMain.removeHandler('recurringTransactions:getByAccount');
    ipcMain.removeHandler('recurringTransactions:getById');
    ipcMain.removeHandler('recurringTransactions:create');
    ipcMain.removeHandler('recurringTransactions:update');
    ipcMain.removeHandler('recurringTransactions:delete');

    ipcMain.removeHandler('cashflow:forecast');
    ipcMain.removeHandler('cashflow:projectTransactions');

    ipcMain.removeHandler('forecast:categorySpending');
    ipcMain.removeHandler('forecast:allCategories');

    ipcMain.removeHandler('ofx:getBanks');
    ipcMain.removeHandler('ofx:searchBanks');
    ipcMain.removeHandler('ofx:testConnection');
    ipcMain.removeHandler('ofx:saveConnection');
    ipcMain.removeHandler('ofx:syncTransactions');
    ipcMain.removeHandler('ofx:disconnectAccount');

    // Phase 1: Data Export
    ipcMain.removeHandler('export:transactions');
    ipcMain.removeHandler('export:allData');

    // Phase 1: Tags
    ipcMain.removeHandler('tags:getAll');
    ipcMain.removeHandler('tags:getById');
    ipcMain.removeHandler('tags:create');
    ipcMain.removeHandler('tags:update');
    ipcMain.removeHandler('tags:delete');
    ipcMain.removeHandler('tags:getForTransaction');
    ipcMain.removeHandler('tags:addToTransaction');
    ipcMain.removeHandler('tags:removeFromTransaction');
    ipcMain.removeHandler('tags:setForTransaction');
    ipcMain.removeHandler('tags:getTransactions');

    // Phase 1: Split Transactions
    ipcMain.removeHandler('splits:getAll');
    ipcMain.removeHandler('splits:getById');
    ipcMain.removeHandler('splits:create');
    ipcMain.removeHandler('splits:update');
    ipcMain.removeHandler('splits:delete');
    ipcMain.removeHandler('splits:deleteAll');
    ipcMain.removeHandler('splits:getTransactionIds');
    ipcMain.removeHandler('splits:getByTransactionIds');

    // Phase 2: Budget Goals
    ipcMain.removeHandler('budgetGoals:getAll');
    ipcMain.removeHandler('budgetGoals:getById');
    ipcMain.removeHandler('budgetGoals:getByCategory');
    ipcMain.removeHandler('budgetGoals:create');
    ipcMain.removeHandler('budgetGoals:update');
    ipcMain.removeHandler('budgetGoals:delete');

    // Budget Suggestions
    ipcMain.removeHandler('budgetSuggestions:getAll');
    ipcMain.removeHandler('budgetSuggestions:forCategory');
    ipcMain.removeHandler('budgetSuggestions:apply');

    // Phase 2: Spending Alerts
    ipcMain.removeHandler('spendingAlerts:getAll');
    ipcMain.removeHandler('spendingAlerts:getById');
    ipcMain.removeHandler('spendingAlerts:getActive');
    ipcMain.removeHandler('spendingAlerts:create');
    ipcMain.removeHandler('spendingAlerts:update');
    ipcMain.removeHandler('spendingAlerts:delete');

    // Phase 3: Bills
    ipcMain.removeHandler('bills:getAll');
    ipcMain.removeHandler('bills:getActive');
    ipcMain.removeHandler('bills:getById');
    ipcMain.removeHandler('bills:create');
    ipcMain.removeHandler('bills:update');
    ipcMain.removeHandler('bills:delete');
    ipcMain.removeHandler('billPayments:getAll');
    ipcMain.removeHandler('billPayments:getById');
    ipcMain.removeHandler('billPayments:getUpcoming');
    ipcMain.removeHandler('billPayments:create');
    ipcMain.removeHandler('billPayments:update');
    ipcMain.removeHandler('billPayments:delete');

    // Phase 3: Category Corrections
    ipcMain.removeHandler('categoryCorrections:getAll');
    ipcMain.removeHandler('categoryCorrections:getById');
    ipcMain.removeHandler('categoryCorrections:find');
    ipcMain.removeHandler('categoryCorrections:create');
    ipcMain.removeHandler('categoryCorrections:update');
    ipcMain.removeHandler('categoryCorrections:delete');
    ipcMain.removeHandler('categoryCorrections:incrementUsage');

    // Phase 4: Assets
    ipcMain.removeHandler('assets:getAll');
    ipcMain.removeHandler('assets:getById');
    ipcMain.removeHandler('assets:create');
    ipcMain.removeHandler('assets:update');
    ipcMain.removeHandler('assets:delete');
    ipcMain.removeHandler('assets:getTotal');

    // Phase 4: Liabilities
    ipcMain.removeHandler('liabilities:getAll');
    ipcMain.removeHandler('liabilities:getById');
    ipcMain.removeHandler('liabilities:create');
    ipcMain.removeHandler('liabilities:update');
    ipcMain.removeHandler('liabilities:delete');
    ipcMain.removeHandler('liabilities:getTotal');

    // Phase 4: Net Worth (Legacy)
    ipcMain.removeHandler('netWorth:createHistory');
    ipcMain.removeHandler('netWorth:getHistory');
    ipcMain.removeHandler('netWorth:getById');

    // Phase 5: Net Worth Integration (v1.1)
    ipcMain.removeHandler('manualAssets:getAll');
    ipcMain.removeHandler('manualAssets:getById');
    ipcMain.removeHandler('manualAssets:create');
    ipcMain.removeHandler('manualAssets:update');
    ipcMain.removeHandler('manualAssets:delete');
    ipcMain.removeHandler('manualAssets:getDueReminders');
    ipcMain.removeHandler('manualLiabilities:getAll');
    ipcMain.removeHandler('manualLiabilities:getById');
    ipcMain.removeHandler('manualLiabilities:create');
    ipcMain.removeHandler('manualLiabilities:update');
    ipcMain.removeHandler('manualLiabilities:delete');
    ipcMain.removeHandler('netWorth:getSnapshots');
    ipcMain.removeHandler('netWorth:getSnapshotsByRange');
    ipcMain.removeHandler('netWorth:getLatest');
    ipcMain.removeHandler('netWorth:calculate');
    ipcMain.removeHandler('netWorth:forceSnapshot');
    ipcMain.removeHandler('netWorth:getChangeSummary');
    ipcMain.removeHandler('netWorth:getProjections');
    ipcMain.removeHandler('netWorth:calculateLoanPayoff');
    ipcMain.removeHandler('netWorth:calculateExtraPaymentImpact');
    ipcMain.removeHandler('assetHistory:getByAsset');
    ipcMain.removeHandler('assetHistory:create');
    ipcMain.removeHandler('liabilityHistory:getByLiability');
    ipcMain.removeHandler('liabilityHistory:create');

    // Phase 4: Savings Goals
    ipcMain.removeHandler('savingsGoals:getAll');
    ipcMain.removeHandler('savingsGoals:getActive');
    ipcMain.removeHandler('savingsGoals:getById');
    ipcMain.removeHandler('savingsGoals:create');
    ipcMain.removeHandler('savingsGoals:update');
    ipcMain.removeHandler('savingsGoals:delete');
    ipcMain.removeHandler('savingsContributions:getAll');
    ipcMain.removeHandler('savingsContributions:getById');
    ipcMain.removeHandler('savingsContributions:create');
    ipcMain.removeHandler('savingsContributions:delete');
    ipcMain.removeHandler('savingsGoals:pinAccount');
    ipcMain.removeHandler('savingsGoals:unpinAccount');
    ipcMain.removeHandler('savingsGoals:syncWithAccount');
    ipcMain.removeHandler('savingsGoals:getGrowthData');
    ipcMain.removeHandler('savingsGoals:getMonthlyContributions');
    ipcMain.removeHandler('savingsGoals:getAlerts');

    // Phase 5: Investments
    ipcMain.removeHandler('investments:getAll');
    ipcMain.removeHandler('investments:getById');
    ipcMain.removeHandler('investments:create');
    ipcMain.removeHandler('investments:update');
    ipcMain.removeHandler('investments:delete');
    ipcMain.removeHandler('investments:getTotal');
    ipcMain.removeHandler('investmentHistory:getAll');
    ipcMain.removeHandler('investmentHistory:create');

    // Phase 6: Receipts
    ipcMain.removeHandler('receipts:getAll');
    ipcMain.removeHandler('receipts:getById');
    ipcMain.removeHandler('receipts:getByTransaction');
    ipcMain.removeHandler('receipts:create');
    ipcMain.removeHandler('receipts:update');
    ipcMain.removeHandler('receipts:delete');

    // Unified Recurring Items
    ipcMain.removeHandler('recurring:getAll');
    ipcMain.removeHandler('recurring:getActive');
    ipcMain.removeHandler('recurring:getById');
    ipcMain.removeHandler('recurring:getByAccount');
    ipcMain.removeHandler('recurring:create');
    ipcMain.removeHandler('recurring:update');
    ipcMain.removeHandler('recurring:delete');
    ipcMain.removeHandler('recurring:migrate');
    ipcMain.removeHandler('recurringPayments:getAll');
    ipcMain.removeHandler('recurringPayments:getById');
    ipcMain.removeHandler('recurringPayments:getUpcoming');
    ipcMain.removeHandler('recurringPayments:create');
    ipcMain.removeHandler('recurringPayments:update');
    ipcMain.removeHandler('recurringPayments:delete');

    // Recurring Detection
    ipcMain.removeHandler('recurringDetection:analyze');
    ipcMain.removeHandler('recurringDetection:approve');
    ipcMain.removeHandler('recurringDetection:approveAsBill');
    ipcMain.removeHandler('recurringDetection:approveAsRecurring');

    // Phase 7: Prediction & Reporting
    ipcMain.removeHandler('anomalyDetection:detect');
    ipcMain.removeHandler('anomalyDetection:detectUnusualAmounts');
    ipcMain.removeHandler('anomalyDetection:detectMissingRecurring');
    ipcMain.removeHandler('anomalyDetection:detectDuplicateCharges');
    ipcMain.removeHandler('seasonalAnalysis:analyze');
    ipcMain.removeHandler('seasonalAnalysis:getPatterns');
    ipcMain.removeHandler('seasonalAnalysis:predictMonthlySpending');
    ipcMain.removeHandler('seasonalAnalysis:detectHolidaySpikes');
    ipcMain.removeHandler('incomeAnalysis:analyze');
    ipcMain.removeHandler('incomeAnalysis:identifyStreams');
    ipcMain.removeHandler('incomeAnalysis:getSmoothedIncome');
    ipcMain.removeHandler('financialHealth:getHistory');
    ipcMain.removeHandler('financialHealth:getLatest');
    ipcMain.removeHandler('financialHealth:createSnapshot');
    ipcMain.removeHandler('billPreferences:getAll');
    ipcMain.removeHandler('billPreferences:getByRecurringItem');
    ipcMain.removeHandler('billPreferences:upsert');
    ipcMain.removeHandler('billPreferences:delete');
    ipcMain.removeHandler('spendingVelocity:calculate');
    ipcMain.removeHandler('spendingVelocity:forCategory');
    ipcMain.removeHandler('comparison:generate');
    ipcMain.removeHandler('comparison:budgetAdherenceHistory');
    ipcMain.removeHandler('subscriptionAudit:audit');
    ipcMain.removeHandler('financialHealthCalc:calculate');

    // Phase 3: Goal & Debt Projections
    ipcMain.removeHandler('savingsProjection:generate');
    ipcMain.removeHandler('savingsProjection:forGoal');
    ipcMain.removeHandler('debtPayoff:generate');
    ipcMain.removeHandler('debtPayoff:calculateStrategy');
    ipcMain.removeHandler('netWorthProjection:generate');
    ipcMain.removeHandler('netWorthProjection:getTrend');
    ipcMain.removeHandler('netWorthProjection:getMilestones');

    // Phase 4: Cash Flow Intelligence
    ipcMain.removeHandler('categoryMigration:analyze');
    ipcMain.removeHandler('categoryMigration:getPeriods');
    ipcMain.removeHandler('cashFlowOptimization:optimize');
    ipcMain.removeHandler('cashFlowOptimization:getProjections');

    // Enhanced Forecast (5-Year Support)
    ipcMain.removeHandler('forecast:categoryLongTerm');
    ipcMain.removeHandler('forecast:allCategoriesLongTerm');
    ipcMain.removeHandler('cashflow:forecastEnhanced');
    ipcMain.removeHandler('forecast:selectGranularity');

    // Recovery Plan
    ipcMain.removeHandler('recoveryPlan:generate');
    ipcMain.removeHandler('recoveryPlan:getQuickWins');
    ipcMain.removeHandler('recoveryPlan:simulateScenario');
    ipcMain.removeHandler('recoveryPlan:getEmergencyStatus');
    ipcMain.removeHandler('recoveryPlan:getSurvivalMode');
    ipcMain.removeHandler('recoveryPlan:applyQuickWin');

    // Performance Analytics (Phase 4 - v1.1)
    ipcMain.removeHandler('performance:getMetrics');
    ipcMain.removeHandler('performance:getPositionGainLoss');
    ipcMain.removeHandler('performance:getRealizedGains');
    ipcMain.removeHandler('performance:getBenchmark');
    ipcMain.removeHandler('performance:getDefaultPeriod');
    ipcMain.removeHandler('performance:setDefaultPeriod');

    // Transaction Reimbursements
    ipcMain.removeHandler('reimbursements:getForExpense');
    ipcMain.removeHandler('reimbursements:getForIncome');
    ipcMain.removeHandler('reimbursements:getAll');
    ipcMain.removeHandler('reimbursements:create');
    ipcMain.removeHandler('reimbursements:delete');
    ipcMain.removeHandler('reimbursements:getSummary');
    ipcMain.removeHandler('reimbursements:validate');
    ipcMain.removeHandler('reimbursements:getCandidates');

    // Budget Income Override
    ipcMain.removeHandler('budgetIncome:getOverride');
    ipcMain.removeHandler('budgetIncome:setOverride');

    // Security
    ipcMain.removeHandler('security:getStatus');
    ipcMain.removeHandler('security:enable');
    ipcMain.removeHandler('security:disable');
    ipcMain.removeHandler('security:changePassword');
    ipcMain.removeHandler('security:updateAutoLock');
    ipcMain.removeHandler('security:lock');
    ipcMain.removeHandler('security:unlock');
    ipcMain.removeHandler('security:heartbeat');

    // Onboarding
    ipcMain.removeHandler('onboarding:getStatus');
    ipcMain.removeHandler('onboarding:setComplete');

    // Shell
    ipcMain.removeHandler('shell:openExternal');
  }
}
