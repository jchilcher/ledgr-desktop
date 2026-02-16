import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PerformanceDashboard } from '../../components/PerformanceDashboard';
import { setupWindowApi, cleanupWindowApi } from '../helpers/render-helpers';

describe('PerformanceDashboard', () => {
  const mockMetrics = {
    portfolio: {
      totalValue: 100000000,
      totalCostBasis: 80000000,
      unrealizedGain: 20000000,
      unrealizedGainPercent: 25,
      dayChange: 100000,
      dayChangePercent: 1,
      realizedGainYTD: 500000,
      realizedGainTotal: 1000000,
    },
    returns: {
      twr: 0.255,
      mwr: 0.232,
    },
    benchmarkReturn: 0.201,
    positions: [],
  };

  beforeEach(() => {
    setupWindowApi({
      performance: {
        calculate: jest.fn().mockResolvedValue({
          portfolio: mockMetrics.portfolio,
          positions: mockMetrics.positions,
          realizedGains: [],
          returns: mockMetrics.returns,
          calculatedAt: new Date(),
        }),
        getMetrics: jest.fn().mockResolvedValue({
          portfolio: mockMetrics.portfolio,
          positions: mockMetrics.positions,
          returns: mockMetrics.returns,
          benchmarkReturn: mockMetrics.benchmarkReturn,
        }),
        getDefaultPeriod: jest.fn().mockResolvedValue('YTD'),
        setDefaultPeriod: jest.fn().mockResolvedValue({}),
      },
    });
  });

  afterEach(() => {
    cleanupWindowApi();
  });

  it('displays portfolio value', async () => {
    render(<PerformanceDashboard />);

    await waitFor(() => {
      expect(screen.getByText(/total portfolio value/i)).toBeInTheDocument();
    });
  });

  it('shows unrealized gain/loss', async () => {
    render(<PerformanceDashboard />);

    await waitFor(() => {
      expect(screen.getByText(/unrealized gain\/loss/i)).toBeInTheDocument();
    });
  });

  it('displays period selector', async () => {
    render(<PerformanceDashboard />);

    await waitFor(() => {
      expect(screen.getByText('YTD')).toBeInTheDocument();
      expect(screen.getByText('1Y')).toBeInTheDocument();
    });
  });

  it('changes period selection', async () => {
    render(<PerformanceDashboard />);

    await waitFor(() => {
      const button1Y = screen.getByText('1Y');
      fireEvent.click(button1Y);
    });

    await waitFor(() => {
      expect(window.api.performance.setDefaultPeriod).toHaveBeenCalledWith('1Y');
    });
  });

  it('shows TWR and MWR', async () => {
    render(<PerformanceDashboard />);

    await waitFor(() => {
      expect(screen.getByText(/TWR: \+25\.50%/)).toBeInTheDocument();
      expect(screen.getByText(/MWR: \+23\.20%/)).toBeInTheDocument();
    });
  });

  it('displays benchmark comparison', async () => {
    render(<PerformanceDashboard />);

    await waitFor(() => {
      expect(screen.getByText(/vs S&P 500: \+5\.40%/)).toBeInTheDocument();
    });
  });
});
