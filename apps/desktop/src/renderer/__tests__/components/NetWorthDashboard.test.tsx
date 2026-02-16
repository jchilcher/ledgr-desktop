import { screen, fireEvent, waitFor } from '@testing-library/react';
import NetWorthDashboard from '../../components/NetWorthDashboard';
import { renderWithProviders, setupWindowApi, cleanupWindowApi } from '../helpers/render-helpers';

describe('NetWorthDashboard', () => {
  let mockApi: ReturnType<typeof setupWindowApi>

  beforeEach(() => {
    mockApi = setupWindowApi()
    mockApi.netWorthCalc.calculate.mockResolvedValue({
      totalAssets: 1500000,
      totalLiabilities: 500000,
      netWorth: 1000000,
      changeFromPrevious: 50000,
      changePercentFromPrevious: 5.25,
      bankAccounts: {
        total: 500000,
        accounts: [
          { id: '1', name: 'Checking', type: 'checking', balance: 500000 }
        ]
      },
      investments: {
        total: 800000,
        accounts: [
          { id: '1', accountId: '1', accountName: 'IRA', totalValue: 800000 }
        ]
      },
      manualAssets: {
        total: 200000,
        assets: [
          { id: '1', name: 'House', currentValue: 200000, category: 'real_estate' }
        ]
      },
      manualLiabilities: {
        total: 500000,
        liabilities: [
          { id: '1', name: 'Mortgage', currentBalance: 500000, type: 'mortgage' }
        ]
      },
    })
    mockApi.netWorthCalc.getChangeSummary.mockResolvedValue({
      change: 25000,
      changePercent: 2.5,
      fromDate: new Date(),
      toDate: new Date(),
      period: 'month',
    })
  })

  afterEach(() => {
    cleanupWindowApi()
  })

  it('displays net worth total', async () => {
    renderWithProviders(<NetWorthDashboard />)

    await waitFor(() => {
      expect(screen.getAllByText(/net worth/i).length).toBeGreaterThan(0)
    })
  })

  it('shows bank accounts total', async () => {
    renderWithProviders(<NetWorthDashboard />)

    await waitFor(() => {
      expect(screen.getByText(/bank accounts/i)).toBeInTheDocument()
    })
  })

  it('displays investments total', async () => {
    renderWithProviders(<NetWorthDashboard />)

    await waitFor(() => {
      expect(screen.getByText(/investments/i)).toBeInTheDocument()
    })
  })

  it('shows liabilities', async () => {
    renderWithProviders(<NetWorthDashboard />)

    await waitFor(() => {
      expect(screen.getAllByText(/liabilities/i).length).toBeGreaterThan(0)
    })
  })

  it('displays change from previous', async () => {
    renderWithProviders(<NetWorthDashboard />)

    await waitFor(() => {
      expect(screen.getByText(/from last snapshot/i)).toBeInTheDocument()
    })
  })

  it('refreshes data', async () => {
    renderWithProviders(<NetWorthDashboard />)

    await waitFor(() => {
      const refreshButton = screen.getByText(/refresh/i)
      fireEvent.click(refreshButton)
    })

    await waitFor(() => {
      expect(mockApi.netWorthCalc.calculate).toHaveBeenCalledTimes(2)
    })
  })

  it('shows monthly change summary', async () => {
    renderWithProviders(<NetWorthDashboard />)

    await waitFor(() => {
      expect(mockApi.netWorthCalc.getChangeSummary).toHaveBeenCalled()
    })
  })

  it('renders breakdown component', async () => {
    renderWithProviders(<NetWorthDashboard />)

    await waitFor(() => {
      expect(screen.getAllByText(/net worth/i).length).toBeGreaterThan(0)
    })
  })
});
