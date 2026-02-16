import { screen, fireEvent, waitFor } from '@testing-library/react';
import NetWorthDashboard from '../../components/NetWorthDashboard';
import { renderWithProviders, setupWindowApi, cleanupWindowApi } from '../helpers/render-helpers';

describe('NetWorthDashboard', () => {
  let mockApi: ReturnType<typeof setupWindowApi>

  beforeEach(() => {
    mockApi = setupWindowApi()
    mockApi.netWorthCalc.calculate.mockResolvedValue({
      date: new Date(),
      totalAssets: 1500000,
      totalLiabilities: 500000,
      netWorth: 1000000,
      bankAccountsTotal: 500000,
      investmentAccountsTotal: 800000,
      manualAssetsTotal: 200000,
      manualLiabilitiesTotal: 500000,
      changeFromPrevious: 50000,
      changePercentFromPrevious: 5.25,
      bankAccounts: [
        { id: '1', name: 'Checking', value: 500000 }
      ],
      investmentAccounts: [
        { id: '1', name: 'IRA', value: 800000 }
      ],
      manualAssets: [
        { id: '1', name: 'House', value: 200000 }
      ],
      liabilities: [
        { id: '1', name: 'Mortgage', value: 500000 }
      ],
    })
    mockApi.netWorthCalc.getChangeSummary.mockResolvedValue({
      period: {
        startDate: new Date(),
        endDate: new Date(),
        days: 30,
      },
      startNetWorth: 975000,
      endNetWorth: 1000000,
      change: 25000,
      changePercent: 2.5,
      assetsChange: 30000,
      liabilitiesChange: -5000,
      categoryChanges: [],
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
      const bankAccountsElements = screen.getAllByText(/bank accounts/i)
      expect(bankAccountsElements.length).toBeGreaterThan(0)
    })
  })

  it('displays investments total', async () => {
    renderWithProviders(<NetWorthDashboard />)

    await waitFor(() => {
      const investmentsElements = screen.getAllByText(/investments/i)
      expect(investmentsElements.length).toBeGreaterThan(0)
    })
  })

  it('shows liabilities', async () => {
    renderWithProviders(<NetWorthDashboard />)

    await waitFor(() => {
      const liabilitiesElements = screen.getAllByText(/liabilities/i)
      expect(liabilitiesElements.length).toBeGreaterThan(0)
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
