import React from 'react'
import { screen, fireEvent, waitFor } from '@testing-library/react'
import { renderWithProviders, setupWindowApi, cleanupWindowApi } from '../helpers/render-helpers'
import Dashboard from '../../components/Dashboard'

jest.mock('recharts', () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ResponsiveContainer: ({ children }: any) => <div data-testid="responsive-container">{children}</div>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  LineChart: ({ children }: any) => <div data-testid="line-chart">{children}</div>,
  Line: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  Legend: () => null,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  BarChart: ({ children }: any) => <div data-testid="bar-chart">{children}</div>,
  Bar: () => null,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  PieChart: ({ children }: any) => <div data-testid="pie-chart">{children}</div>,
  Pie: () => null,
  Cell: () => null,
}))

jest.mock('react-grid-layout', () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Responsive: ({ children }: any) => <div data-testid="grid-layout">{children}</div>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  WidthProvider: (component: any) => component,
}))

describe('Dashboard', () => {
  let mockApi: ReturnType<typeof setupWindowApi>
  const mockNavigate = jest.fn()

  beforeEach(() => {
    mockApi = setupWindowApi()
    mockApi.accounts.getAll.mockResolvedValue([
      {
        id: '1',
        name: 'Checking',
        type: 'checking',
        institution: 'Test Bank',
        balance: 500000,
        lastSynced: null,
        createdAt: new Date('2025-01-01'),
        ownership: 'mine',
        ownerId: null,
        isEncrypted: false,
      },
      {
        id: '2',
        name: 'Savings',
        type: 'savings',
        institution: 'Test Bank',
        balance: 1000000,
        lastSynced: null,
        createdAt: new Date('2025-01-01'),
        ownership: 'mine',
        ownerId: null,
        isEncrypted: false,
      },
    ])
    mockApi.transactions.getAll.mockResolvedValue([
      {
        id: '1',
        accountId: '1',
        date: new Date('2025-01-15'),
        description: 'Grocery Store',
        amount: -8500,
        categoryId: '1',
        isRecurring: false,
        importSource: 'file',
        createdAt: new Date('2025-01-15'),
        fitId: null,
        isInternalTransfer: false,
        notes: null,
        isHidden: false,
      },
    ])
    mockApi.categories.getAll.mockResolvedValue([
      {
        id: '1',
        name: 'Groceries',
        type: 'expense',
        icon: '🛒',
        color: '#3498db',
        isDefault: true,
        parentId: null,
      },
    ])
    mockApi.reimbursements.getAll.mockResolvedValue([])
    mockApi.splits.getByTransactionIds.mockResolvedValue([])
    mockApi.cashflow.forecast.mockResolvedValue({ warnings: [], projections: [] })
    mockApi.savingsGoals.getAlerts.mockResolvedValue([])
    mockApi.netWorthCalc.calculate.mockResolvedValue({ netWorth: 1500000, totalAssets: 1500000, totalLiabilities: 0 })
    mockApi.budgetGoals.getAll.mockResolvedValue([])
    mockApi.recurring.getActive.mockResolvedValue([])
    mockApi.safeToSpend.calculate.mockResolvedValue({
      safeAmount: 100000,
      totalBalance: 150000,
      upcomingBills: 25000,
      savingsCommitments: 15000,
      budgetRemaining: 10000,
      status: 'healthy',
      breakdown: { bills: [], savings: [], budgetItems: [] },
    })
    mockApi.ageOfMoney.calculate.mockResolvedValue({
      currentAge: 15,
      previousMonthAge: 12,
      trend: 'up',
      explanation: 'Your money is lasting longer',
    })
    mockApi.dashboardLayout.get.mockResolvedValue(null)
    mockApi.dashboardLayout.getWidgets.mockResolvedValue(null)
  })

  afterEach(() => {
    cleanupWindowApi()
    jest.restoreAllMocks()
  })

  it('renders dashboard with data', async () => {
    renderWithProviders(<Dashboard onNavigate={mockNavigate} />)

    await waitFor(() => {
      expect(screen.getByText('Dashboard')).toBeInTheDocument()
    })

    await waitFor(() => {
      expect(screen.getByTestId('total-balance')).toHaveTextContent('$15,000.00')
    })
  })

  it('displays account summaries', async () => {
    renderWithProviders(<Dashboard onNavigate={mockNavigate} />)

    await waitFor(() => {
      expect(screen.getByText('Checking')).toBeInTheDocument()
      expect(screen.getByText('Savings')).toBeInTheDocument()
    })
  })

  it('shows monthly spending and income', async () => {
    renderWithProviders(<Dashboard onNavigate={mockNavigate} />)

    await waitFor(() => {
      expect(screen.getByTestId('monthly-spending')).toHaveTextContent('$85.00')
    })

    await waitFor(() => {
      expect(screen.getByTestId('monthly-income')).toHaveTextContent('$0.00')
    })
  })

  it('displays recent transactions', async () => {
    renderWithProviders(<Dashboard onNavigate={mockNavigate} />)

    await waitFor(() => {
      expect(screen.getByTestId('recent-transactions')).toBeInTheDocument()
      expect(screen.getByText('Grocery Store')).toBeInTheDocument()
    })
  })

  it('shows top spending categories', async () => {
    renderWithProviders(<Dashboard onNavigate={mockNavigate} />)

    await waitFor(() => {
      expect(screen.getByTestId('top-categories')).toBeInTheDocument()
      expect(screen.getByText('Groceries')).toBeInTheDocument()
    })
  })

  it('navigates to transactions on account click', async () => {
    renderWithProviders(<Dashboard onNavigate={mockNavigate} />)

    await waitFor(() => {
      expect(screen.getByText('Checking')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Checking'))
    expect(mockNavigate).toHaveBeenCalledWith('transactions', '1')
  })

  it('shows customize button', async () => {
    renderWithProviders(<Dashboard onNavigate={mockNavigate} />)

    await waitFor(() => {
      expect(screen.getByText('Customize')).toBeInTheDocument()
    })
  })

  it('opens customize modal when customize button clicked', async () => {
    renderWithProviders(<Dashboard onNavigate={mockNavigate} />)

    await waitFor(() => {
      expect(screen.getByText('Customize')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Customize'))

    await waitFor(() => {
      expect(screen.getByText('Customize Dashboard')).toBeInTheDocument()
    })
  })

  it('handles empty state with no accounts', async () => {
    mockApi.accounts.getAll.mockResolvedValue([])

    renderWithProviders(<Dashboard onNavigate={mockNavigate} />)

    await waitFor(() => {
      expect(screen.getByTestId('total-balance')).toHaveTextContent('$0.00')
    })
  })

  it('displays balance warnings when present', async () => {
    mockApi.cashflow.forecast.mockResolvedValue({
      warnings: [
        {
          type: 'negative_balance',
          date: new Date('2025-02-01').toISOString(),
          balance: -50000,
          message: 'Account will go negative',
        },
      ],
      projections: [],
    })

    renderWithProviders(<Dashboard onNavigate={mockNavigate} />)

    await waitFor(() => {
      expect(screen.getByText(/Account will go negative/)).toBeInTheDocument()
    })
  })
})
