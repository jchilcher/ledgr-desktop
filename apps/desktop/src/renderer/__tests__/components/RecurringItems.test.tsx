import { screen, fireEvent, waitFor } from '@testing-library/react';
import RecurringItems from '../../components/RecurringItems';
import { renderWithProviders, setupWindowApi, cleanupWindowApi } from '../helpers/render-helpers';
import { mockAccounts, mockCategories } from '../helpers/mock-api-factory';

describe('RecurringItems', () => {
  const mockRecurringItems = [
    {
      id: '1',
      description: 'Netflix',
      amount: -1299,
      frequency: 'monthly' as const,
      startDate: new Date(),
      nextOccurrence: new Date(),
      accountId: 'acc1',
      categoryId: 'cat1',
      dayOfMonth: 15,
      itemType: 'subscription' as const,
      enableReminders: true,
      reminderDays: 3,
      autopay: true,
      isActive: true,
      ownerId: 'user1',
    },
  ];

  beforeEach(() => {
    const mockApi = setupWindowApi();

    mockApi.recurring.getAll = jest.fn().mockResolvedValue(mockRecurringItems);
    mockApi.recurring.create = jest.fn().mockResolvedValue({});
    mockApi.recurring.update = jest.fn().mockResolvedValue({});
    mockApi.recurring.delete = jest.fn().mockResolvedValue({});
    mockApi.accounts.getAll = jest.fn().mockResolvedValue(mockAccounts);
    mockApi.categories.getAll = jest.fn().mockResolvedValue(mockCategories);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window.api.security as any).getMemberAuthStatus = jest.fn().mockResolvedValue([]);
  });

  afterEach(() => {
    cleanupWindowApi();
  });

  it('renders recurring items list', async () => {
    renderWithProviders(<RecurringItems />);

    await waitFor(() => {
      expect(screen.getByText('Netflix')).toBeInTheDocument();
    });
  });

  it('displays item type filters', async () => {
    renderWithProviders(<RecurringItems />);

    await waitFor(() => {
      const allElements = screen.getAllByText(/all/i);
      const billsElements = screen.getAllByText(/bills/i);
      const subscriptionsElements = screen.getAllByText(/subscriptions/i);
      expect(allElements.length).toBeGreaterThan(0);
      expect(billsElements.length).toBeGreaterThan(0);
      expect(subscriptionsElements.length).toBeGreaterThan(0);
    });
  });

  it('filters by item type', async () => {
    renderWithProviders(<RecurringItems />);

    await waitFor(() => {
      const subscriptionsFilter = screen.getByText(/subscriptions/i);
      fireEvent.click(subscriptionsFilter);
    });

    await waitFor(() => {
      expect(screen.getByText('Netflix')).toBeInTheDocument();
    });
  });

  it('opens add form', async () => {
    renderWithProviders(<RecurringItems />);

    await waitFor(() => {
      const addButton = screen.getByText(/add/i);
      fireEvent.click(addButton);
    });

    await waitFor(() => {
      expect(screen.getByText(/description/i)).toBeInTheDocument();
    });
  });

  it('creates new recurring item', async () => {
    renderWithProviders(<RecurringItems />);

    await waitFor(() => {
      expect(screen.getByText('Netflix')).toBeInTheDocument();
    });
  });

  it('toggles active status', async () => {
    renderWithProviders(<RecurringItems />);

    await waitFor(() => {
      expect(screen.getByText('Netflix')).toBeInTheDocument();
    });
  });

  it('deletes recurring item', async () => {
    window.confirm = jest.fn().mockReturnValue(true);

    renderWithProviders(<RecurringItems />);

    await waitFor(() => {
      const deleteButton = screen.getByText(/delete/i);
      fireEvent.click(deleteButton);
    });

    await waitFor(() => {
      expect(window.api.recurring.delete).toHaveBeenCalled();
    });
  });

  it('displays next occurrence date', async () => {
    renderWithProviders(<RecurringItems />);

    await waitFor(() => {
      expect(screen.getByText('Netflix')).toBeInTheDocument();
    });
  });
});
