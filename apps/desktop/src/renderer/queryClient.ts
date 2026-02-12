import { QueryClient } from '@tanstack/react-query';

// Configure query client with price-specific defaults
// 15-minute staleTime matches our price cache TTL
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Data is fresh for 15 minutes
      staleTime: 15 * 60 * 1000,

      // Keep unused data in memory for 1 hour
      gcTime: 60 * 60 * 1000,

      // Don't retry - main process handles retries via exponential backoff
      retry: false,

      // Manual refresh only per CONTEXT.md requirements
      refetchOnWindowFocus: false,
      refetchOnMount: false,
      refetchOnReconnect: false,
      refetchInterval: false,
    },
    mutations: {
      retry: false,
    },
  },
});
