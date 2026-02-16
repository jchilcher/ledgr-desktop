import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import FinancialHealthScore from '../../components/FinancialHealthScore';
import { setupWindowApi, cleanupWindowApi } from '../helpers/render-helpers';

describe('FinancialHealthScore', () => {
  const mockHealthScore = {
    overallScore: 75,
    grade: 'B' as const,
    factors: [
      {
        name: 'Emergency Fund',
        score: 80,
        weight: 0.3,
        status: 'good' as const,
        recommendation: 'Maintain current savings rate',
      },
    ],
    recommendations: ['Continue building emergency fund'],
    trend: 'improving' as const,
    previousScore: 70,
  };

  beforeEach(() => {
    setupWindowApi({
      financialHealthCalc: {
        calculate: jest.fn().mockResolvedValue(mockHealthScore),
      },
      financialHealth: {
        getHistory: jest.fn().mockResolvedValue([]),
        createSnapshot: jest.fn().mockResolvedValue({}),
      },
    });
  });

  afterEach(() => {
    cleanupWindowApi();
  });

  it('displays overall health score', async () => {
    render(<FinancialHealthScore />);

    await waitFor(() => {
      expect(screen.getByText('75')).toBeInTheDocument();
    });
  });

  it('shows grade letter', async () => {
    render(<FinancialHealthScore />);

    await waitFor(() => {
      expect(screen.getByText('B')).toBeInTheDocument();
    });
  });

  it('displays health factors', async () => {
    render(<FinancialHealthScore />);

    await waitFor(() => {
      expect(screen.getByText('Emergency Fund')).toBeInTheDocument();
    });
  });

  it('shows trend indicator', async () => {
    render(<FinancialHealthScore />);

    await waitFor(() => {
      expect(screen.getByText(/improving/i)).toBeInTheDocument();
    });
  });

  it('saves snapshot', async () => {
    render(<FinancialHealthScore />);

    await waitFor(() => {
      const saveButton = screen.getByText(/save snapshot/i);
      fireEvent.click(saveButton);
    });

    await waitFor(() => {
      expect(window.api.financialHealth.createSnapshot).toHaveBeenCalled();
    });
  });

  it('toggles history view', async () => {
    render(<FinancialHealthScore />);

    await waitFor(() => {
      const historyButton = screen.getByText(/show history/i);
      fireEvent.click(historyButton);
    });

    await waitFor(() => {
      expect(screen.getByText(/hide history/i)).toBeInTheDocument();
    });
  });

  it('shows recommendations', async () => {
    render(<FinancialHealthScore />);

    await waitFor(() => {
      expect(screen.getByText('Continue building emergency fund')).toBeInTheDocument();
    });
  });

  it('refreshes data', async () => {
    render(<FinancialHealthScore />);

    await waitFor(() => {
      const refreshButton = screen.getByText(/refresh/i);
      fireEvent.click(refreshButton);
    });

    await waitFor(() => {
      expect(window.api.financialHealthCalc.calculate).toHaveBeenCalledTimes(2);
    });
  });
});
