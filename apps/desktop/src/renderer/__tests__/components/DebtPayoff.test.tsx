import { screen, fireEvent, waitFor } from '@testing-library/react';
import DebtPayoff from '../../components/DebtPayoff';
import { renderWithProviders, setupWindowApi, cleanupWindowApi } from '../helpers/render-helpers';

describe('DebtPayoff', () => {
  const mockDebtPayoffReport = {
    debts: [
      {
        id: '1',
        name: 'Credit Card',
        balance: 500000,
        interestRate: 18.99,
        minimumPayment: 5000,
      },
    ],
    totalDebt: 500000,
    totalMinimumPayments: 5000,
    strategies: [
      {
        strategy: 'avalanche' as const,
        label: 'Avalanche (Highest Interest First)',
        totalInterestPaid: 50000,
        totalPaid: 550000,
        payoffDate: new Date('2027-01-01'),
        monthsToPayoff: 24,
        debtPayoffPlans: [],
        payoffOrder: ['1'],
      },
    ],
    recommended: 'avalanche' as const,
    recommendationReason: 'Saves the most interest',
    extraPaymentImpacts: [],
  };

  beforeEach(() => {
    setupWindowApi();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window.api as any).debtPayoff = {
      generate: jest.fn().mockResolvedValue(mockDebtPayoffReport),
    };
  });

  afterEach(() => {
    cleanupWindowApi();
  });

  it('displays total debt', async () => {
    renderWithProviders(<DebtPayoff />);

    await waitFor(() => {
      expect(screen.getByText(/total debt/i)).toBeInTheDocument();
    });
  });

  it('shows payoff strategies', async () => {
    renderWithProviders(<DebtPayoff />);

    await waitFor(() => {
      const avalancheElements = screen.getAllByText(/avalanche/i);
      expect(avalancheElements.length).toBeGreaterThan(0);
    });
  });

  it('displays payoff date', async () => {
    renderWithProviders(<DebtPayoff />);

    await waitFor(() => {
      expect(screen.getByText(/debt-free date/i)).toBeInTheDocument();
    });
  });

  it('shows monthly minimum payment', async () => {
    renderWithProviders(<DebtPayoff />);

    await waitFor(() => {
      expect(screen.getByText(/monthly minimum/i)).toBeInTheDocument();
    });
  });

  it('selects different strategy', async () => {
    renderWithProviders(<DebtPayoff />);

    await waitFor(() => {
      const strategyButtons = screen.getAllByRole('button');
      const avalancheButton = strategyButtons.find(b => b.textContent?.includes('Avalanche'));
      if (avalancheButton) {
        fireEvent.click(avalancheButton);
      }
    });
  });

  it('handles empty debts', async () => {
    window.api.debtPayoff.generate = jest.fn().mockResolvedValue({
      ...mockDebtPayoffReport,
      debts: [],
    });

    renderWithProviders(<DebtPayoff />);

    await waitFor(() => {
      expect(screen.getByText(/no interest-bearing debts/i)).toBeInTheDocument();
    });
  });

  it('displays number of debts', async () => {
    renderWithProviders(<DebtPayoff />);

    await waitFor(() => {
      expect(screen.getByText(/number of debts/i)).toBeInTheDocument();
    });
  });

  it('refreshes data', async () => {
    renderWithProviders(<DebtPayoff />);

    await waitFor(() => {
      const refreshButton = screen.getByText(/refresh/i);
      fireEvent.click(refreshButton);
    });

    await waitFor(() => {
      expect(window.api.debtPayoff.generate).toHaveBeenCalledTimes(2);
    });
  });
});
