import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AnomalyAlerts from '../../components/AnomalyAlerts';
import { setupWindowApi, cleanupWindowApi } from '../helpers/render-helpers';

describe('AnomalyAlerts', () => {
  const mockAnomalyResult = {
    anomalies: [
      {
        id: '1',
        type: 'unusual_amount' as const,
        severity: 'high' as const,
        transactionId: 'tx1',
        description: 'Unusually high charge at grocery store',
        amount: 50000,
        expectedAmount: 15000,
        zScore: 3.5,
        detectedAt: new Date(),
        acknowledged: false,
      },
    ],
    summary: {
      totalAnomalies: 1,
      byType: { unusual_amount: 1 },
      bySeverity: { high: 1 },
    },
  };

  beforeEach(() => {
    setupWindowApi();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window.api as any).anomalyDetection = {
      detect: jest.fn().mockResolvedValue(mockAnomalyResult),
      acknowledge: jest.fn().mockResolvedValue({}),
    };
  });

  afterEach(() => {
    cleanupWindowApi();
  });

  it('displays anomalies', async () => {
    render(<AnomalyAlerts />);

    await waitFor(() => {
      expect(screen.getByText(/unusually high charge/i)).toBeInTheDocument();
    });
  });

  it('shows severity indicator', async () => {
    render(<AnomalyAlerts />);

    await waitFor(() => {
      const highElements = screen.getAllByText(/high/i);
      expect(highElements.length).toBeGreaterThan(0);
    });
  });

  it('displays anomaly type', async () => {
    render(<AnomalyAlerts />);

    await waitFor(() => {
      const unusualElements = screen.getAllByText(/unusual amount/i);
      expect(unusualElements.length).toBeGreaterThan(0);
    });
  });

  it('shows no anomalies message when empty', async () => {
    window.api.anomalyDetection.detect = jest.fn().mockResolvedValue({
      anomalies: [],
      summary: { totalAnomalies: 0, byType: {}, bySeverity: {} },
    });

    render(<AnomalyAlerts />);

    await waitFor(() => {
      expect(screen.getByText(/no anomalies detected/i)).toBeInTheDocument();
    });
  });

  it('dismisses anomaly', async () => {
    render(<AnomalyAlerts />);

    await waitFor(() => {
      const dismissButton = screen.getByText(/dismiss/i);
      fireEvent.click(dismissButton);
    });
  });

  it('renders compact mode', async () => {
    render(<AnomalyAlerts compact={true} />);

    await waitFor(() => {
      expect(screen.getByText(/detected/i)).toBeInTheDocument();
    });
  });
});
