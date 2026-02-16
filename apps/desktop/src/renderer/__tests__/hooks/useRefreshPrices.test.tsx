import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { createQueryClient, createMockApi, setupWindowApi, cleanupWindowApi } from '../helpers/render-helpers';
import { useRefreshPrices, useSetManualPrice, useClearManualPrice } from '../../hooks/useRefreshPrices';
import type { PriceCacheEntry } from '../../../shared/types';
import React from 'react';

const wrapper = ({ children }: { children: React.ReactNode }) => {
  const queryClient = createQueryClient();
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
};

describe('useRefreshPrices', () => {
  let mockApi: ReturnType<typeof createMockApi>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let progressCallback: ((p: any) => void) | null = null;

  beforeEach(() => {
    mockApi = setupWindowApi();
    progressCallback = null;

    mockApi.prices.onProgress = jest.fn((callback) => {
      progressCallback = callback;
      return () => {
        progressCallback = null;
      };
    });
  });

  afterEach(() => {
    cleanupWindowApi();
  });

  it('fetches batch of prices', async () => {
    const mockResult = {
      results: [
        {
          symbol: 'AAPL',
          priceInCents: 15000,
          cachedAt: new Date(),
          source: 'yahoo',
        },
      ] as PriceCacheEntry[],
      errors: [],
    };

    mockApi.prices.fetchBatch = jest.fn().mockResolvedValue(mockResult);

    const { result } = renderHook(() => useRefreshPrices(['AAPL', 'MSFT']), { wrapper });

    await act(async () => {
      result.current.refresh();
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockApi.prices.fetchBatch).toHaveBeenCalledWith(['AAPL', 'MSFT']);
    expect(result.current.isRefreshing).toBe(false);
  });

  it('tracks progress during refresh', async () => {
    const mockResult = {
      results: [] as PriceCacheEntry[],
      errors: [],
    };

    mockApi.prices.fetchBatch = jest.fn().mockResolvedValue(mockResult);

    const { result } = renderHook(() => useRefreshPrices(['AAPL', 'MSFT']), { wrapper });

    await act(async () => {
      result.current.refresh();
    });

    expect(result.current.progress.total).toBe(2);
    expect(result.current.progress.completed).toBe(0);

    if (progressCallback) {
      act(() => {
        progressCallback!({ completed: 1, total: 2, currentSymbol: 'AAPL', errors: [] });
      });
    }

    await waitFor(() => {
      expect(result.current.progress.completed).toBe(1);
    });

    expect(result.current.progress.currentSymbol).toBe('AAPL');
  });

  it('handles fetch errors', async () => {
    const mockResult = {
      results: [] as PriceCacheEntry[],
      errors: [
        { symbol: 'INVALID', error: 'Symbol not found' },
      ],
    };

    mockApi.prices.fetchBatch = jest.fn().mockResolvedValue(mockResult);

    const { result } = renderHook(() => useRefreshPrices(['INVALID']), { wrapper });

    await act(async () => {
      result.current.refresh();
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.progress.errors).toEqual([
      { symbol: 'INVALID', error: 'Symbol not found' },
    ]);
  });

  it('resets progress on new refresh', async () => {
    const mockResult = {
      results: [] as PriceCacheEntry[],
      errors: [],
    };

    mockApi.prices.fetchBatch = jest.fn().mockResolvedValue(mockResult);

    const { result } = renderHook(() => useRefreshPrices(['AAPL']), { wrapper });

    await act(async () => {
      result.current.refresh();
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    await act(async () => {
      result.current.refresh();
    });

    expect(result.current.progress.completed).toBe(0);
    expect(result.current.progress.total).toBe(1);
  });

  it('cleans up progress listener on unmount', async () => {
    const unsubscribeMock = jest.fn();
    mockApi.prices.onProgress = jest.fn().mockReturnValue(unsubscribeMock);

    const { unmount } = renderHook(() => useRefreshPrices(['AAPL']), { wrapper });

    unmount();

    expect(unsubscribeMock).toHaveBeenCalled();
  });
});

describe('useSetManualPrice', () => {
  let mockApi: ReturnType<typeof createMockApi>;

  beforeEach(() => {
    mockApi = setupWindowApi();
  });

  afterEach(() => {
    cleanupWindowApi();
  });

  it('sets manual price override', async () => {
    mockApi.prices.setManual = jest.fn().mockResolvedValue(undefined);

    const { result } = renderHook(() => useSetManualPrice(), { wrapper });

    await act(async () => {
      result.current.mutate({ symbol: 'CUSTOM', priceInCents: 5000 });
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockApi.prices.setManual).toHaveBeenCalledWith('CUSTOM', 5000);
  });
});

describe('useClearManualPrice', () => {
  let mockApi: ReturnType<typeof createMockApi>;

  beforeEach(() => {
    mockApi = setupWindowApi();
  });

  afterEach(() => {
    cleanupWindowApi();
  });

  it('clears manual price override', async () => {
    mockApi.prices.clearManual = jest.fn().mockResolvedValue(undefined);

    const { result } = renderHook(() => useClearManualPrice(), { wrapper });

    await act(async () => {
      result.current.mutate('CUSTOM');
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockApi.prices.clearManual).toHaveBeenCalledWith('CUSTOM');
  });
});
