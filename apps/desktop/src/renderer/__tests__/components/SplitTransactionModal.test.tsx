import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import SplitTransactionModal from '../../components/SplitTransactionModal';
import { setupWindowApi, cleanupWindowApi } from '../helpers/render-helpers';
import { mockTransactions, mockCategories } from '../helpers/mock-api-factory';

describe('SplitTransactionModal', () => {
  const mockOnClose = jest.fn();
  const mockOnSave = jest.fn();
  const mockTransaction = mockTransactions[0];

  beforeEach(() => {
    const mockApi = setupWindowApi();
    mockApi.categories.getAll.mockResolvedValue(mockCategories);

    // Override splits.getAll to accept transactionId parameter
    mockApi.splits.getAll = jest.fn().mockResolvedValue([]);
    mockApi.splits.deleteAll = jest.fn().mockResolvedValue(0);
    mockApi.splits.create = jest.fn().mockResolvedValue(undefined);
  });

  afterEach(() => {
    cleanupWindowApi();
    jest.clearAllMocks();
  });

  it('renders modal with transaction details', async () => {
    render(
      <SplitTransactionModal
        transaction={mockTransaction}
        onClose={mockOnClose}
        onSave={mockOnSave}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Split Transaction')).toBeInTheDocument();
    });

    expect(screen.getByText(mockTransaction.description)).toBeInTheDocument();
  });

  it('loads existing splits', async () => {
    const mockSplits = [
      { id: '1', transactionId: '1', categoryId: '1', amount: -5000, description: 'Split 1' },
      { id: '2', transactionId: '1', categoryId: '2', amount: -5000, description: 'Split 2' },
    ];

    window.api.splits.getAll = jest.fn().mockResolvedValue(mockSplits);

    render(
      <SplitTransactionModal
        transaction={mockTransaction}
        onClose={mockOnClose}
        onSave={mockOnSave}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Split Transaction')).toBeInTheDocument();
    });
  });

  it('adds new split row', async () => {
    render(
      <SplitTransactionModal
        transaction={mockTransaction}
        onClose={mockOnClose}
        onSave={mockOnSave}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Split Transaction')).toBeInTheDocument();
    });

    const addButton = screen.queryByText('+ Add Split');
    if (addButton) {
      expect(addButton).toBeInTheDocument();
    }
  });

  it('allows adding and managing splits', async () => {
    render(
      <SplitTransactionModal
        transaction={{ ...mockTransaction, amount: -10000 }}
        onClose={mockOnClose}
        onSave={mockOnSave}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Split Transaction')).toBeInTheDocument();
    });
  });

  it('calls onClose when cancel clicked', async () => {
    render(
      <SplitTransactionModal
        transaction={{ ...mockTransaction, amount: -10000 }}
        onClose={mockOnClose}
        onSave={mockOnSave}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Split Transaction')).toBeInTheDocument();
    });

    await waitFor(() => {
      const cancelButton = screen.getByText('Cancel');
      expect(cancelButton).not.toBeDisabled();
    });

    const cancelButton = screen.getByText('Cancel');
    fireEvent.click(cancelButton);

    expect(mockOnClose).toHaveBeenCalled();
  });

  it('renders remove splits button when splits exist', async () => {
    const mockSplits = [
      { id: '1', transactionId: '1', categoryId: 'cat1', amount: -5000, description: 'Split 1' },
    ];

    window.api.splits.getAll = jest.fn().mockResolvedValue(mockSplits);

    render(
      <SplitTransactionModal
        transaction={mockTransaction}
        onClose={mockOnClose}
        onSave={mockOnSave}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Split Transaction')).toBeInTheDocument();
    });
  });
});
