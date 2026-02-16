import { NetWorthEngine } from '../net-worth-engine'
import { createTestDatabase } from './helpers/test-database'
import { setupEncryptionForUser } from './helpers/test-encryption'
import type { BudgetDatabase } from '../database'

describe('NetWorthEngine', () => {
  let db: BudgetDatabase
  let engine: NetWorthEngine
  let cleanup: () => void

  beforeEach(() => {
    const context = createTestDatabase()
    db = context.db
    cleanup = context.cleanup
    engine = new NetWorthEngine(db)
  })

  afterEach(() => {
    cleanup()
  })

  describe('calculateCurrent', () => {
    it('should calculate net worth from all sources', () => {
      db.createAccount({
        name: 'Checking',
        type: 'checking',
        balance: 100000,
        institution: 'Test Bank',
      })

      db.createManualAsset({
        name: 'House',
        category: 'property',
        value: 50000000,
        liquidity: 'illiquid',
      })

      db.createManualLiability({
        name: 'Mortgage',
        type: 'mortgage',
        balance: 30000000,
        interestRate: 0.035,
        monthlyPayment: 150000,
      })

      const result = engine.calculateCurrent()

      expect(result.bankAccountsTotal).toBe(100000)
      expect(result.manualAssetsTotal).toBe(50000000)
      expect(result.manualLiabilitiesTotal).toBe(30000000)
      expect(result.netWorth).toBe(20100000)
    })

    it('should return zeros for empty database', () => {
      const result = engine.calculateCurrent()

      expect(result.bankAccountsTotal).toBe(0)
      expect(result.investmentAccountsTotal).toBe(0)
      expect(result.manualAssetsTotal).toBe(0)
      expect(result.totalAssets).toBe(0)
      expect(result.manualLiabilitiesTotal).toBe(0)
      expect(result.totalLiabilities).toBe(0)
      expect(result.netWorth).toBe(0)
    })

    it('should calculate change from previous snapshot', () => {
      db.createAccount({
        name: 'Checking',
        type: 'checking',
        balance: 100000,
        institution: 'Test Bank',
      })

      db.createNetWorthSnapshot({
        date: new Date(Date.now() - 86400000),
        bankAccountsTotal: 80000,
        investmentAccountsTotal: 0,
        manualAssetsTotal: 0,
        totalAssets: 80000,
        manualLiabilitiesTotal: 0,
        totalLiabilities: 0,
        netWorth: 80000,
        assetBreakdown: JSON.stringify({ bankAccounts: [], investments: [], manualAssets: [] }),
        liabilityBreakdown: JSON.stringify({ liabilities: [] }),
        changeFromPrevious: 0,
        changePercentFromPrevious: 0,
      })

      const result = engine.calculateCurrent()

      expect(result.changeFromPrevious).toBe(20000)
      expect(result.changePercentFromPrevious).toBe(25)
    })

    it('should include investment accounts in calculation', () => {
      const account = db.createInvestmentAccount({
        name: '401k',
        accountType: '401k',
        institution: 'Vanguard',
      })

      const holding = db.createHolding({
        accountId: account.id,
        ticker: 'VTSAX',
        name: 'Vanguard Total Stock Market',
        currentPrice: 10000,
        sector: null,
        lastPriceUpdate: new Date(),
      })

      db.createLot({
        holdingId: holding.id,
        purchaseDate: new Date(),
        shares: 10000000,
        costPerShare: 9000,
        remainingShares: 10000000,
      })

      const result = engine.calculateCurrent()

      expect(result.investmentAccountsTotal).toBe(10000000)
      expect(result.netWorth).toBe(10000000)
    })

    it('should decrypt encrypted entities', () => {
      const userId = 'test-user-encrypt'
      setupEncryptionForUser(db, userId, 'password123')
      engine.setCurrentUserId(userId)

      db.createAccount({
        name: 'Checking',
        type: 'checking',
        balance: 100000,
        institution: 'Test Bank',
        isEncrypted: true,
      })

      const result = engine.calculateCurrent()

      expect(result.bankAccountsTotal).toBe(100000)
    })
  })

  describe('calculateAndSnapshot', () => {
    it('should create snapshot with correct JSON breakdown', () => {
      db.createAccount({
        name: 'Checking',
        type: 'checking',
        balance: 100000,
        institution: 'Test Bank',
      })

      const snapshot = engine.calculateAndSnapshot()

      expect(snapshot.netWorth).toBe(100000)
      expect(snapshot.assetBreakdown).toBeDefined()
      expect(snapshot.liabilityBreakdown).toBeDefined()

      const assetBreakdown = JSON.parse(snapshot.assetBreakdown)
      expect(assetBreakdown.bankAccounts).toHaveLength(1)
      expect(assetBreakdown.bankAccounts[0].value).toBe(100000)
    })

    it('should persist snapshot in database', () => {
      db.createAccount({
        name: 'Checking',
        type: 'checking',
        balance: 100000,
        institution: 'Test Bank',
      })

      const snapshot = engine.calculateAndSnapshot()
      const retrieved = db.getLatestNetWorthSnapshot()

      expect(retrieved).toBeDefined()
      expect(retrieved?.id).toBe(snapshot.id)
      expect(retrieved?.netWorth).toBe(100000)
    })
  })

  describe('getChangeSummary', () => {
    it('should compute delta between two date ranges', () => {
      const startDate = Date.now() - 86400000 * 30
      const endDate = Date.now()

      db.createNetWorthSnapshot({
        date: new Date(startDate),
        bankAccountsTotal: 80000,
        investmentAccountsTotal: 0,
        manualAssetsTotal: 0,
        totalAssets: 80000,
        manualLiabilitiesTotal: 0,
        totalLiabilities: 0,
        netWorth: 80000,
        assetBreakdown: JSON.stringify({ bankAccounts: [], investments: [], manualAssets: [] }),
        liabilityBreakdown: JSON.stringify({ liabilities: [] }),
        changeFromPrevious: 0,
        changePercentFromPrevious: 0,
      })

      db.createNetWorthSnapshot({
        date: new Date(endDate),
        bankAccountsTotal: 100000,
        investmentAccountsTotal: 0,
        manualAssetsTotal: 0,
        totalAssets: 100000,
        manualLiabilitiesTotal: 0,
        totalLiabilities: 0,
        netWorth: 100000,
        assetBreakdown: JSON.stringify({ bankAccounts: [], investments: [], manualAssets: [] }),
        liabilityBreakdown: JSON.stringify({ liabilities: [] }),
        changeFromPrevious: 20000,
        changePercentFromPrevious: 25,
      })

      const summary = engine.getChangeSummary(startDate, endDate)

      expect(summary).toBeDefined()
      expect(summary!.change).toBe(20000)
      expect(summary!.changePercent).toBeCloseTo(25, 1)
    })

    it('should return null with fewer than 2 snapshots', () => {
      const startDate = Date.now() - 86400000 * 30
      const endDate = Date.now()

      db.createNetWorthSnapshot({
        date: new Date(startDate),
        bankAccountsTotal: 80000,
        investmentAccountsTotal: 0,
        manualAssetsTotal: 0,
        totalAssets: 80000,
        manualLiabilitiesTotal: 0,
        totalLiabilities: 0,
        netWorth: 80000,
        assetBreakdown: JSON.stringify({ bankAccounts: [], investments: [], manualAssets: [] }),
        liabilityBreakdown: JSON.stringify({ liabilities: [] }),
        changeFromPrevious: 0,
        changePercentFromPrevious: 0,
      })

      const summary = engine.getChangeSummary(startDate, endDate)

      expect(summary).toBeNull()
    })
  })

  describe('generateProjections', () => {
    it('should generate forward projections from historical data', () => {
      for (let i = 6; i >= 0; i--) {
        const date = new Date(Date.now() - 86400000 * 30 * i)
        db.createNetWorthSnapshot({
          date,
          bankAccountsTotal: 80000 + i * 5000,
          investmentAccountsTotal: 0,
          manualAssetsTotal: 0,
          totalAssets: 80000 + i * 5000,
          manualLiabilitiesTotal: 0,
          totalLiabilities: 0,
          netWorth: 80000 + i * 5000,
          assetBreakdown: JSON.stringify({ bankAccounts: [], investments: [], manualAssets: [] }),
          liabilityBreakdown: JSON.stringify({ liabilities: [] }),
          changeFromPrevious: 0,
          changePercentFromPrevious: 0,
        })
      }

      db.createAccount({
        name: 'Checking',
        type: 'checking',
        balance: 110000,
        institution: 'Test Bank',
      })

      const projection = engine.generateProjections({
        months: 12,
        trendMonths: 6,
      })

      expect(projection.projections).toHaveLength(12)
      expect(projection.currentNetWorth).toBe(110000)
    })

    it('should handle zero history', () => {
      db.createAccount({
        name: 'Checking',
        type: 'checking',
        balance: 100000,
        institution: 'Test Bank',
      })

      const projection = engine.generateProjections({
        months: 12,
        trendMonths: 6,
      })

      expect(projection.projections).toHaveLength(12)
      expect(projection.currentNetWorth).toBe(100000)
    })
  })

  describe('calculateLoanPayoff', () => {
    it('should calculate amortization schedule from liability data', () => {
      const liability = db.createManualLiability({
        name: 'Mortgage',
        type: 'mortgage',
        balance: 30000000,
        interestRate: 0.035,
        monthlyPayment: 150000,
      })

      const payoff = engine.calculateLoanPayoff(liability.id)

      expect(payoff.liabilityId).toBe(liability.id)
      expect(payoff.liabilityName).toBe('Mortgage')
      expect(payoff.schedule).toBeDefined()
      expect(payoff.schedule.length).toBeGreaterThan(0)
    })

    it('should throw on missing liability', () => {
      expect(() => {
        engine.calculateLoanPayoff('nonexistent')
      }).toThrow('Liability not found')
    })

    it('should throw on invalid monthly payment (too low)', () => {
      const liability = db.createManualLiability({
        name: 'Loan',
        type: 'personal_loan',
        balance: 100000,
        interestRate: 0.05,
        monthlyPayment: 10,
      })

      expect(() => {
        engine.calculateLoanPayoff(liability.id)
      }).toThrow('Monthly payment is too low')
    })
  })

  describe('calculateExtraPaymentImpact', () => {
    it('should calculate interest saved from extra payments', () => {
      const liability = db.createManualLiability({
        name: 'Mortgage',
        type: 'mortgage',
        balance: 30000000,
        interestRate: 0.035,
        monthlyPayment: 150000,
      })

      const impact = engine.calculateExtraPaymentImpact(liability.id, 50000)

      expect(impact.extraMonthlyPayment).toBe(50000)
      expect(impact.interestSaved).toBeGreaterThan(0)
      expect(impact.monthsSaved).toBeGreaterThan(0)
    })

    it('should calculate months saved from extra payments', () => {
      const liability = db.createManualLiability({
        name: 'Car Loan',
        type: 'auto_loan',
        balance: 2000000,
        interestRate: 0.04,
        monthlyPayment: 50000,
      })

      const impact = engine.calculateExtraPaymentImpact(liability.id, 10000)

      expect(impact.monthsSaved).toBeGreaterThan(0)
    })
  })
})
