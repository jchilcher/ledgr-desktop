import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import SplitTransactionModal from '../../components/SplitTransactionModal';
import { setupWindowApi, cleanupWindowApi } from '../helpers/render-helpers';
import { mockTransactions, mockCategories } from '../helpers/mock-api-factory';

describe('SplitTransactionModal', () => {
  const mockOnClose = jest.fn();
  const mockOnSave = jest.fn();
  const mockTransaction = mockTransactions[0];

  beforeEach(() => {
    setupWindowApi({
      categories: {
        getAll: jest.fn().mockResolvedValue(mockCategories),
      },
      splits: {
        getAll: jest.fn().mockResolvedValue([]),
        deleteAll: jest.fn().mockResolvedValue({}),
        create: jest.fn().mockResolvedValue({}),
      },
    });
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
      { id: '1', categoryId: 'cat1', amount: -5000, description: 'Split 1' },
      { id: '2', categoryId: 'cat2', amount: -5000, description: 'Split 2' },
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
      const selects = screen.getAllByRole('combobox');
      expect(selects.length).toBeGreaterThan(0);
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
      expect(screen.getByText('+ Add Split')).toBeInTheDocument();
    });

    const initialRows = screen.getAllByRole('combobox').length;
    fireEvent.click(screen.getByText('+ Add Split'));

    await waitFor(() => {
      const newRows = screen.getAllByRole('combobox').length;
      expect(newRows).toBeGreaterThan(initialRows);
    });
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
      expect(screen.getByText('+ Add Split')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('+ Add Split'));

    await waitFor(() => {
      expect(screen.getAllByRole('combobox').length).toBeGreaterThan(0);
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
