// Core data types for the Ledgr application

export type AccountType = 'checking' | 'savings' | 'credit';
export type TransactionType = 'income' | 'expense';
export type ImportSource = 'file' | 'ofx';
export type OwnershipType = 'mine' | 'partner' | 'shared';
export type HouseholdFilter = 'all' | string; // 'all' or a userId

export interface User {
  id: string;
  name: string;
  color: string;
  isDefault: boolean;
  createdAt: Date;
}
export type RecurringFrequency = 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly';
export type RecurringItemType = 'bill' | 'subscription' | 'cashflow';
export type PaymentStatus = 'pending' | 'paid' | 'overdue' | 'skipped';

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  institution: string;
  balance: number;
  lastSynced?: Date | null;
  createdAt: Date;
  // OFX Direct Connect fields
  ofxUrl?: string | null;
  ofxOrg?: string | null;
  ofxFid?: string | null;
  ofxUsername?: string | null;
  ofxAccountId?: string | null;
  // Household ownership
  ownership?: OwnershipType;
  ownerId?: string | null;
  isEncrypted?: boolean;
}

export interface Transaction {
  id: string;
  accountId: string;
  date: Date;
  description: string;
  amount: number;
  categoryId?: string | null;
  isRecurring: boolean;
  importSource: ImportSource;
  createdAt: Date;
  fitId?: string | null; // Financial Institution Transaction ID for dedup
  isInternalTransfer?: boolean; // Internal transfers are excluded from analytics
  notes?: string | null; // User notes for the transaction
  isHidden?: boolean; // Hidden transactions are excluded from reports/analytics
}

export interface Category {
  id: string;
  name: string;
  type: TransactionType;
  icon?: string;
  color?: string;
  isDefault: boolean;
  parentId?: string | null;
}

export interface CategoryRule {
  id: string;
  pattern: string;
  categoryId: string;
  priority: number;
  createdAt: Date;
}

export interface RecurringTransaction {
  id: string;
  accountId: string;
  description: string;
  amount: number;
  categoryId?: string | null;
  frequency: RecurringFrequency;
  startDate: Date;
  endDate?: Date | null;
  nextOccurrence: Date;
}

// Unified recurring item (merges Bill and RecurringTransaction)
export interface RecurringItem {
  id: string;
  description: string;
  amount: number; // Negative for expenses
  frequency: RecurringFrequency;
  startDate: Date;
  nextOccurrence: Date;
  accountId?: string | null;
  endDate?: Date | null;
  categoryId?: string | null;
  dayOfMonth?: number | null; // For monthly scheduling (1-31)
  dayOfWeek?: number | null; // For weekly scheduling (0-6)
  itemType: RecurringItemType; // 'bill' | 'subscription' | 'cashflow'
  enableReminders: boolean; // true = bill/subscription mode with payment tracking
  reminderDays?: number | null; // Days before due to remind
  autopay: boolean;
  isActive: boolean;
  ownerId?: string | null;
  isEncrypted?: boolean;
  createdAt: Date;
}

export interface RecurringPayment {
  id: string;
  recurringItemId: string;
  dueDate: Date;
  paidDate?: Date | null;
  amount: number;
  status: PaymentStatus;
  transactionId?: string | null;
  createdAt: Date;
}

export interface RecurringPaymentWithItem extends RecurringPayment {
  description: string;
  itemType: RecurringItemType;
  itemAmount: number;
}

// Phase 1: Tags
export interface Tag {
  id: string;
  name: string;
  color?: string | null;
  createdAt: Date;
}

export interface TransactionTag {
  transactionId: string;
  tagId: string;
}

// Phase 1: Split Transactions
export interface TransactionSplit {
  id: string;
  parentTransactionId: string;
  categoryId?: string | null;
  amount: number;
  description?: string | null;
  createdAt: Date;
}

// Phase 2: Budget Goals
export type BudgetPeriod = 'weekly' | 'monthly' | 'yearly';

export interface BudgetGoal {
  id: string;
  categoryId: string;
  amount: number;
  period: BudgetPeriod;
  rolloverEnabled: boolean;
  rolloverAmount: number;
  startDate: Date;
  createdAt: Date;
}

// Phase 2: Spending Alerts
export interface SpendingAlert {
  id: string;
  categoryId: string;
  threshold: number;
  period: BudgetPeriod;
  isActive: boolean;
  lastTriggered?: Date | null;
  createdAt: Date;
}

// Phase 3: Bills
export type BillFrequency = 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly';
export type BillPaymentStatus = 'pending' | 'paid' | 'overdue' | 'skipped';

export interface Bill {
  id: string;
  name: string;
  amount: number;
  dueDay: number; // Day of month (1-31)
  frequency: BillFrequency;
  categoryId?: string | null;
  autopay: boolean;
  reminderDays: number;
  isActive: boolean;
  createdAt: Date;
}

export interface BillPayment {
  id: string;
  billId: string;
  dueDate: Date;
  paidDate?: Date | null;
  amount: number;
  status: BillPaymentStatus;
  transactionId?: string | null;
  createdAt: Date;
}

// Phase 3: Smart Categorization
export interface CategoryCorrection {
  id: string;
  originalDescription: string;
  correctedCategoryId: string;
  pattern?: string | null;
  confidence: number;
  usageCount: number;
  createdAt: Date;
}

// Phase 4: Net Worth (Legacy types - kept for migration)
export type LegacyAssetType = 'cash' | 'investment' | 'property' | 'vehicle' | 'other';
export type LegacyLiabilityType = 'mortgage' | 'auto_loan' | 'student_loan' | 'credit_card' | 'personal_loan' | 'other';

// Type aliases for backward compatibility
export type AssetType = LegacyAssetType;
export type LiabilityType = LegacyLiabilityType;

export interface Asset {
  id: string;
  name: string;
  type: LegacyAssetType;
  value: number;
  lastUpdated: Date;
  notes?: string | null;
  createdAt: Date;
}

export interface Liability {
  id: string;
  name: string;
  type: LegacyLiabilityType;
  balance: number;
  interestRate?: number | null;
  minimumPayment?: number | null;
  lastUpdated: Date;
  createdAt: Date;
}

export interface NetWorthHistory {
  id: string;
  date: Date;
  totalAssets: number;
  totalLiabilities: number;
  netWorth: number;
  breakdown?: string | null; // JSON breakdown by type
  createdAt: Date;
}

// ==================== Phase 5: Net Worth Integration ====================

// Manual Asset Categories (preset + custom)
export type ManualAssetCategory = 'property' | 'vehicle' | 'valuables' | 'other' | 'custom';
export type AssetLiquidity = 'liquid' | 'illiquid';

export interface ManualAsset {
  id: string;
  name: string;
  category: ManualAssetCategory;
  customCategory?: string | null;  // When category is 'custom'
  value: number;                   // Value in cents
  liquidity: AssetLiquidity;
  notes?: string | null;
  // Reminder configuration
  reminderFrequency?: 'monthly' | 'quarterly' | 'yearly' | null;
  lastReminderDate?: Date | null;
  nextReminderDate?: Date | null;
  // Ownership
  ownerId?: string | null;
  isEncrypted?: boolean;
  // Tracking
  lastUpdated: Date;
  createdAt: Date;
}

// Liability with full amortization details for payoff projections
export type ManualLiabilityType = 'mortgage' | 'auto_loan' | 'student_loan' | 'personal_loan' | 'credit_card' | 'other';

export interface ManualLiability {
  id: string;
  name: string;
  type: ManualLiabilityType;
  balance: number;                 // Current balance in cents
  // Amortization details
  interestRate: number;            // Annual rate as decimal (e.g., 0.065 for 6.5%)
  monthlyPayment: number;          // Monthly payment in cents
  originalAmount?: number | null;  // Original loan amount in cents
  startDate?: Date | null;         // Loan start date
  termMonths?: number | null;      // Original term in months
  // Computed fields (stored for efficiency)
  payoffDate?: Date | null;        // Projected payoff date
  totalInterest?: number | null;   // Total interest over remaining life
  // Ownership
  ownerId?: string | null;
  isEncrypted?: boolean;
  // Tracking
  lastUpdated: Date;
  notes?: string | null;
  createdAt: Date;
}

// Net worth snapshot for historical tracking
export interface NetWorthSnapshot {
  id: string;
  date: Date;
  // Component values (all in cents)
  bankAccountsTotal: number;
  investmentAccountsTotal: number;
  manualAssetsTotal: number;
  totalAssets: number;
  manualLiabilitiesTotal: number;
  totalLiabilities: number;
  netWorth: number;
  // Breakdown by category (JSON serialized)
  assetBreakdown: string;          // { bankAccounts: [...], investments: [...], manualAssets: [...] }
  liabilityBreakdown: string;      // { liabilities: [...] }
  // Change tracking
  changeFromPrevious?: number | null;  // Change in cents from previous snapshot
  changePercentFromPrevious?: number | null;
  createdAt: Date;
}

// Asset value history for tracking manual asset changes over time
export interface AssetValueHistory {
  id: string;
  assetId: string;
  value: number;                   // Value in cents
  date: Date;
  source: 'manual' | 'reminder';   // How was this update created
  createdAt: Date;
}

// Liability value history for tracking payments over time
export interface LiabilityValueHistory {
  id: string;
  liabilityId: string;
  balance: number;                 // Balance in cents
  date: Date;
  paymentAmount?: number | null;   // Payment made in cents
  createdAt: Date;
}

// Phase 4: Savings Goals
export interface SavingsGoal {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  targetDate?: Date | null;
  accountId?: string | null;
  icon?: string | null;
  color?: string | null;
  isActive: boolean;
  ownerId?: string | null;
  isEncrypted?: boolean;
  createdAt: Date;
}

export interface SavingsContribution {
  id: string;
  goalId: string;
  amount: number;
  transactionId?: string | null;
  date: Date;
  createdAt: Date;
}

// Savings Goal Alerts & Reporting
export interface SavingsGoalAlert {
  goalId: string;
  goalName: string;
  type: 'milestone' | 'deadline_warning' | 'completed' | 'at_risk';
  message: string;
  color: string | null;
  progress: number;
  severity: 'info' | 'warning' | 'success';
}

export interface SavingsGrowthPoint {
  date: string;
  cumulativeAmount: number;
}

export interface SavingsMonthlyContribution {
  month: string;
  total: number;
  count: number;
}

// Phase 5: Investments
export type InvestmentType = 'stock' | 'etf' | 'mutual_fund' | 'bond' | 'crypto' | 'other';

export interface Investment {
  id: string;
  accountId?: string | null;
  name: string;
  ticker?: string | null;
  type: InvestmentType;
  shares: number;
  costBasis: number;
  currentPrice: number;
  lastUpdated: Date;
  createdAt: Date;
}

export interface InvestmentHistory {
  id: string;
  investmentId: string;
  date: Date;
  price: number;
  shares: number;
  value: number;
}

// Investment Account Types (Phase 1 v1.1)
export type InvestmentAccountType = 'taxable' | 'traditional_ira' | 'roth_ira' | '401k' | 'hsa';

export interface InvestmentAccount {
  id: string;
  name: string;
  institution: string;
  accountType: InvestmentAccountType;
  ownerId?: string | null;
  isEncrypted?: boolean;
  createdAt: Date;
}

export interface Holding {
  id: string;
  accountId: string;
  ticker: string;
  name: string;
  sharesOwned: number;      // Total shares (sum of lots)
  avgCostPerShare: number;  // Weighted average cost basis (cents)
  currentPrice: number;     // Manual price until Phase 2 (cents)
  sector?: string | null;
  lastPriceUpdate: Date;
  createdAt: Date;
}

export interface CostBasisLot {
  id: string;
  holdingId: string;
  purchaseDate: Date;
  shares: number;           // Original shares purchased (x10000 for precision)
  costPerShare: number;     // Cost per share at purchase (cents)
  remainingShares: number;  // Shares not yet sold (x10000 for precision)
  createdAt: Date;
}

// Phase 6: Receipts
export interface Receipt {
  id: string;
  transactionId?: string | null;
  filePath: string;
  thumbnailPath?: string | null;
  extractedData?: string | null; // JSON from OCR
  uploadedAt: Date;
  processedAt?: Date | null;
}

// Budget vs Actual Report Types
export type BudgetVsActualStatus = 'under' | 'on_track' | 'over' | 'no_budget';

export interface BudgetVsActualRow {
  categoryId: string;
  categoryName: string;
  categoryColor: string;
  budgetAmount: number | null;
  actualSpent: number;
  varianceAmount: number | null;
  variancePercent: number | null;
  status: BudgetVsActualStatus;
  transactionCount: number;
}

export interface BudgetVsActualTotals {
  totalBudget: number;
  totalActual: number;
  totalVariance: number;
  categoriesOverBudget: number;
  categoriesUnderBudget: number;
  categoriesOnTrack: number;
}

export interface BudgetVsActualReport {
  rows: BudgetVsActualRow[];
  totals: BudgetVsActualTotals;
  dateRange: {
    startDate: string;
    endDate: string;
    daysInRange: number;
  };
}

// Recurring Payment Detection Types
export type DetectedFrequency = 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly';

export interface ConfidenceFactors {
  intervalConsistency: number;  // 0-100, how regular the intervals are
  intervalAccuracy: number;     // 0-100, how well it matches expected frequency
  occurrenceBoost: number;      // 0-10, bonus from having many transactions
  amountVariance: number;       // 0-100, how consistent amounts are (100 = very consistent)
  // Recency tracking for cancelled subscription detection
  missedPayments: number;        // Count of expected but missing payments
  recencyPenalty: number;        // 0-50, penalty applied for missed payments
  daysSinceLastPayment: number;  // Days since last occurrence
}

export interface RecurringSuggestion {
  id: string;
  description: string;
  normalizedDescription: string;
  amount: number;
  averageAmount: number;
  frequency: DetectedFrequency;
  confidence: number; // 0-100
  confidenceFactors?: ConfidenceFactors;
  occurrences: number;
  lastOccurrence: Date;
  nextExpected: Date;
  dayOfMonth?: number; // For monthly bills
  dayOfWeek?: number; // For weekly (0-6)
  categoryId?: string | null;
  accountId: string;
  transactionIds: string[]; // Related transactions
  suggestReminders: boolean; // true = suggest enabling reminders (was bill mode)
  type: 'income' | 'expense'; // Whether this is recurring income or expense
  status: 'pending' | 'approved' | 'dismissed';
}

// ==================== Phase 7: Prediction & Reporting ====================

// Anomaly Detection Types
export type AnomalyType = 'unusual_amount' | 'missing_recurring' | 'duplicate_charge';
export type AnomalySeverity = 'low' | 'medium' | 'high';

export interface Anomaly {
  id: string;
  type: AnomalyType;
  severity: AnomalySeverity;
  transactionId?: string | null;
  recurringItemId?: string | null;
  description: string;
  amount?: number | null;
  expectedAmount?: number | null;
  zScore?: number | null;
  relatedTransactionIds?: string[];
  detectedAt: Date;
  acknowledged: boolean;
  dismissedAt?: Date | null;
}

export interface AnomalyDetectionResult {
  anomalies: Anomaly[];
  summary: {
    totalAnomalies: number;
    byType: Record<AnomalyType, number>;
    bySeverity: Record<AnomalySeverity, number>;
  };
}

// Seasonal Analysis Types
export interface SeasonalPattern {
  id: string;
  categoryId: string;
  year: number;
  month: number; // 1-12
  averageSpending: number;
  transactionCount: number;
  seasonalIndex: number; // ratio to overall average
  calculatedAt: Date;
}

export interface SeasonalAnalysisResult {
  patterns: SeasonalPattern[];
  categoryAverages: Record<string, number>;
  seasonalIndices: Record<string, Record<number, number>>; // categoryId -> month -> index
  holidaySpikes: Array<{
    categoryId: string;
    month: number;
    spike: number; // percentage above average
    description: string;
  }>;
}

// Income Analysis Types
export interface IncomeStream {
  id: string;
  description: string;
  normalizedDescription: string;
  averageAmount: number;
  frequency: 'weekly' | 'biweekly' | 'monthly' | 'irregular';
  lastReceived: Date;
  occurrences: number;
  transactionIds: string[];
  varianceCoefficient: number; // std dev / mean
  reliabilityScore: number; // 0-100
}

export interface IncomeAnalysisResult {
  streams: IncomeStream[];
  summary: {
    totalMonthlyIncome: number;
    totalAnnualIncome: number;
    primaryIncomeStream?: IncomeStream;
    incomeStabilityScore: number; // 0-100
    diversificationScore: number; // 0-100
  };
  recommendations: string[];
}

// Spending Velocity Types
export type VelocityStatus = 'safe' | 'warning' | 'danger';

export interface SpendingVelocity {
  categoryId: string;
  categoryName: string;
  budgetAmount: number;
  currentSpent: number;
  dailyBurnRate: number;
  projectedTotal: number;
  daysRemaining: number;
  depletionDate: Date | null; // null if under budget
  percentUsed: number;
  status: VelocityStatus;
  paceVsBudget: number; // < 1 = under pace, > 1 = over pace
}

export interface SpendingVelocityReport {
  period: {
    startDate: Date;
    endDate: Date;
    daysElapsed: number;
    daysRemaining: number;
  };
  velocities: SpendingVelocity[];
  summary: {
    categoriesAtRisk: number;
    totalBudget: number;
    totalProjectedSpending: number;
    overallStatus: VelocityStatus;
  };
}

// Comparison Report Types
export interface SpendingComparison {
  categoryId: string;
  categoryName: string;
  currentPeriod: number;
  previousPeriod: number;
  variance: number;
  variancePercent: number;
  trend: 'increasing' | 'decreasing' | 'stable';
}

export interface ComparisonReport {
  type: 'month_over_month' | 'year_over_year';
  currentPeriod: { start: Date; end: Date; label: string };
  previousPeriod: { start: Date; end: Date; label: string };
  comparisons: SpendingComparison[];
  totals: {
    currentTotal: number;
    previousTotal: number;
    variance: number;
    variancePercent: number;
  };
  budgetAdherenceScore: number; // 0-100
  budgetAdherenceTrend: 'improving' | 'declining' | 'stable';
}

// Subscription Audit Types
export interface Subscription {
  id: string;
  name: string;
  amount: number;
  frequency: RecurringFrequency;
  monthlyEquivalent: number;
  annualCost: number;
  lastCharged: Date;
  categoryId?: string | null;
  daysSinceLastCharge: number;
  isActive: boolean;
  isPotentiallyUnused: boolean; // no related activity
  unusedIndicators: string[];
}

export interface SubscriptionAuditReport {
  subscriptions: Subscription[];
  summary: {
    totalMonthly: number;
    totalAnnual: number;
    activeCount: number;
    potentiallyUnusedCount: number;
    potentialSavings: number;
  };
  recommendations: string[];
}

// Financial Health Score Types
export interface FinancialHealthFactor {
  name: string;
  score: number; // 0-100
  weight: number;
  description: string;
  recommendation?: string;
  metric?: { currentValue: string; targetValue: string; unit: string };
}

export interface FinancialHealthScore {
  id: string;
  date: Date;
  overallScore: number; // 0-100
  factors: FinancialHealthFactor[];
  trend: 'improving' | 'declining' | 'stable';
  previousScore?: number;
  recommendations: string[];
  createdAt: Date;
}

export interface FinancialHealthHistory {
  id: string;
  date: Date;
  overallScore: number;
  factorScores: string; // JSON serialized factors
  createdAt: Date;
}

// Savings Projection Types
export interface SavingsScenario {
  name: string;
  monthlyContribution: number;
  projectedCompletionDate: Date | null;
  monthsToGoal: number | null;
  probability: number; // 0-100 likelihood based on history
}

export interface SavingsProjection {
  goalId: string;
  goalName: string;
  targetAmount: number;
  currentAmount: number;
  remainingAmount: number;
  currentSavingsRate: number; // monthly
  scenarios: SavingsScenario[];
  projectedCompletionDate: Date | null;
  requiredMonthlyForTarget: number | null; // to hit target date
  onTrack: boolean;
}

// Debt Payoff Types
export type PayoffStrategy = 'minimum' | 'snowball' | 'avalanche';

export interface DebtPayoffScheduleEntry {
  month: number;
  date: Date;
  payment: number;
  principal: number;
  interest: number;
  remainingBalance: number;
}

export interface DebtPayoff {
  liabilityId: string;
  name: string;
  currentBalance: number;
  interestRate: number;
  minimumPayment: number;
  schedule: DebtPayoffScheduleEntry[];
  totalPayments: number;
  totalInterest: number;
  payoffDate: Date;
  monthsToPayoff: number;
}

export interface DebtPayoffPlan {
  strategy: PayoffStrategy;
  debts: DebtPayoff[];
  summary: {
    totalDebt: number;
    totalPayments: number;
    totalInterest: number;
    payoffDate: Date;
    monthsToPayoff: number;
  };
  comparisonToMinimum?: {
    interestSaved: number;
    timeSaved: number; // months
  };
}

export interface DebtPayoffComparison {
  extraPayment: number;
  strategies: DebtPayoffPlan[];
}

// Net Worth Projection Types
export interface NetWorthMilestone {
  amount: number;
  label: string;
  projectedDate: Date | null;
  achieved: boolean;
  achievedDate?: Date;
}

export interface NetWorthProjection {
  currentNetWorth: number;
  growthRate: number; // monthly rate
  projections: Array<{
    date: Date;
    projected: number;
    lowerBound: number;
    upperBound: number;
  }>;
  milestones: NetWorthMilestone[];
  confidenceLevel: number; // 0-100
}

// Category Migration Types
export interface CategoryProportion {
  categoryId: string;
  categoryName: string;
  proportion: number; // 0-1
  amount: number;
}

export interface CategoryShift {
  categoryId: string;
  categoryName: string;
  fromProportion: number;
  toProportion: number;
  change: number; // absolute change in proportion
  changePercent: number;
  significance: 'minor' | 'moderate' | 'significant';
  trend: 'increasing' | 'decreasing';
}

export interface CategoryMigrationReport {
  periods: Array<{
    start: Date;
    end: Date;
    label: string;
    proportions: CategoryProportion[];
  }>;
  shifts: CategoryShift[];
  trends: Array<{
    categoryId: string;
    categoryName: string;
    direction: 'increasing' | 'decreasing' | 'stable';
    averageChange: number;
  }>;
}

// Cash Flow Optimization Types
export interface BillPreference {
  id: string;
  recurringItemId: string;
  preferredDueDay?: number | null;
  notes?: string | null;
}

export interface CashFlowRiskWindow {
  startDate: Date;
  endDate: Date;
  lowestBalance: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  contributingBills: Array<{
    description: string;
    amount: number;
    dueDate: Date;
  }>;
}

export interface BillDistributionSuggestion {
  recurringItemId: string;
  description: string;
  currentDueDay: number;
  suggestedDueDay: number;
  reason: string;
  impact: number; // balance improvement
}

export interface CashFlowOptimizationReport {
  riskWindows: CashFlowRiskWindow[];
  suggestions: BillDistributionSuggestion[];
  currentDistribution: Record<number, number>; // day -> total bills due
  optimalDistribution: Record<number, number>;
  potentialBalanceImprovement: number;
}

// Budget Suggestion Types
export type BudgetSuggestionType = 'new_budget' | 'increase' | 'decrease';

export type BudgetSuggestionReason =
  | 'no_budget_set'
  | 'consistently_over_budget'
  | 'consistently_under_budget'
  | 'goal_based_reduction';

export interface BudgetSuggestion {
  categoryId: string;
  categoryName: string;
  type: BudgetSuggestionType;
  currentBudget: number | null;
  suggestedAmount: number;
  confidence: number; // 0-100
  reason: BudgetSuggestionReason;
  explanation: string;
  period: BudgetPeriod;
}

// Price Service Types (Phase 2 - v1.1)
export interface PriceResult {
  symbol: string;
  price: number;           // Price in cents (integer)
  change: number;          // Daily change in cents
  changePercent: number;   // Daily change percentage (e.g., 1.5 for +1.5%)
  timestamp: number;       // Unix timestamp when fetched
  currency: string;        // Currency code (USD, etc.)
}

export interface PriceCacheEntry {
  symbol: string;
  price: number;           // Price in cents
  change: number;          // Daily change in cents
  changePercent: number;   // Daily change percentage
  timestamp: number;       // When price was fetched/set
  manual: boolean;         // True if manually entered by user
  currency: string;
}

export interface PriceFetchProgress {
  completed: number;
  total: number;
  currentSymbol: string;
  errors: Array<{ symbol: string; error: string }>;
}

export type PriceFetchStatus = 'idle' | 'fetching' | 'success' | 'error' | 'offline';

// Brokerage Import Types (Phase 6 - v1.1)

export type BrokerageFormatName = 'fidelity' | 'schwab' | 'vanguard' | 'etrade' | 'generic';

export interface ParsedHolding {
  ticker: string;
  shares: number;         // Integer format (shares * 10000)
  costBasis: number;      // Total cost basis in cents
  costPerShare: number;   // Cost per share in cents
  rawRow: Record<string, string>;  // Original CSV values for reference
}

export interface ColumnMapping {
  ticker: string | null;
  shares: string | null;
  costBasis: string | null;
  costBasisType: 'total' | 'per_share';
  headerRow?: number;
}

export type ImportRowStatus = 'new' | 'duplicate' | 'error';

export interface ImportPreviewRow extends ParsedHolding {
  status: ImportRowStatus;
  errorMessage?: string;
  existingHoldingId?: string;
  selected: boolean;
}

export interface HoldingsParseResult {
  success: boolean;
  holdings: ParsedHolding[];
  detectedFormat: BrokerageFormatName | null;
  error?: string;
  warnings?: string[];
}

export interface HoldingsCSVRawData {
  rawRows: string[][];
  totalRows: number;
  detectedHeaderRow: number;
  detectedDelimiter: string;
  suggestedMapping: ColumnMapping | null;
}

export interface ImportPreviewResult {
  success: boolean;
  detectedFormat: BrokerageFormatName | null;
  formatDisplayName: string;
  rows: ImportPreviewRow[];
  availableColumns: string[];  // For manual mapping
  suggestedMapping: ColumnMapping | null;
  rawData?: HoldingsCSVRawData;    // Raw CSV rows for spreadsheet mapper
  stats: {
    total: number;
    new: number;
    duplicates: number;
    errors: number;
  };
  error?: string;
}

export interface ImportCommitResult {
  success: boolean;
  imported: number;
  skipped: number;
  errors: number;
  error?: string;
}

export type DuplicateAction = 'skip' | 'replace' | 'add';

// ==================== Transaction Import Types ====================

export type TransactionAmountType = 'single' | 'split';

export interface TransactionColumnMapping {
  date: string | null;
  description: string | null;
  amount: string | null;       // For single amount type
  debit: string | null;        // For split amount type
  credit: string | null;       // For split amount type
  category: string | null;     // Optional
  balance: string | null;      // Optional
  amountType: TransactionAmountType;
  headerRow?: number;          // 0-based index of header row (user override)
}

export interface CSVRawData {
  rawRows: string[][];
  totalRows: number;
  detectedHeaderRow: number;
  detectedDelimiter: string;
  suggestedMapping: TransactionColumnMapping | null;
}

export type TransactionImportRowStatus = 'new' | 'duplicate' | 'error';

export interface TransactionImportPreviewRow {
  date: Date;
  description: string;
  amount: number;              // In dollars (consistent with database schema)
  category?: string | null;
  balance?: number | null;     // In dollars (consistent with database schema)
  status: TransactionImportRowStatus;
  errorMessage?: string;
  existingTransactionId?: string;  // For duplicates
  selected: boolean;
  rawRow: Record<string, string>;
}

export interface TransactionImportPreviewResult {
  success: boolean;
  detectedFormat: string | null;
  formatDisplayName: string;
  rows: TransactionImportPreviewRow[];
  availableColumns: string[];        // For manual mapping
  suggestedMapping: TransactionColumnMapping | null;
  sampleData?: Record<string, string>[];  // Sample data for column mapper preview
  rawData?: CSVRawData;                   // Raw CSV rows for spreadsheet mapper
  stats: {
    total: number;
    new: number;
    duplicates: number;
    errors: number;
  };
  error?: string;
}

export interface TransactionImportCommitResult {
  success: boolean;
  imported: number;
  skipped: number;
  errors: number;
  error?: string;
}

// Investment Transaction Types (Phase 3 v1.1)
export type InvestmentTransactionType = 'buy' | 'sell' | 'dividend' | 'stock_split' | 'drip';

export interface InvestmentTransaction {
  id: string;
  holdingId: string;        // References the holding (investment) this transaction affects
  type: InvestmentTransactionType;
  date: Date;
  shares: number;           // Number of shares (x10000 for precision, negative for sells)
  pricePerShare: number;    // Price per share in cents (for buy/sell/drip)
  totalAmount: number;      // Total transaction amount in cents (price * shares + fees for buy, price * shares - fees for sell)
  fees: number;             // Transaction fees in cents
  splitRatio?: string | null;  // For stock splits: "2:1" means 2 new shares for each 1 old share
  notes?: string | null;
  lotId?: string | null;    // Reference to cost basis lot created/affected
  createdAt: Date;
}

// User setting for concentration warning threshold
export interface InvestmentSettings {
  id: string;
  concentrationThreshold: number;  // Percentage (e.g., 25 for 25%)
  defaultSectorAllocation: string; // JSON mapping of sectors
  createdAt: Date;
  updatedAt: Date;
}

// Performance Analytics Types (Phase 4 - v1.1)
// Re-exported from @ledgr/core

export interface PositionGainLoss {
  holdingId: string;
  ticker: string;
  name: string;
  shares: number;
  costBasis: number;          // Total cost in cents
  currentValue: number;       // Current value in cents
  unrealizedGain: number;     // Unrealized gain/loss in cents
  unrealizedGainPercent: number;  // Percentage gain/loss
  dayChange: number;          // Today's change in cents
  dayChangePercent: number;   // Today's change percentage
}

export interface RealizedGain {
  transactionId: string;
  holdingId: string;
  ticker: string;
  sellDate: Date;
  shares: number;
  proceeds: number;           // Sale proceeds in cents
  costBasis: number;          // Cost basis of sold shares in cents
  gain: number;               // Realized gain in cents (proceeds - cost)
  gainPercent: number;        // Percentage gain
  holdingPeriodDays: number;  // Days held (for short/long term classification)
  isLongTerm: boolean;        // true if held > 365 days
}

export interface PortfolioPerformance {
  totalValue: number;         // Current total value in cents
  totalCostBasis: number;     // Total cost basis in cents
  unrealizedGain: number;     // Total unrealized gain in cents
  unrealizedGainPercent: number;
  realizedGainYTD: number;    // Realized gains this year in cents
  realizedGainTotal: number;  // All-time realized gains in cents
  dayChange: number;          // Today's change in cents
  dayChangePercent: number;
}

export interface ReturnMetrics {
  twr: number;                // Time-weighted return as decimal (0.05 = 5%)
  mwr: number;                // Money-weighted return as decimal
  periodDays: number;         // Number of days in calculation period
  startDate: Date;
  endDate: Date;
  startValue: number;         // Portfolio value at start (cents)
  endValue: number;           // Portfolio value at end (cents)
  netCashFlow: number;        // Net contributions/withdrawals (cents)
}

export interface PerformanceMetrics {
  portfolio: PortfolioPerformance;
  positions: PositionGainLoss[];
  realizedGains: RealizedGain[];
  returns: ReturnMetrics;
  benchmarkReturn?: number;   // S&P 500 return for comparison (decimal)
  vsBenchmark?: number;       // Difference from benchmark (decimal)
  calculatedAt: Date;
}

export type PerformancePeriod = '1D' | '1W' | '1M' | '3M' | 'YTD' | '1Y' | 'ALL' | 'CUSTOM';

export interface PerformanceOptions {
  period: PerformancePeriod;
  customStartDate?: Date;     // Only used when period is 'CUSTOM'
  customEndDate?: Date;       // Only used when period is 'CUSTOM'
  includeBenchmark?: boolean; // Whether to fetch and compare to S&P 500
}

// Cash flow for TWR/MWR calculations
export interface CashFlowEvent {
  date: Date;
  amount: number;             // Positive = contribution, negative = withdrawal (cents)
  type: 'contribution' | 'withdrawal' | 'dividend';
}

// ==================== Phase 10: Database Export/Import ====================

// Transaction Reimbursement Types
export interface TransactionReimbursement {
  id: string;
  expenseTransactionId: string;
  reimbursementTransactionId: string;
  amount: number; // cents
  createdAt: Date;
}

export type ReimbursementStatus = 'none' | 'partial' | 'full';

export interface ReimbursementSummary {
  status: ReimbursementStatus;
  originalAmount: number;   // cents, absolute value
  totalReimbursed: number;  // cents
  netAmount: number;        // cents, absolute value
  links: TransactionReimbursement[];
}

// Flex Budget Mode
export type BudgetMode = 'category' | 'flex';

export interface FlexBudgetConfig {
  mode: BudgetMode;
  flexTarget: number; // monthly target in cents
  fixedCategoryIds: string[]; // categories tagged as fixed expenses
}

// Security
export interface UserAuthStatus {
  userId: string;
  name: string;
  color: string;
  hasPassword: boolean;
}

// Saved Reports
export interface SavedReport {
  id: string;
  name: string;
  config: string; // JSON serialized report configuration
  createdAt: Date;
  lastAccessedAt: Date;
}

// Phase 8: Transaction Attachments
export interface TransactionAttachment {
  id: string;
  transactionId: string;
  filename: string;
  filePath: string;
  mimeType: string;
  fileSize: number;
  createdAt: Date;
}

// Database metadata for export/import comparison
export interface DatabaseMetadata {
  schemaVersion: number;
  accountCount: number;
  transactionCount: number;
  dateRange: { earliest: string; latest: string } | null;
  fileSizeBytes: number;
}

// Database comparison info for import confirmation dialog
export interface DatabaseComparisonInfo {
  current: DatabaseMetadata | null;
  imported: DatabaseMetadata | null;
}

// Encryption types
// ==================== Safe to Spend ====================
export interface SafeToSpendResult {
  safeAmount: number;           // cents
  totalBalance: number;
  upcomingBills: number;        // remaining bills this month
  savingsCommitments: number;   // monthly contribution needed
  budgetRemaining: number;      // unspent budget for month
  status: 'healthy' | 'caution' | 'low';
  breakdown: {
    bills: Array<{ description: string; amount: number; dueDate: Date }>;
    savings: Array<{ goalName: string; monthlyNeeded: number }>;
    budgetItems: Array<{ categoryName: string; remaining: number }>;
  };
}

// ==================== Age of Money ====================
export interface AgeOfMoneyResult {
  currentAge: number;              // days (rolling 30-day window)
  previousMonthAge: number | null; // for trend comparison
  trend: 'up' | 'down' | 'stable';
  explanation: string;
}

// ==================== Tax Lot Reports ====================
export interface TaxLotReportEntry {
  ticker: string;
  shares: number;
  purchaseDate: Date;
  sellDate: Date;
  proceeds: number;       // cents
  costBasis: number;      // cents
  gain: number;           // cents
  holdingPeriodDays: number;
  isLongTerm: boolean;
  hasWashSale: boolean;
}

export interface TaxLotGainGroup {
  totalProceeds: number;
  totalCostBasis: number;
  totalGain: number;
  entries: TaxLotReportEntry[];
}

export interface WashSaleFlag {
  sellTransactionId: string;
  repurchaseTransactionId: string;
  repurchaseDate: Date;
  disallowedLoss: number;  // cents (positive)
}

export interface TaxLotReport {
  taxYear: number;
  shortTermGains: TaxLotGainGroup;
  longTermGains: TaxLotGainGroup;
  totalDividends: number;  // cents
  washSaleFlags: WashSaleFlag[];
  summary: {
    netShortTermGain: number;
    netLongTermGain: number;
    totalDividends: number;
  };
}

// ==================== Enhanced Automation Rules ====================
export type AutomationActionType = 'assign_category' | 'add_tag' | 'hide_from_reports' | 'mark_transfer';

export interface AutomationRuleAction {
  id: string;
  ruleId: string;
  actionType: AutomationActionType;
  actionValue: string | null;
  createdAt: Date;
}

export interface EnhancedCategoryRule extends CategoryRule {
  amountMin: number | null;
  amountMax: number | null;
  accountFilter: string[] | null;   // account IDs
  directionFilter: 'income' | 'expense' | null;
  actions: AutomationRuleAction[];
}

// ==================== Paycheck-Based Budgeting ====================
export type PaycheckAllocationType = 'recurring_item' | 'budget_category' | 'savings_goal';

export interface PaycheckAllocation {
  id: string;
  incomeStreamId: string;
  incomeDescription: string;
  allocationType: PaycheckAllocationType;
  targetId: string;
  targetName: string;
  amount: number;  // cents
  createdAt: Date;
}

export interface PaycheckBudgetView {
  incomeStream: {
    id: string;
    description: string;
    averageAmount: number;
    frequency: string;
  };
  allocations: PaycheckAllocation[];
  totalAllocated: number;
  unallocated: number;
}

export type EncryptableEntityType = 'account' | 'recurring_item' | 'savings_goal' | 'manual_asset' | 'manual_liability' | 'investment_account';

export type SharingEntityType = EncryptableEntityType | 'all';

export interface SharePermissions {
  view: boolean;
  combine: boolean;
  reports: boolean;
}

export interface DataShare {
  id: string;
  entityId: string;
  entityType: EncryptableEntityType;
  ownerId: string;
  recipientId: string;
  wrappedDek: string;
  permissions: SharePermissions;
  createdAt: Date;
}

export interface SharingDefault {
  id: string;
  ownerId: string;
  recipientId: string;
  entityType: SharingEntityType;
  permissions: SharePermissions;
  createdAt: Date;
}

export interface UserEncryptionStatus {
  userId: string;
  hasKeys: boolean;
  publicKey?: string;
}
