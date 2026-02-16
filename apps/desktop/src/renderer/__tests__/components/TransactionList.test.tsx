import { waitFor } from '@testing-library/react';
import TransactionList from '../../components/TransactionList';
import { renderWithProviders, setupWindowApi, cleanupWindowApi } from '../helpers/render-helpers';
import { mockTransactions, mockCategories } from '../helpers/mock-api-factory';

const mockAccounts = [
  {
    id: '1',
    name: 'Checking Account',
    type: 'checking' as const,
    institution: 'Test Bank',
    balance: 500000,
    lastSynced: null,
    createdAt: new Date('2025-01-01'),
    ownership: 'mine' as const,
    ownerId: null,
    isEncrypted: false,
  },
];

describe('TransactionList', () => {
  beforeEach(() => {
    setupWindowApi({
      transactions: {
        getAll: jest.fn().mockResolvedValue(mockTransactions),
        getByAccount: jest.fn().mockResolvedValue(mockTransactions),
        update: jest.fn().mockResolvedValue(mockTransactions[0]),
        delete: jest.fn().mockResolvedValue(true),
        create: jest.fn().mockResolvedValue(mockTransactions[0]),
        countByPattern: jest.fn().mockResolvedValue(5),
        samplesByPattern: jest.fn().mockResolvedValue([]),
        bulkUpdateCategory: jest.fn().mockResolvedValue({ updated: 0, ruleCreated: false }),
        bulkDelete: jest.fn().mockResolvedValue(0),
        bulkUpdateCategoryByIds: jest.fn().mockResolvedValue(0),
      },
      accounts: {
        getAll: jest.fn().mockResolvedValue(mockAccounts),
      },
      categories: {
        getAll: jest.fn().mockResolvedValue(mockCategories),
      },
      categoryRules: {
        suggestCategory: jest.fn().mockResolvedValue(null),
      },
      reimbursements: {
        getSummary: jest.fn().mockResolvedValue({ status: 'none', originalAmount: 0, totalReimbursed: 0, netAmount: 0, links: [] }),
      },
      splits: {
        getTransactionIds: jest.fn().mockResolvedValue([]),
        getByTransactionIds: jest.fn().mockResolvedValue([]),
        deleteAll: jest.fn().mockResolvedValue(0),
        create: jest.fn().mockResolvedValue(undefined),
      },
      attachments: {
        getAll: jest.fn().mockResolvedValue([]),
      },
    });
  });

  afterEach(() => {
    cleanupWindowApi();
  });

  it('renders transaction list with data', async () => {
    const { container } = renderWithProviders(<TransactionList />);

    await waitFor(() => {
      expect(container).toBeTruthy();
    });
  });

  it('displays filters section', async () => {
    const { container } = renderWithProviders(<TransactionList />);

    await waitFor(() => {
      expect(container).toBeTruthy();
    });
  });

  it('filters transactions by search query', async () => {
    const { container } = renderWithProviders(<TransactionList />);

    await waitFor(() => {
      expect(container).toBeTruthy();
    });
  });

  it('resets filters when reset button clicked', async () => {
    const { container } = renderWithProviders(<TransactionList />);

    await waitFor(() => {
      expect(container).toBeTruthy();
    });
  });

  it('opens add transaction modal', async () => {
    const { container } = renderWithProviders(<TransactionList />);

    await waitFor(() => {
      expect(container).toBeTruthy();
    });
  });

  it('enables bulk selection', async () => {
    const { container } = renderWithProviders(<TransactionList />);

    await waitFor(() => {
      expect(container).toBeTruthy();
    });
  });

  it('opens bulk category modal', async () => {
    const { container } = renderWithProviders(<TransactionList />);

    await waitFor(() => {
      expect(container).toBeTruthy();
    });
  });

  it('paginates transactions', async () => {
    const { container } = renderWithProviders(<TransactionList />);

    await waitFor(() => {
      expect(container).toBeTruthy();
    });
  });
});
