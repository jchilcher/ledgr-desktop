import { BudgetDatabase } from './database';
import {
  NetWorthService,
  NetWorthComponent,
  NetWorthCalculation,
  NetWorthChangeSummary,
  NetWorthProjectionConfig,
  NetWorthForecast,
  LoanPayoffCalculation,
  LoanExtraPaymentImpact,
} from '@ledgr/core';
import {
  NetWorthSnapshot,
} from '../shared/types';
import { decryptEntityList } from './encryption-middleware';

// Re-export types from core
export {
  NetWorthComponent,
  NetWorthCalculation,
  NetWorthChangeSummary,
  NetWorthProjectionConfig,
  NetWorthForecast,
  LoanPayoffCalculation,
  LoanExtraPaymentImpact,
};

/**
 * NetWorthEngine - Integrates NetWorthService with database and desktop-specific operations
 *
 * Responsibilities:
 * - Fetch current account, investment, asset, and liability data from database
 * - Convert database records to NetWorthComponent format
 * - Calculate current net worth using NetWorthService
 * - Create snapshots in database for historical tracking
 * - Generate projections based on historical snapshots
 * - Calculate loan payoff schedules from manual liabilities
 */
export class NetWorthEngine {
  private service: NetWorthService;
  private currentUserId: string | null = null;

  constructor(private db: BudgetDatabase) {
    this.service = new NetWorthService();
  }

  setCurrentUserId(userId: string | null): void {
    this.currentUserId = userId;
  }

  /**
   * Calculates current net worth from all sources
   *
   * @returns Complete net worth calculation with all components
   */
  calculateCurrent(): NetWorthCalculation {
    // Fetch all components from database
    const bankAccounts = this.getBankAccountComponents();
    const investments = this.getInvestmentComponents();
    const assets = this.getManualAssetComponents();
    const liabilities = this.getManualLiabilityComponents();

    // Get previous snapshot for change calculation
    const previousSnapshot = this.db.getLatestNetWorthSnapshot();

    return this.service.calculateNetWorth(
      bankAccounts,
      investments,
      assets,
      liabilities,
      previousSnapshot
    );
  }

  /**
   * Calculates net worth and creates a snapshot in the database
   *
   * @returns Created snapshot with ID
   */
  calculateAndSnapshot(): NetWorthSnapshot {
    const calculation = this.calculateCurrent();

    // Create snapshot in database
    const snapshot = this.db.createNetWorthSnapshot({
      date: calculation.date,
      bankAccountsTotal: calculation.bankAccountsTotal,
      investmentAccountsTotal: calculation.investmentAccountsTotal,
      manualAssetsTotal: calculation.manualAssetsTotal,
      totalAssets: calculation.totalAssets,
      manualLiabilitiesTotal: calculation.manualLiabilitiesTotal,
      totalLiabilities: calculation.totalLiabilities,
      netWorth: calculation.netWorth,
      assetBreakdown: JSON.stringify({
        bankAccounts: calculation.bankAccounts,
        investments: calculation.investmentAccounts,
        manualAssets: calculation.manualAssets,
      }),
      liabilityBreakdown: JSON.stringify({
        liabilities: calculation.liabilities,
      }),
      changeFromPrevious: calculation.changeFromPrevious,
      changePercentFromPrevious: calculation.changePercentFromPrevious,
    });

    return snapshot;
  }

  /**
   * Gets change summary between two dates
   *
   * @param startDate Start of period (unix timestamp)
   * @param endDate End of period (unix timestamp)
   * @returns Change summary or null if insufficient data
   */
  getChangeSummary(startDate: number, endDate: number): NetWorthChangeSummary | null {
    const snapshots = this.db.getNetWorthSnapshotsByDateRange(startDate, endDate);

    if (snapshots.length < 2) {
      return null;
    }

    // Get earliest and latest snapshots in range
    const sortedSnapshots = snapshots.sort((a, b) => a.date.getTime() - b.date.getTime());
    const startSnapshot = sortedSnapshots[0];
    const endSnapshot = sortedSnapshots[sortedSnapshots.length - 1];

    // Convert snapshots to calculations with breakdowns
    const startCalc = this.snapshotToCalculation(startSnapshot);
    const endCalc = this.snapshotToCalculation(endSnapshot);

    return this.service.calculateChangeSummary(startCalc, endCalc);
  }

  /**
   * Generates net worth projections
   *
   * @param config Projection configuration
   * @returns Net worth projection with confidence intervals
   */
  generateProjections(config: NetWorthProjectionConfig): NetWorthForecast {
    const current = this.calculateCurrent();

    // Get historical snapshots for trend analysis
    const trendMonths = config.trendMonths || 12;
    const historicalSnapshots = this.db
      .getNetWorthSnapshots(trendMonths * 2) // Get double to ensure enough data
      .map(snapshot => ({
        date: snapshot.date,
        netWorth: snapshot.netWorth,
        totalAssets: snapshot.totalAssets,
        totalLiabilities: snapshot.totalLiabilities,
      }));

    return this.service.generateProjections(
      current.netWorth,
      current.totalAssets,
      current.totalLiabilities,
      historicalSnapshots,
      config
    );
  }

  /**
   * Calculates payoff schedule for a manual liability
   *
   * @param liabilityId ID of the liability
   * @returns Loan payoff calculation with amortization schedule
   */
  calculateLoanPayoff(liabilityId: string): LoanPayoffCalculation {
    const rawLiability = this.db.getManualLiabilityById(liabilityId);

    if (!rawLiability) {
      throw new Error(`Liability not found: ${liabilityId}`);
    }

    const [liability] = decryptEntityList(this.db, 'manual_liability', [rawLiability], this.currentUserId);
    if (!liability) {
      throw new Error(`Cannot decrypt liability: ${liabilityId}`);
    }

    if (!liability.interestRate || !liability.monthlyPayment) {
      throw new Error('Liability missing interest rate or monthly payment');
    }

    return this.service.calculateLoanPayoff(
      liability.id,
      liability.name,
      liability.balance,
      liability.interestRate,
      liability.monthlyPayment
    );
  }

  /**
   * Calculates impact of extra payments on a loan
   *
   * @param liabilityId ID of the liability
   * @param extraMonthlyPayment Additional monthly payment in cents
   * @returns Impact analysis
   */
  calculateExtraPaymentImpact(
    liabilityId: string,
    extraMonthlyPayment: number
  ): LoanExtraPaymentImpact {
    const baselinePayoff = this.calculateLoanPayoff(liabilityId);

    return this.service.calculateExtraPaymentImpact(baselinePayoff, extraMonthlyPayment);
  }

  /**
   * Private: Converts bank accounts to NetWorthComponent array
   */
  private getBankAccountComponents(): NetWorthComponent[] {
    const accounts = decryptEntityList(this.db, 'account', this.db.getAccounts(), this.currentUserId);

    return accounts.map(account => ({
      id: account.id,
      name: account.name,
      value: account.balance,
      category: account.type,
      type: 'bank' as const,
    }));
  }

  /**
   * Private: Converts investment accounts to NetWorthComponent array
   */
  private getInvestmentComponents(): NetWorthComponent[] {
    const accounts = this.db.getInvestmentAccounts();

    return accounts.map(account => {
      // Calculate total value from holdings
      const holdings = this.db.getHoldingsByAccount(account.id);
      const totalValue = holdings.reduce((sum, holding) => {
        return sum + (holding.sharesOwned * holding.currentPrice) / 10000;
      }, 0);

      return {
        id: account.id,
        name: account.name,
        value: totalValue,
        category: account.accountType,
        type: 'investment' as const,
      };
    });
  }

  /**
   * Private: Converts manual assets to NetWorthComponent array
   */
  private getManualAssetComponents(): NetWorthComponent[] {
    const assets = decryptEntityList(this.db, 'manual_asset', this.db.getManualAssets(), this.currentUserId);

    return assets.map(asset => ({
      id: asset.id,
      name: asset.name,
      value: asset.value,
      category: asset.customCategory || asset.category,
      type: 'manual_asset' as const,
    }));
  }

  /**
   * Private: Converts manual liabilities to NetWorthComponent array
   */
  private getManualLiabilityComponents(): NetWorthComponent[] {
    const liabilities = decryptEntityList(this.db, 'manual_liability', this.db.getManualLiabilities(), this.currentUserId);

    return liabilities.map(liability => ({
      id: liability.id,
      name: liability.name,
      value: liability.balance, // Stored as positive, treated as negative in calculations
      category: liability.type,
      type: 'manual_liability' as const,
    }));
  }

  /**
   * Private: Converts snapshot to calculation format
   */
  private snapshotToCalculation(snapshot: NetWorthSnapshot): NetWorthCalculation {
    // Parse breakdowns from JSON
    const assetBreakdown = JSON.parse(snapshot.assetBreakdown);
    const liabilityBreakdown = JSON.parse(snapshot.liabilityBreakdown);

    return {
      date: snapshot.date,
      bankAccountsTotal: snapshot.bankAccountsTotal,
      investmentAccountsTotal: snapshot.investmentAccountsTotal,
      manualAssetsTotal: snapshot.manualAssetsTotal,
      totalAssets: snapshot.totalAssets,
      manualLiabilitiesTotal: snapshot.manualLiabilitiesTotal,
      totalLiabilities: snapshot.totalLiabilities,
      netWorth: snapshot.netWorth,
      bankAccounts: assetBreakdown.bankAccounts || [],
      investmentAccounts: assetBreakdown.investments || [],
      manualAssets: assetBreakdown.manualAssets || [],
      liabilities: liabilityBreakdown.liabilities || [],
      changeFromPrevious: snapshot.changeFromPrevious,
      changePercentFromPrevious: snapshot.changePercentFromPrevious,
    };
  }
}
