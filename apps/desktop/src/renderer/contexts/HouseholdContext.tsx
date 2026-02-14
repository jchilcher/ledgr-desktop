import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import type { User, HouseholdFilter, DataShare } from '../../shared/types';

interface HouseholdContextValue {
  currentUserId: string | null;
  setCurrentUserId: (id: string) => void;
  householdFilter: HouseholdFilter;
  setHouseholdFilter: (f: HouseholdFilter) => void;
  users: User[];
  refreshUsers: () => Promise<void>;
  filterByOwnership: <T extends { ownerId?: string | null; id?: string }>(items: T[]) => T[];
}

const HouseholdContext = createContext<HouseholdContextValue | undefined>(undefined);

interface HouseholdProviderProps {
  children: React.ReactNode;
}

export const HouseholdProvider: React.FC<HouseholdProviderProps> = ({ children }) => {
  const [currentUserId, setCurrentUserIdState] = useState<string | null>(null);
  const [householdFilter, setHouseholdFilter] = useState<HouseholdFilter>('all');
  const [users, setUsers] = useState<User[]>([]);
  const [sharedEntityIds, setSharedEntityIds] = useState<Set<string>>(new Set());

  const refreshUsers = useCallback(async () => {
    try {
      const allUsers = await window.api.users.getAll();
      setUsers(allUsers);
    } catch {
      // Users table may not exist yet on first run
    }
  }, []);

  // Load users on mount
  useEffect(() => {
    refreshUsers();
  }, [refreshUsers]);

  // When there's only one user, set them as current automatically
  useEffect(() => {
    if (users.length === 1 && !currentUserId) {
      setCurrentUserIdState(users[0].id);
      setHouseholdFilter(users[0].id);
    }
  }, [users, currentUserId]);

  // Load shared entity IDs for current user
  useEffect(() => {
    if (!currentUserId) {
      setSharedEntityIds(new Set());
      return;
    }
    (async () => {
      try {
        const shares: DataShare[] = await window.api.sharing.getSharedWithMe();
        setSharedEntityIds(new Set(shares.map(s => s.entityId)));
      } catch {
        // Sharing API may not be available yet
      }
    })();
  }, [currentUserId]);

  const setCurrentUserId = useCallback((id: string) => {
    setCurrentUserIdState(id);
    setHouseholdFilter(id);
  }, []);

  const filterByOwnership = useCallback(<T extends { ownerId?: string | null; id?: string }>(items: T[]): T[] => {
    if (householdFilter === 'all') return items;
    return items.filter(item => {
      // Include items owned by the filtered user
      if (!item.ownerId || item.ownerId === householdFilter) return true;
      // Include items shared with the current user
      if (item.id && sharedEntityIds.has(item.id)) return true;
      return false;
    });
  }, [householdFilter, sharedEntityIds]);

  const value = useMemo(() => ({
    currentUserId,
    setCurrentUserId,
    householdFilter,
    setHouseholdFilter,
    users,
    refreshUsers,
    filterByOwnership,
  }), [currentUserId, setCurrentUserId, householdFilter, users, refreshUsers, filterByOwnership]);

  return (
    <HouseholdContext.Provider value={value}>
      {children}
    </HouseholdContext.Provider>
  );
};

export function useHousehold(): HouseholdContextValue {
  const context = useContext(HouseholdContext);
  if (context === undefined) {
    throw new Error('useHousehold must be used within a HouseholdProvider');
  }
  return context;
}
