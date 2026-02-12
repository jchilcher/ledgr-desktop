import { useQuery } from '@tanstack/react-query';
import type { PriceCacheEntry } from '../../shared/types';

interface UsePricesOptions {
  /** Skip fetching and use only cached data */
  cacheOnly?: boolean;
  /** Enable the query (default: true) */
  enabled?: boolean;
}

/**
 * Hook to get prices for multiple symbols.
 * Uses TanStack Query for caching with 15-minute staleTime.
 */
export function usePrices(symbols: string[], options: UsePricesOptions = {}) {
  const { cacheOnly = false, enabled = true } = options;

  return useQuery({
    queryKey: ['prices', symbols.sort()],
    queryFn: async (): Promise<Record<string, PriceCacheEntry>> => {
      if (cacheOnly || symbols.length === 0) {
        // Just get cached prices, no API call
        return window.api.prices.getCached(symbols);
      }

      // Fetch via IPC - this will use cache when fresh
      const cached = await window.api.prices.getCached(symbols);
      const result: Record<string, PriceCacheEntry> = { ...cached };

      // Fetch any missing or stale symbols
      for (const symbol of symbols) {
        const entry = await window.api.prices.get(symbol);
        if (entry) {
          result[symbol.toUpperCase()] = entry;
        }
      }

      return result;
    },
    enabled: enabled && symbols.length > 0,
  });
}

/**
 * Hook to get price for a single symbol.
 */
export function usePrice(symbol: string | null, options: UsePricesOptions = {}) {
  const symbols = symbol ? [symbol] : [];
  const query = usePrices(symbols, options);

  const price = symbol && query.data ? query.data[symbol.toUpperCase()] : null;

  return {
    ...query,
    data: price,
  };
}

/**
 * Hook to check if any prices in the list are stale.
 */
export function usePricesStaleness(symbols: string[]) {
  return useQuery({
    queryKey: ['prices-staleness', symbols.sort()],
    queryFn: async () => {
      const staleSymbols: string[] = [];
      for (const symbol of symbols) {
        if (await window.api.prices.isStale(symbol)) {
          staleSymbols.push(symbol);
        }
      }
      return {
        hasStale: staleSymbols.length > 0,
        staleSymbols,
        staleCount: staleSymbols.length,
        totalCount: symbols.length,
      };
    },
    enabled: symbols.length > 0,
    // Check staleness more frequently
    staleTime: 60 * 1000, // 1 minute
  });
}
