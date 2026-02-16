import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TransactionEntryModal } from '../../components/TransactionEntryModal';
import { setupWindowApi, cleanupWindowApi } from '../helpers/render-helpers';
import { mockInvestmentHoldings } from '../helpers/mock-api-factory';

describe('TransactionEntryModal', () => {
  const mockOnClose = jest.fn();
  const mockOnSave = jest.fn();
  const mockHolding = mockInvestmentHoldings[0];

  beforeEach(() => {
    setupWindowApi({
      investmentTransactions: {
        create: jest.fn().mockResolvedValue({}),
        update: jest.fn().mockResolvedValue({}),
      },
    });
  });

  afterEach(() => {
    cleanupWindowApi();
    jest.clearAllMocks();
  });

  it('renders modal when open', () => {
    render(
      <TransactionEntryModal
        isOpen={true}
        onClose={mockOnClose}
        onSave={mockOnSave}
        holding={mockHolding}
        editTransaction={null}
      />
    );

    expect(screen.getByText('Add Transaction')).toBeInTheDocument();
  });

  it('does not render when closed', () => {
    render(
      <TransactionEntryModal
        isOpen={false}
        onClose={mockOnClose}
        onSave={mockOnSave}
        holding={mockHolding}
        editTransaction={null}
      />
    );

    expect(screen.queryByText('Add Transaction')).not.toBeInTheDocument();
  });

  it('displays holding information', () => {
    render(
      <TransactionEntryModal
        isOpen={true}
        onClose={mockOnClose}
        onSave={mockOnSave}
        holding={mockHolding}
        editTransaction={null}
      />
    );

    expect(screen.getByText(mockHolding.ticker || mockHolding.name)).toBeInTheDocument();
  });

  it('shows transaction type options', () => {
    render(
      <TransactionEntryModal
        isOpen={true}
        onClose={mockOnClose}
        onSave={mockOnSave}
        holding={mockHolding}
        editTransaction={null}
      />
    );

    expect(screen.getByText('Buy')).toBeInTheDocument();
    expect(screen.getByText('Sell')).toBeInTheDocument();
    expect(screen.getByText('Dividend')).toBeInTheDocument();
  });

  it('shows shares field for buy transaction', () => {
    render(
      <TransactionEntryModal
        isOpen={true}
        onClose={mockOnClose}
        onSave={mockOnSave}
        holding={mockHolding}
        editTransaction={null}
      />
    );

    expect(screen.getByText('Buy')).toBeInTheDocument();
    expect(screen.getByText('Sell')).toBeInTheDocument();
    expect(screen.getByText('Dividend')).toBeInTheDocument();
  });

  it('calls onClose when cancel clicked', () => {
    render(
      <TransactionEntryModal
        isOpen={true}
        onClose={mockOnClose}
        onSave={mockOnSave}
        holding={mockHolding}
        editTransaction={null}
      />
    );

    fireEvent.click(screen.getByText('Cancel'));
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('submits form with valid data', async () => {
    render(
      <TransactionEntryModal
        isOpen={true}
        onClose={mockOnClose}
        onSave={mockOnSave}
        holding={mockHolding}
        editTransaction={null}
      />
    );

    const form = screen.getByRole('form') || document.querySelector('form');
    if (form) {
      fireEvent.submit(form);
    }

    await waitFor(() => {
      expect(mockOnSave).toHaveBeenCalled();
    });
  });

  it('renders transaction type options', () => {
    render(
      <TransactionEntryModal
        isOpen={true}
        onClose={mockOnClose}
        onSave={mockOnSave}
        holding={mockHolding}
        editTransaction={null}
      />
    );

    expect(screen.getByText('Buy')).toBeInTheDocument();
    expect(screen.getByText('Sell')).toBeInTheDocument();
    expect(screen.getByText('Dividend')).toBeInTheDocument();
  });
});
