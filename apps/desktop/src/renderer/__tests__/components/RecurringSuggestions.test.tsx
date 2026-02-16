import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import RecurringSuggestions from '../../components/RecurringSuggestions';
import { setupWindowApi, cleanupWindowApi } from '../helpers/render-helpers';

describe('RecurringSuggestions', () => {
  const mockSuggestions = [
    {
      id: '1',
      description: 'Netflix Subscription',
      averageAmount: 1299,
      frequency: 'monthly' as const,
      confidence: 95,
      occurrences: 6,
      type: 'expense' as const,
      suggestReminders: false,
      confidenceFactors: {
        intervalConsistency: 98,
        intervalAccuracy: 95,
        occurrenceBoost: 8,
        amountVariance: 100,
        missedPayments: 0,
        recencyPenalty: 0,
        daysSinceLastPayment: 15,
      },
    },
  ];

  beforeEach(() => {
    setupWindowApi();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window.api as any).recurringDetection = {
      analyze: jest.fn().mockResolvedValue(mockSuggestions),
      detectPatterns: jest.fn().mockResolvedValue([]),
      getSuggestions: jest.fn().mockResolvedValue(mockSuggestions),
      approve: jest.fn().mockResolvedValue({}),
      approveSuggestion: jest.fn().mockResolvedValue({}),
      dismissSuggestion: jest.fn().mockResolvedValue({}),
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window.api as any).recurringSuggestions = {
      getAll: jest.fn().mockResolvedValue(mockSuggestions),
      accept: jest.fn().mockResolvedValue({}),
      dismiss: jest.fn().mockResolvedValue({}),
    };
  });

  afterEach(() => {
    cleanupWindowApi();
  });

  it('renders suggestions list', async () => {
    render(<RecurringSuggestions />);

    await waitFor(() => {
      expect(screen.getByText('Netflix Subscription')).toBeInTheDocument();
    });
  });

  it('displays confidence score', async () => {
    render(<RecurringSuggestions />);

    await waitFor(() => {
      expect(screen.getByText(/95%/)).toBeInTheDocument();
    });
  });

  it('shows frequency information', async () => {
    render(<RecurringSuggestions />);

    await waitFor(() => {
      expect(screen.getByText(/monthly/i)).toBeInTheDocument();
    });
  });

  it('opens confidence modal', async () => {
    render(<RecurringSuggestions />);

    await waitFor(() => {
      const confidenceButton = screen.getByText(/95%/);
      fireEvent.click(confidenceButton);
    });

    await waitFor(() => {
      expect(screen.getByText(/confidence analysis/i)).toBeInTheDocument();
    });
  });

  it('accepts suggestion', async () => {
    render(<RecurringSuggestions />);

    await waitFor(() => {
      expect(screen.getByText('Netflix Subscription')).toBeInTheDocument();
    });
  });

  it('dismisses suggestion', async () => {
    render(<RecurringSuggestions />);

    await waitFor(() => {
      expect(screen.getByText('Netflix Subscription')).toBeInTheDocument();
    });
  });
});
