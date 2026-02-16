import React from 'react';
import { render, waitFor, screen, renderHook, act } from '@testing-library/react';
import { HouseholdProvider, useHousehold } from '../../contexts/HouseholdContext';
import { setupWindowApi, cleanupWindowApi } from '../helpers/render-helpers';
import type { User, DataShare } from '../../../shared/types';

const TestComponent = () => {
  const { currentUserId, householdFilter, users } = useHousehold();
  return (
    <div>
      <div data-testid="current-user">{currentUserId || 'none'}</div>
      <div data-testid="filter">{householdFilter}</div>
      <div data-testid="user-count">{users.length}</div>
    </div>
  );
};

describe('HouseholdContext', () => {
  let mockApi: ReturnType<typeof setupWindowApi>;

  beforeEach(() => {
    mockApi = setupWindowApi();
  });

  afterEach(() => {
    cleanupWindowApi();
  });

  it('throws error when used outside provider', () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

    expect(() => {
      renderHook(() => useHousehold());
    }).toThrow('useHousehold must be used within a HouseholdProvider');

    consoleErrorSpy.mockRestore();
  });

  it('provides default values', async () => {
    mockApi.users.getAll = jest.fn().mockResolvedValue([]);
    mockApi.sharing.getSharedWithMe = jest.fn().mockResolvedValue([]);

    render(
      <HouseholdProvider>
        <TestComponent />
      </HouseholdProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('current-user')).toBeInTheDocument();
    });

    expect(screen.getByTestId('current-user').textContent).toBe('none');
    expect(screen.getByTestId('filter').textContent).toBe('all');
    expect(screen.getByTestId('user-count').textContent).toBe('0');
  });

  it('auto-selects single user on mount', async () => {
    const mockUser: User = {
      id: 'user1',
      name: 'Test User',
      color: '#3498db',
      isDefault: true,
      createdAt: new Date(),
    };

    mockApi.users.getAll = jest.fn().mockResolvedValue([mockUser]);
    mockApi.sharing.getSharedWithMe = jest.fn().mockResolvedValue([]);
    mockApi.security.getCurrentUser = jest.fn().mockResolvedValue(null);

    render(
      <HouseholdProvider>
        <TestComponent />
      </HouseholdProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('current-user').textContent).toBe('user1');
    });

    expect(screen.getByTestId('filter').textContent).toBe('user1');
  });

  it('loads users from API on mount', async () => {
    const mockUsers: User[] = [
      {
        id: 'user1',
        name: 'User 1',
        color: '#3498db',
        isDefault: true,
        createdAt: new Date(),
      },
      {
        id: 'user2',
        name: 'User 2',
        color: '#e74c3c',
        isDefault: false,
        createdAt: new Date(),
      },
    ];

    mockApi.users.getAll = jest.fn().mockResolvedValue(mockUsers);
    mockApi.sharing.getSharedWithMe = jest.fn().mockResolvedValue([]);
    mockApi.security.getCurrentUser = jest.fn().mockResolvedValue('user1');

    render(
      <HouseholdProvider>
        <TestComponent />
      </HouseholdProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('user-count').textContent).toBe('2');
    });

    expect(mockApi.users.getAll).toHaveBeenCalled();
  });

  it('syncs auth state from main process', async () => {
    const mockUsers: User[] = [
      {
        id: 'user1',
        name: 'User 1',
        color: '#3498db',
        isDefault: true,
        createdAt: new Date(),
      },
      {
        id: 'user2',
        name: 'User 2',
        color: '#e74c3c',
        isDefault: false,
        createdAt: new Date(),
      },
    ];

    mockApi.users.getAll = jest.fn().mockResolvedValue(mockUsers);
    mockApi.sharing.getSharedWithMe = jest.fn().mockResolvedValue([]);
    mockApi.security.getCurrentUser = jest.fn().mockResolvedValue('user2');

    render(
      <HouseholdProvider>
        <TestComponent />
      </HouseholdProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('current-user').textContent).toBe('user2');
    });
  });

  it('falls back to default user when main process has no user', async () => {
    const mockUsers: User[] = [
      {
        id: 'user1',
        name: 'User 1',
        color: '#3498db',
        isDefault: true,
        createdAt: new Date(),
      },
      {
        id: 'user2',
        name: 'User 2',
        color: '#e74c3c',
        isDefault: false,
        createdAt: new Date(),
      },
    ];

    mockApi.users.getAll = jest.fn().mockResolvedValue(mockUsers);
    mockApi.sharing.getSharedWithMe = jest.fn().mockResolvedValue([]);
    mockApi.security.getCurrentUser = jest.fn().mockResolvedValue(null);

    render(
      <HouseholdProvider>
        <TestComponent />
      </HouseholdProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('current-user').textContent).toBe('user1');
    });
  });

  it('filters items by ownership', async () => {
    const mockUsers: User[] = [
      {
        id: 'user1',
        name: 'User 1',
        color: '#3498db',
        isDefault: true,
        createdAt: new Date(),
      },
    ];

    mockApi.users.getAll = jest.fn().mockResolvedValue(mockUsers);
    mockApi.sharing.getSharedWithMe = jest.fn().mockResolvedValue([]);
    mockApi.security.getCurrentUser = jest.fn().mockResolvedValue('user1');

    const { result } = renderHook(() => useHousehold(), {
      wrapper: ({ children }) => <HouseholdProvider>{children}</HouseholdProvider>,
    });

    await waitFor(() => {
      expect(result.current.currentUserId).toBe('user1');
    });

    const items = [
      { id: '1', ownerId: 'user1', name: 'Item 1' },
      { id: '2', ownerId: 'user2', name: 'Item 2' },
      { id: '3', ownerId: null, name: 'Item 3' },
    ];

    const filtered = result.current.filterByOwnership(items);

    expect(filtered).toHaveLength(2);
    expect(filtered.map(i => i.id)).toEqual(['1', '3']);
  });

  it('includes shared items in filter', async () => {
    const mockUsers: User[] = [
      {
        id: 'user1',
        name: 'User 1',
        color: '#3498db',
        isDefault: true,
        createdAt: new Date(),
      },
    ];

    const mockShares: DataShare[] = [
      {
        id: 'share1',
        entityType: 'account',
        entityId: '2',
        ownerId: 'user2',
        sharedWithUserId: 'user1',
        permissions: 'read',
        createdAt: new Date(),
      },
    ];

    mockApi.users.getAll = jest.fn().mockResolvedValue(mockUsers);
    mockApi.sharing.getSharedWithMe = jest.fn().mockResolvedValue(mockShares);
    mockApi.security.getCurrentUser = jest.fn().mockResolvedValue('user1');

    const { result } = renderHook(() => useHousehold(), {
      wrapper: ({ children }) => <HouseholdProvider>{children}</HouseholdProvider>,
    });

    await waitFor(() => {
      expect(result.current.currentUserId).toBe('user1');
    });

    const items = [
      { id: '1', ownerId: 'user1', name: 'Item 1' },
      { id: '2', ownerId: 'user2', name: 'Item 2' },
      { id: '3', ownerId: 'user3', name: 'Item 3' },
    ];

    const filtered = result.current.filterByOwnership(items);

    expect(filtered).toHaveLength(2);
    expect(filtered.map(i => i.id)).toEqual(['1', '2']);
  });

  it('returns all items when filter is "all"', async () => {
    const mockUsers: User[] = [
      {
        id: 'user1',
        name: 'User 1',
        color: '#3498db',
        isDefault: true,
        createdAt: new Date(),
      },
    ];

    mockApi.users.getAll = jest.fn().mockResolvedValue(mockUsers);
    mockApi.sharing.getSharedWithMe = jest.fn().mockResolvedValue([]);
    mockApi.security.getCurrentUser = jest.fn().mockResolvedValue('user1');

    const { result } = renderHook(() => useHousehold(), {
      wrapper: ({ children }) => <HouseholdProvider>{children}</HouseholdProvider>,
    });

    await waitFor(() => {
      expect(result.current.currentUserId).toBe('user1');
    });

    act(() => {
      result.current.setHouseholdFilter('all');
    });

    const items = [
      { id: '1', ownerId: 'user1', name: 'Item 1' },
      { id: '2', ownerId: 'user2', name: 'Item 2' },
      { id: '3', ownerId: 'user3', name: 'Item 3' },
    ];

    const filtered = result.current.filterByOwnership(items);

    expect(filtered).toHaveLength(3);
  });

  it('allows switching current user', async () => {
    const mockUsers: User[] = [
      {
        id: 'user1',
        name: 'User 1',
        color: '#3498db',
        isDefault: true,
        createdAt: new Date(),
      },
      {
        id: 'user2',
        name: 'User 2',
        color: '#e74c3c',
        isDefault: false,
        createdAt: new Date(),
      },
    ];

    mockApi.users.getAll = jest.fn().mockResolvedValue(mockUsers);
    mockApi.sharing.getSharedWithMe = jest.fn().mockResolvedValue([]);
    mockApi.security.getCurrentUser = jest.fn().mockResolvedValue('user1');

    const { result } = renderHook(() => useHousehold(), {
      wrapper: ({ children }) => <HouseholdProvider>{children}</HouseholdProvider>,
    });

    await waitFor(() => {
      expect(result.current.currentUserId).toBe('user1');
    });

    act(() => {
      result.current.setCurrentUserId('user2');
    });

    expect(result.current.currentUserId).toBe('user2');
    expect(result.current.householdFilter).toBe('user2');
  });
});
