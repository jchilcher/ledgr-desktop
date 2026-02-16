import { renderHook, waitFor } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { createQueryClient, createMockApi, setupWindowApi, cleanupWindowApi } from '../helpers/render-helpers';
import { usePrices, usePrice, usePricesStaleness } from '../../hooks/usePrices';
import type { PriceCacheEntry } from '../../../shared/types';
import React from 'react';

const wrapper = ({ children }: { children: React.ReactNode }) => {
  const queryClient = createQueryClient();
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
};

describe('usePrices', () => {
  let mockApi: ReturnType<typeof createMockApi>;

  beforeEach(() => {
    mockApi = setupWindowApi();
  });

  afterEach(() => {
    cleanupWindowApi();
  });

  it('fetches prices for multiple symbols', async () => {
    const mockPrices: Record<string, PriceCacheEntry> = {
      AAPL: {
        symbol: 'AAPL',
        priceInCents: 15000,
        cachedAt: new Date(),
        source: 'yahoo',
      },
      MSFT: {
        symbol: 'MSFT',
        priceInCents: 30000,
        cachedAt: new Date(),
        source: 'yahoo',
      },
    };

    mockApi.prices.getCached = jest.fn().mockResolvedValue(mockPrices);
    mockApi.prices.get = jest.fn().mockImplementation(async (symbol: string) => mockPrices[symbol]);

    const { result } = renderHook(() => usePrices(['AAPL', 'MSFT']), { wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toBeDefined();
    expect(result.current.data?.AAPL).toEqual(mockPrices.AAPL);
    expect(result.current.data?.MSFT).toEqual(mockPrices.MSFT);
  });

  it('returns empty result when symbols array is empty', async () => {
    const { result } = renderHook(() => usePrices([]), { wrapper });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.data).toBeUndefined();
  });

  it('uses cache-only mode when specified', async () => {
    const mockCachedPrices: Record<string, PriceCacheEntry> = {
      AAPL: {
        symbol: 'AAPL',
        priceInCents: 15000,
        cachedAt: new Date(),
        source: 'yahoo',
      },
    };

    mockApi.prices.getCached = jest.fn().mockResolvedValue(mockCachedPrices);
    mockApi.prices.get = jest.fn();

    const { result } = renderHook(() => usePrices(['AAPL'], { cacheOnly: true }), { wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockApi.prices.getCached).toHaveBeenCalledWith(['AAPL']);
    expect(mockApi.prices.get).not.toHaveBeenCalled();
  });

  it('respects enabled option', async () => {
    mockApi.prices.getCached = jest.fn();
    mockApi.prices.get = jest.fn();

    const { result } = renderHook(() => usePrices(['AAPL'], { enabled: false }), { wrapper });

    expect(result.current.isLoading).toBe(false);
    expect(mockApi.prices.getCached).not.toHaveBeenCalled();
  });

  it('fetches missing symbols from cache', async () => {
    const cachedPrices: Record<string, PriceCacheEntry> = {
      AAPL: {
        symbol: 'AAPL',
        priceInCents: 15000,
        cachedAt: new Date(),
        source: 'yahoo',
      },
    };

    const msftPrice: PriceCacheEntry = {
      symbol: 'MSFT',
      priceInCents: 30000,
      cachedAt: new Date(),
      source: 'yahoo',
    };

    mockApi.prices.getCached = jest.fn().mockResolvedValue(cachedPrices);
    mockApi.prices.get = jest.fn().mockImplementation(async (symbol: string) => {
      if (symbol === 'MSFT') return msftPrice;
      return null;
    });

    const { result } = renderHook(() => usePrices(['AAPL', 'MSFT']), { wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockApi.prices.get).toHaveBeenCalledWith('AAPL');
    expect(mockApi.prices.get).toHaveBeenCalledWith('MSFT');
  });
});

describe('usePrice', () => {
  let mockApi: ReturnType<typeof createMockApi>;

  beforeEach(() => {
    mockApi = setupWindowApi();
  });

  afterEach(() => {
    cleanupWindowApi();
  });

  it('fetches price for single symbol', async () => {
    const mockPrice: PriceCacheEntry = {
      symbol: 'AAPL',
      priceInCents: 15000,
      cachedAt: new Date(),
      source: 'yahoo',
    };

    mockApi.prices.getCached = jest.fn().mockResolvedValue({ AAPL: mockPrice });
    mockApi.prices.get = jest.fn().mockResolvedValue(mockPrice);

    const { result } = renderHook(() => usePrice('AAPL'), { wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(mockPrice);
  });

  it('returns null for null symbol', async () => {
    const { result } = renderHook(() => usePrice(null), { wrapper });

    expect(result.current.data).toBe(null);
  });
});

describe('usePricesStaleness', () => {
  let mockApi: ReturnType<typeof createMockApi>;

  beforeEach(() => {
    mockApi = setupWindowApi();
  });

  afterEach(() => {
    cleanupWindowApi();
  });

  it('detects stale prices', async () => {
    mockApi.prices.isStale = jest.fn().mockImplementation(async (symbol: string) => {
      return symbol === 'AAPL';
    });

    const { result } = renderHook(() => usePricesStaleness(['AAPL', 'MSFT']), { wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual({
      hasStale: true,
      staleSymbols: ['AAPL'],
      staleCount: 1,
      totalCount: 2,
    });
  });

  it('returns no stale when all prices are fresh', async () => {
    mockApi.prices.isStale = jest.fn().mockResolvedValue(false);

    const { result } = renderHook(() => usePricesStaleness(['AAPL', 'MSFT']), { wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual({
      hasStale: false,
      staleSymbols: [],
      staleCount: 0,
      totalCount: 2,
    });
  });

  it('handles empty symbols array', async () => {
    mockApi.prices.isStale = jest.fn();

    const { result } = renderHook(() => usePricesStaleness([]), { wrapper });

    expect(result.current.isLoading).toBe(false);
    expect(mockApi.prices.isStale).not.toHaveBeenCalled();
  });
});
