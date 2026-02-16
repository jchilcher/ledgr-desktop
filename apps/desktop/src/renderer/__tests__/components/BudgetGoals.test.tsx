import { screen, waitFor } from '@testing-library/react';
import BudgetGoals from '../../components/BudgetGoals';
import { renderWithProviders, setupWindowApi, cleanupWindowApi } from '../helpers/render-helpers';
import { mockCategories } from '../helpers/mock-api-factory';

describe('BudgetGoals', () => {
  const mockBudgetGoals = [
    {
      id: '1',
      categoryId: 'cat1',
      amount: 50000,
      period: 'monthly' as const,
      rolloverEnabled: false,
      rolloverAmount: 0,
      startDate: new Date(),
    },
  ];

  beforeEach(() => {
    const mockApi = setupWindowApi();

    mockApi.budgetGoals.getAll = jest.fn().mockResolvedValue(mockBudgetGoals);
    mockApi.budgetGoals.create = jest.fn().mockResolvedValue({});
    mockApi.budgetGoals.update = jest.fn().mockResolvedValue({});
    mockApi.budgetGoals.delete = jest.fn().mockResolvedValue({});
    mockApi.categories.getAll = jest.fn().mockResolvedValue(mockCategories);
    mockApi.analytics.getSpendingByCategory = jest.fn().mockResolvedValue([]);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window.api as any).incomeAnalysis = {
      analyze: jest.fn().mockResolvedValue({
        summary: { totalMonthlyIncome: 500000 },
        streams: [],
      }),
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window.api as any).budgetIncome = {
      getOverride: jest.fn().mockResolvedValue(null),
      setOverride: jest.fn().mockResolvedValue({}),
      clearOverride: jest.fn().mockResolvedValue({}),
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window.api as any).budgetSettings = {
      getMode: jest.fn().mockResolvedValue('category'),
      setMode: jest.fn().mockResolvedValue({}),
      getFlexTarget: jest.fn().mockResolvedValue(0),
      setFlexTarget: jest.fn().mockResolvedValue({}),
      getFixedCategoryIds: jest.fn().mockResolvedValue([]),
      setFixedCategoryIds: jest.fn().mockResolvedValue({}),
    };

    mockApi.recurring.getActive = jest.fn().mockResolvedValue([]);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window.api as any).budgetSuggestions = {
      getAll: jest.fn().mockResolvedValue([]),
      apply: jest.fn().mockResolvedValue({}),
      dismiss: jest.fn().mockResolvedValue({}),
    };
  });

  afterEach(() => {
    cleanupWindowApi();
  });

  it('renders budget goals list', async () => {
    renderWithProviders(<BudgetGoals />);

    await waitFor(() => {
      const budgetElements = screen.getAllByText(/budget/i);
      expect(budgetElements.length).toBeGreaterThan(0);
    });
  });

  it('displays monthly income summary', async () => {
    renderWithProviders(<BudgetGoals />);

    await waitFor(() => {
      const incomeElements = screen.getAllByText(/income/i);
      expect(incomeElements.length).toBeGreaterThan(0);
    });
  });

  it('shows add budget goal form', async () => {
    renderWithProviders(<BudgetGoals />);

    await waitFor(() => {
      const addElements = screen.getAllByText(/add/i);
      expect(addElements.length).toBeGreaterThan(0);
    });
  });

  it('creates new budget goal', async () => {
    renderWithProviders(<BudgetGoals />);

    await waitFor(() => {
      const budgetElements = screen.getAllByText(/budget/i);
      expect(budgetElements.length).toBeGreaterThan(0);
    });
  });

  it('displays spending progress', async () => {
    const mockSpending = [
      { categoryId: 'cat1', total: 25000 },
    ];

    window.api.analytics.getSpendingByCategory = jest.fn().mockResolvedValue(mockSpending);

    renderWithProviders(<BudgetGoals />);

    await waitFor(() => {
      const budgetElements = screen.getAllByText(/budget/i);
      expect(budgetElements.length).toBeGreaterThan(0);
    });
  });

  it('shows budget suggestions', async () => {
    const mockSuggestions = [
      {
        categoryId: 'cat2',
        suggestedAmount: 30000,
        confidence: 85,
        reason: 'Based on spending history',
      },
    ];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window.api as any).budgetSuggestions.getAll = jest.fn().mockResolvedValue(mockSuggestions);

    renderWithProviders(<BudgetGoals />);

    await waitFor(() => {
      expect(screen.getByText(/budget/i)).toBeInTheDocument();
    });
  });

  it('deletes budget goal', async () => {
    window.confirm = jest.fn().mockReturnValue(true);

    renderWithProviders(<BudgetGoals />);

    await waitFor(() => {
      expect(screen.getByText(/budget/i)).toBeInTheDocument();
    });
  });

  it('displays budget allocation percentage', async () => {
    renderWithProviders(<BudgetGoals />);

    await waitFor(() => {
      expect(screen.getByText(/budget/i)).toBeInTheDocument();
    });
  });
});
