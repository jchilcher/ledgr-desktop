import { renderHook, waitFor } from '@testing-library/react';
import { createMockApi, setupWindowApi, cleanupWindowApi } from '../helpers/render-helpers';
import {
  useNetWorthCalculation,
  useNetWorthHistory,
  useNetWorthHistoryRange,
  useNetWorthProjections,
  useManualAssets,
  useManualLiabilities,
} from '../../hooks/useNetWorth';
import type { NetWorthCalculation, NetWorthProjectionConfig } from '@ledgr/core';
import type { NetWorthSnapshot, ManualAsset, ManualLiability } from '../../../shared/types';

describe('useNetWorthCalculation', () => {
  let mockApi: ReturnType<typeof createMockApi>;

  beforeEach(() => {
    mockApi = setupWindowApi();
  });

  afterEach(() => {
    cleanupWindowApi();
  });

  it('fetches net worth data on mount', async () => {
    const mockCalculation: NetWorthCalculation = {
      totalAssets: 100000,
      totalLiabilities: 50000,
      netWorth: 50000,
      bankAccounts: { total: 30000, accounts: [] },
      investments: { total: 70000, accounts: [] },
      manualAssets: { total: 0, assets: [] },
      manualLiabilities: { total: 50000, liabilities: [] },
    };

    mockApi.netWorthCalc.calculate = jest.fn().mockResolvedValue(mockCalculation);
    mockApi.netWorthCalc.forceSnapshot = jest.fn().mockResolvedValue({} as NetWorthSnapshot);

    const { result } = renderHook(() => useNetWorthCalculation());

    expect(result.current.loading).toBe(true);
    expect(result.current.calculation).toBe(null);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.calculation).toEqual(mockCalculation);
    expect(result.current.error).toBe(null);
    expect(mockApi.netWorthCalc.calculate).toHaveBeenCalled();
    expect(mockApi.netWorthCalc.forceSnapshot).toHaveBeenCalled();
  });

  it('handles error state', async () => {
    mockApi.netWorthCalc.calculate = jest.fn().mockRejectedValue(new Error('Calculation failed'));

    const { result } = renderHook(() => useNetWorthCalculation());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.calculation).toBe(null);
    expect(result.current.error).toBe('Calculation failed');
  });

  it('handles empty data', async () => {
    const emptyCalculation: NetWorthCalculation = {
      totalAssets: 0,
      totalLiabilities: 0,
      netWorth: 0,
      bankAccounts: { total: 0, accounts: [] },
      investments: { total: 0, accounts: [] },
      manualAssets: { total: 0, assets: [] },
      manualLiabilities: { total: 0, liabilities: [] },
    };

    mockApi.netWorthCalc.calculate = jest.fn().mockResolvedValue(emptyCalculation);
    mockApi.netWorthCalc.forceSnapshot = jest.fn().mockResolvedValue({} as NetWorthSnapshot);

    const { result } = renderHook(() => useNetWorthCalculation());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.calculation).toEqual(emptyCalculation);
    expect(result.current.calculation?.netWorth).toBe(0);
  });

  it('creates snapshot on refetch when requested', async () => {
    const mockCalculation: NetWorthCalculation = {
      totalAssets: 100000,
      totalLiabilities: 50000,
      netWorth: 50000,
      bankAccounts: { total: 30000, accounts: [] },
      investments: { total: 70000, accounts: [] },
      manualAssets: { total: 0, assets: [] },
      manualLiabilities: { total: 50000, liabilities: [] },
    };

    mockApi.netWorthCalc.calculate = jest.fn().mockResolvedValue(mockCalculation);
    mockApi.netWorthCalc.forceSnapshot = jest.fn().mockResolvedValue({} as NetWorthSnapshot);

    const { result } = renderHook(() => useNetWorthCalculation());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    jest.clearAllMocks();

    await result.current.refetch(true);

    expect(mockApi.netWorthCalc.forceSnapshot).toHaveBeenCalled();
  });
});

describe('useNetWorthHistory', () => {
  let mockApi: ReturnType<typeof createMockApi>;

  beforeEach(() => {
    mockApi = setupWindowApi();
  });

  afterEach(() => {
    cleanupWindowApi();
  });

  it('fetches snapshots on mount', async () => {
    const mockSnapshots: NetWorthSnapshot[] = [
      {
        id: '1',
        totalAssets: 100000,
        totalLiabilities: 50000,
        netWorth: 50000,
        createdAt: new Date('2026-01-01'),
      },
    ];

    mockApi.netWorthSnapshots.getSnapshots = jest.fn().mockResolvedValue(mockSnapshots);

    const { result } = renderHook(() => useNetWorthHistory());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.snapshots).toEqual(mockSnapshots);
    expect(mockApi.netWorthSnapshots.getSnapshots).toHaveBeenCalledWith(undefined);
  });

  it('respects limit parameter', async () => {
    mockApi.netWorthSnapshots.getSnapshots = jest.fn().mockResolvedValue([]);

    const { result } = renderHook(() => useNetWorthHistory(10));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(mockApi.netWorthSnapshots.getSnapshots).toHaveBeenCalledWith(10);
  });

  it('handles errors', async () => {
    mockApi.netWorthSnapshots.getSnapshots = jest.fn().mockRejectedValue(new Error('Load failed'));

    const { result } = renderHook(() => useNetWorthHistory());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBe('Load failed');
    expect(result.current.snapshots).toEqual([]);
  });
});

describe('useNetWorthHistoryRange', () => {
  let mockApi: ReturnType<typeof createMockApi>;

  beforeEach(() => {
    mockApi = setupWindowApi();
  });

  afterEach(() => {
    cleanupWindowApi();
  });

  it('fetches snapshots by date range', async () => {
    const startDate = new Date('2026-01-01');
    const endDate = new Date('2026-01-31');
    const mockSnapshots: NetWorthSnapshot[] = [
      {
        id: '1',
        totalAssets: 100000,
        totalLiabilities: 50000,
        netWorth: 50000,
        createdAt: new Date('2026-01-15'),
      },
    ];

    mockApi.netWorthSnapshots.getSnapshotsByRange = jest.fn().mockResolvedValue(mockSnapshots);

    const { result } = renderHook(() => useNetWorthHistoryRange(startDate, endDate));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.snapshots).toEqual(mockSnapshots);
    expect(mockApi.netWorthSnapshots.getSnapshotsByRange).toHaveBeenCalledWith(
      startDate.getTime(),
      endDate.getTime()
    );
  });
});

describe('useNetWorthProjections', () => {
  let mockApi: ReturnType<typeof createMockApi>;

  beforeEach(() => {
    mockApi = setupWindowApi();
  });

  afterEach(() => {
    cleanupWindowApi();
  });

  it('fetches projections based on config', async () => {
    const config: NetWorthProjectionConfig = {
      periodMonths: 12,
      includeInvestmentGrowth: true,
      annualReturnPercent: 7,
    };

    const mockForecast = {
      periods: [],
      summary: {
        currentNetWorth: 50000,
        projectedNetWorth: 60000,
        totalGrowth: 10000,
        growthPercent: 20,
      },
    };

    mockApi.netWorthCalc.getProjections = jest.fn().mockResolvedValue(mockForecast);

    const { result } = renderHook(() => useNetWorthProjections(config));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.projections).toEqual(mockForecast);
    expect(mockApi.netWorthCalc.getProjections).toHaveBeenCalledWith(config);
  });
});

describe('useManualAssets', () => {
  let mockApi: ReturnType<typeof createMockApi>;

  beforeEach(() => {
    mockApi = setupWindowApi();
  });

  afterEach(() => {
    cleanupWindowApi();
  });

  it('fetches manual assets on mount', async () => {
    const mockAssets: ManualAsset[] = [
      {
        id: '1',
        name: 'House',
        currentValue: 500000,
        assetType: 'real_estate',
        ownerId: 'user1',
        createdAt: new Date(),
        lastUpdated: new Date(),
      },
    ];

    mockApi.manualAssets.getAll = jest.fn().mockResolvedValue(mockAssets);

    const { result } = renderHook(() => useManualAssets());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.assets).toEqual(mockAssets);
  });

  it('creates asset and refetches', async () => {
    mockApi.manualAssets.getAll = jest.fn().mockResolvedValue([]);
    mockApi.manualAssets.create = jest.fn().mockResolvedValue({ id: '1' });

    const { result } = renderHook(() => useManualAssets());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    const newAsset = {
      name: 'Car',
      currentValue: 30000,
      assetType: 'vehicle' as const,
      ownerId: 'user1',
    };

    await result.current.createAsset(newAsset);

    expect(mockApi.manualAssets.create).toHaveBeenCalledWith(newAsset);
    expect(mockApi.manualAssets.getAll).toHaveBeenCalledTimes(2);
  });
});

describe('useManualLiabilities', () => {
  let mockApi: ReturnType<typeof createMockApi>;

  beforeEach(() => {
    mockApi = setupWindowApi();
  });

  afterEach(() => {
    cleanupWindowApi();
  });

  it('fetches manual liabilities on mount', async () => {
    const mockLiabilities: ManualLiability[] = [
      {
        id: '1',
        name: 'Mortgage',
        currentBalance: 400000,
        liabilityType: 'mortgage',
        ownerId: 'user1',
        createdAt: new Date(),
        lastUpdated: new Date(),
      },
    ];

    mockApi.manualLiabilities.getAll = jest.fn().mockResolvedValue(mockLiabilities);

    const { result } = renderHook(() => useManualLiabilities());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.liabilities).toEqual(mockLiabilities);
  });
});
