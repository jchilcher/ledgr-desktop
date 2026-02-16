import { screen, fireEvent, waitFor } from '@testing-library/react';
import BillCalendar from '../../components/BillCalendar';
import { renderWithProviders, setupWindowApi, cleanupWindowApi } from '../helpers/render-helpers';

describe('BillCalendar', () => {
  const mockOptimizationReport = {
    projectionDays: 90,
    projections: [
      {
        date: new Date(),
        balance: 100000,
        inflows: 50000,
        outflows: 30000,
        items: [],
      },
    ],
    lowBalanceWindows: [],
    billClusters: [],
    recommendations: [],
    summary: {
      lowestProjectedBalance: 100000,
      lowestBalanceDate: null,
      averageBalance: 100000,
      daysAtRisk: 0,
      billClusteringScore: 80,
      optimizationPotential: 5,
    },
    insights: [],
  };

  beforeEach(() => {
    const mockApi = setupWindowApi();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window.api as any).cashFlowOptimization = {
      optimize: jest.fn().mockResolvedValue(mockOptimizationReport),
    };

    mockApi.recurringPayments.getByDateRange = jest.fn().mockResolvedValue([]);
  });

  afterEach(() => {
    cleanupWindowApi();
  });

  it('renders calendar view', async () => {
    renderWithProviders(<BillCalendar />);

    await waitFor(() => {
      expect(screen.getByText(/sun/i)).toBeInTheDocument();
    });
  });

  it('displays month navigation', async () => {
    renderWithProviders(<BillCalendar />);

    await waitFor(() => {
      const month = new Date().toLocaleDateString('en-US', { month: 'long' });
      expect(screen.getByText(new RegExp(month, 'i'))).toBeInTheDocument();
    });
  });

  it('shows projection days selector', async () => {
    renderWithProviders(<BillCalendar />);

    await waitFor(() => {
      expect(screen.getByText(/30 days/i)).toBeInTheDocument();
    });
  });

  it('navigates to next month', async () => {
    renderWithProviders(<BillCalendar />);

    await waitFor(() => {
      const currentMonth = new Date().toLocaleDateString('en-US', { month: 'long' });
      expect(screen.getByText(new RegExp(currentMonth, 'i'))).toBeInTheDocument();
    });

    const nextButton = screen.getByRole('button', { name: '>' });
    fireEvent.click(nextButton);

    await waitFor(() => {
      const nextMonth = new Date(new Date().setMonth(new Date().getMonth() + 1)).toLocaleDateString('en-US', { month: 'long' });
      expect(screen.getByText(new RegExp(nextMonth, 'i'))).toBeInTheDocument();
    });
  });

  it('highlights today', async () => {
    renderWithProviders(<BillCalendar />);

    await waitFor(() => {
      const today = new Date().getDate();
      const todayElement = screen.getAllByText(today.toString()).find(el =>
        el.closest('.calendar-day--today')
      );
      expect(todayElement).toBeInTheDocument();
    });
  });

  it('displays optimization insights', async () => {
    const reportWithInsights = {
      ...mockOptimizationReport,
      insights: ['Insight 1', 'Insight 2'],
    };

    window.api.cashFlowOptimization.optimize = jest.fn().mockResolvedValue(reportWithInsights);

    renderWithProviders(<BillCalendar />);

    await waitFor(() => {
      expect(screen.getByText('Insight 1')).toBeInTheDocument();
    });
  });
});
