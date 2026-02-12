import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect, useCallback } from 'react';
import type { PriceCacheEntry, PriceFetchProgress } from '../../shared/types';

interface RefreshResult {
  results: PriceCacheEntry[];
  errors: Array<{ symbol: string; error: string }>;
}

/**
 * Hook for manually refreshing prices with progress tracking.
 */
export function useRefreshPrices(symbols: string[]) {
  const queryClient = useQueryClient();
  const [progress, setProgress] = useState<PriceFetchProgress>({
    completed: 0,
    total: 0,
    currentSymbol: '',
    errors: [],
  });

  // Subscribe to progress events from main process
  useEffect(() => {
    const unsubscribe = window.api.prices.onProgress((p) => {
      setProgress(prev => ({
        ...prev,
        completed: p.completed,
        total: p.total,
        currentSymbol: p.currentSymbol,
      }));
    });

    return unsubscribe;
  }, []);

  const mutation = useMutation<RefreshResult, Error, void>({
    mutationFn: async () => {
      // Reset progress
      setProgress({
        completed: 0,
        total: symbols.length,
        currentSymbol: '',
        errors: [],
      });

      // Fetch all prices (skipManual: true by default)
      const result = await window.api.prices.fetchBatch(symbols);

      // Update progress with errors
      setProgress(prev => ({
        ...prev,
        completed: symbols.length,
        currentSymbol: '',
        errors: result.errors,
      }));

      return result;
    },
    onSuccess: () => {
      // Invalidate price queries to trigger re-render with new data
      queryClient.invalidateQueries({ queryKey: ['prices'] });
      queryClient.invalidateQueries({ queryKey: ['prices-staleness'] });
    },
  });

  const refresh = useCallback(() => {
    mutation.mutate();
  }, [mutation]);

  return {
    refresh,
    isRefreshing: mutation.isPending,
    progress,
    error: mutation.error,
    isSuccess: mutation.isSuccess,
    reset: mutation.reset,
  };
}

/**
 * Hook to set a manual price override.
 */
export function useSetManualPrice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ symbol, priceInCents }: { symbol: string; priceInCents: number }) => {
      return window.api.prices.setManual(symbol, priceInCents);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prices'] });
    },
  });
}

/**
 * Hook to clear a manual price override.
 */
export function useClearManualPrice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (symbol: string) => {
      return window.api.prices.clearManual(symbol);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prices'] });
    },
  });
}
