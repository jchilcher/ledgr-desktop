import { useState, useEffect, useCallback } from 'react';
import type {
  NetWorthCalculation,
  NetWorthProjectionConfig,
  NetWorthForecast,
  NetWorthChangeSummary,
} from '@ledgr/core';
import type {
  ManualAsset,
  ManualLiability,
  NetWorthSnapshot,
} from '../../shared/types';

// Hook for current net worth calculation
export function useNetWorthCalculation() {
  const [calculation, setCalculation] = useState<NetWorthCalculation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async (createSnapshot = false) => {
    try {
      setLoading(true);
      setError(null);
      const result = await window.api.netWorthCalc.calculate();
      setCalculation(result);

      // Create snapshot if requested
      if (createSnapshot) {
        await window.api.netWorthCalc.forceSnapshot();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to calculate net worth');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refetch(true); // Create snapshot on initial load
  }, [refetch]);

  return { calculation, loading, error, refetch };
}

// Hook for net worth snapshots history
export function useNetWorthHistory(limit?: number) {
  const [snapshots, setSnapshots] = useState<NetWorthSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await window.api.netWorthSnapshots.getSnapshots(limit);
      setSnapshots(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load history');
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { snapshots, loading, error, refetch };
}

// Hook for snapshots within date range
export function useNetWorthHistoryRange(startDate: Date, endDate: Date) {
  const [snapshots, setSnapshots] = useState<NetWorthSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchSnapshots() {
      try {
        setLoading(true);
        setError(null);
        const result = await window.api.netWorthSnapshots.getSnapshotsByRange(
          startDate.getTime(),
          endDate.getTime()
        );
        setSnapshots(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load history');
      } finally {
        setLoading(false);
      }
    }
    fetchSnapshots();
  }, [startDate.getTime(), endDate.getTime()]);

  return { snapshots, loading, error };
}

// Hook for projections
export function useNetWorthProjections(config: NetWorthProjectionConfig) {
  const [projections, setProjections] = useState<NetWorthForecast | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await window.api.netWorthCalc.getProjections(config);
      setProjections(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate projections');
    } finally {
      setLoading(false);
    }
  }, [JSON.stringify(config)]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { projections, loading, error, refetch };
}

// Hook for change summary
export function useNetWorthChangeSummary(period: 'day' | 'week' | 'month' | 'year') {
  const [summary, setSummary] = useState<NetWorthChangeSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchSummary() {
      try {
        setLoading(true);
        setError(null);

        const now = Date.now();
        let startDate: number;

        switch (period) {
          case 'day':
            startDate = now - (24 * 60 * 60 * 1000);
            break;
          case 'week':
            startDate = now - (7 * 24 * 60 * 60 * 1000);
            break;
          case 'month':
            startDate = now - (30 * 24 * 60 * 60 * 1000);
            break;
          case 'year':
            startDate = now - (365 * 24 * 60 * 60 * 1000);
            break;
        }

        const result = await window.api.netWorthCalc.getChangeSummary(startDate, now);
        setSummary(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load summary');
      } finally {
        setLoading(false);
      }
    }
    fetchSummary();
  }, [period]);

  return { summary, loading, error };
}

// Hook for manual assets
export function useManualAssets() {
  const [assets, setAssets] = useState<ManualAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await window.api.manualAssets.getAll();
      setAssets(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load assets');
    } finally {
      setLoading(false);
    }
  }, []);

  const createAsset = useCallback(async (
    asset: Omit<ManualAsset, 'id' | 'createdAt' | 'lastUpdated'>
  ) => {
    const result = await window.api.manualAssets.create(asset);
    await refetch();
    return result;
  }, [refetch]);

  const updateAsset = useCallback(async (
    id: string,
    updates: Partial<Omit<ManualAsset, 'id' | 'createdAt'>>
  ) => {
    const result = await window.api.manualAssets.update(id, updates);
    await refetch();
    return result;
  }, [refetch]);

  const deleteAsset = useCallback(async (id: string) => {
    await window.api.manualAssets.delete(id);
    await refetch();
  }, [refetch]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { assets, loading, error, refetch, createAsset, updateAsset, deleteAsset };
}

// Hook for manual liabilities
export function useManualLiabilities() {
  const [liabilities, setLiabilities] = useState<ManualLiability[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await window.api.manualLiabilities.getAll();
      setLiabilities(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load liabilities');
    } finally {
      setLoading(false);
    }
  }, []);

  const createLiability = useCallback(async (
    liability: Omit<ManualLiability, 'id' | 'createdAt' | 'lastUpdated'>
  ) => {
    const result = await window.api.manualLiabilities.create(liability);
    await refetch();
    return result;
  }, [refetch]);

  const updateLiability = useCallback(async (
    id: string,
    updates: Partial<Omit<ManualLiability, 'id' | 'createdAt'>>
  ) => {
    const result = await window.api.manualLiabilities.update(id, updates);
    await refetch();
    return result;
  }, [refetch]);

  const deleteLiability = useCallback(async (id: string) => {
    await window.api.manualLiabilities.delete(id);
    await refetch();
  }, [refetch]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { liabilities, loading, error, refetch, createLiability, updateLiability, deleteLiability };
}

// Export default for convenience
export default useNetWorthCalculation;
