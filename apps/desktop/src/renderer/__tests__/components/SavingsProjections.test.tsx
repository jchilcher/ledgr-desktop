import { render, screen, waitFor } from '@testing-library/react';
import SavingsProjections from '../../components/SavingsProjections';
import { setupWindowApi, cleanupWindowApi } from '../helpers/render-helpers';

describe('SavingsProjections', () => {
  const mockProjectionReport = {
    projections: [
      {
        goalId: '1',
        goalName: 'Emergency Fund',
        targetAmount: 1000000,
        currentAmount: 500000,
        remainingAmount: 500000,
        percentComplete: 50,
        targetDate: new Date('2026-12-31'),
        currentMonthlyRate: 20000,
        averageContribution: 20000,
        projectedCompletionDate: new Date('2027-06-01'),
        monthsToCompletion: 12,
        requiredMonthlyToHitTarget: 25000,
        onTrack: false,
        scenarios: [],
        contributionHistory: [],
      },
    ],
    summary: {
      totalTargetAmount: 1000000,
      totalCurrentAmount: 500000,
      totalRemainingAmount: 500000,
      goalsOnTrack: 0,
      goalsAtRisk: 1,
      averagePercentComplete: 50,
      estimatedTotalMonthlyNeeded: 25000,
    },
    recommendations: ['Increase monthly contribution to stay on track'],
  };

  beforeEach(() => {
    setupWindowApi();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window.api as any).savingsProjection = {
      generate: jest.fn().mockResolvedValue(mockProjectionReport),
    };
  });

  afterEach(() => {
    cleanupWindowApi();
  });

  it('displays total target amount', async () => {
    render(<SavingsProjections />);

    await waitFor(() => {
      expect(screen.getByText(/total target/i)).toBeInTheDocument();
    });
  });

  it('shows savings goals', async () => {
    render(<SavingsProjections />);

    await waitFor(() => {
      expect(screen.getByText('Emergency Fund')).toBeInTheDocument();
    });
  });

  it('displays progress percentage', async () => {
    render(<SavingsProjections />);

    await waitFor(() => {
      const percentageElements = screen.getAllByText(/50%/);
      expect(percentageElements.length).toBeGreaterThan(0);
    });
  });

  it('shows goals status', async () => {
    render(<SavingsProjections />);

    await waitFor(() => {
      const riskElements = screen.getAllByText(/at risk/i);
      expect(riskElements.length).toBeGreaterThan(0);
    });
  });

  it('displays recommendations', async () => {
    render(<SavingsProjections />);

    await waitFor(() => {
      expect(screen.getByText(/increase monthly contribution/i)).toBeInTheDocument();
    });
  });

  it('handles empty projections', async () => {
    window.api.savingsProjection.generate = jest.fn().mockResolvedValue({
      ...mockProjectionReport,
      projections: [],
    });

    render(<SavingsProjections />);

    await waitFor(() => {
      expect(screen.getByText(/no savings goals/i)).toBeInTheDocument();
    });
  });
});
