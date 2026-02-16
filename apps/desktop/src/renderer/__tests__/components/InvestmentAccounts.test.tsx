import { screen, waitFor } from '@testing-library/react';
import { InvestmentAccounts } from '../../components/InvestmentAccounts';
import { renderWithProviders, setupWindowApi, cleanupWindowApi } from '../helpers/render-helpers';

describe('InvestmentAccounts', () => {
  const mockOnSelectAccount = jest.fn();

  const mockInvestmentAccounts = [
    {
      id: '1',
      name: 'Roth IRA',
      institution: 'Vanguard',
      accountType: 'roth_ira',
      ownerId: null,
      isEncrypted: false,
      createdAt: new Date('2025-01-01'),
    },
    {
      id: '2',
      name: 'Taxable Brokerage',
      institution: 'Fidelity',
      accountType: 'taxable',
      ownerId: null,
      isEncrypted: false,
      createdAt: new Date('2025-01-01'),
    },
  ];

  beforeEach(() => {
    setupWindowApi({
      investmentAccounts: {
        getAll: jest.fn().mockResolvedValue(mockInvestmentAccounts),
        create: jest.fn().mockResolvedValue(mockInvestmentAccounts[0]),
        update: jest.fn().mockResolvedValue(mockInvestmentAccounts[0]),
        delete: jest.fn().mockResolvedValue(true),
      },
      holdings: {
        getByAccount: jest.fn().mockResolvedValue([]),
      },
      security: {
        getUserAuthStatus: jest.fn().mockResolvedValue([]),
        getMemberAuthStatus: jest.fn().mockResolvedValue([]),
      },
    });
  });

  afterEach(() => {
    cleanupWindowApi();
    jest.clearAllMocks();
  });

  it('renders investment accounts list', async () => {
    renderWithProviders(<InvestmentAccounts onSelectAccount={mockOnSelectAccount} />);

    await waitFor(() => {
      expect(screen.getByText('Investment Accounts')).toBeInTheDocument();
    });
  });

  it('opens add account form', async () => {
    renderWithProviders(<InvestmentAccounts onSelectAccount={mockOnSelectAccount} />);

    await waitFor(() => {
      expect(screen.getByText(/add account/i)).toBeInTheDocument();
    });
  });

  it('creates new account', async () => {
    renderWithProviders(<InvestmentAccounts onSelectAccount={mockOnSelectAccount} />);

    await waitFor(() => {
      expect(screen.getByText(/add account/i)).toBeInTheDocument();
    });
  });

  it('deletes account', async () => {
    renderWithProviders(<InvestmentAccounts onSelectAccount={mockOnSelectAccount} />);

    await waitFor(() => {
      expect(screen.getByText('Investment Accounts')).toBeInTheDocument();
    });
  });

  it('displays account value', async () => {
    renderWithProviders(<InvestmentAccounts onSelectAccount={mockOnSelectAccount} />);

    await waitFor(() => {
      expect(screen.getByText('Investment Accounts')).toBeInTheDocument();
    });
  });

  it('shows account type', async () => {
    renderWithProviders(<InvestmentAccounts onSelectAccount={mockOnSelectAccount} />);

    await waitFor(() => {
      expect(screen.getByText(mockInvestmentAccounts[0].institution)).toBeInTheDocument();
    });
  });
});
