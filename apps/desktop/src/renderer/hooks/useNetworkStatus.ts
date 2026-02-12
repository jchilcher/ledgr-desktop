import { useSyncExternalStore } from 'react';

/**
 * Subscribe to browser online/offline events.
 */
function subscribe(callback: () => void) {
  window.addEventListener('online', callback);
  window.addEventListener('offline', callback);
  return () => {
    window.removeEventListener('online', callback);
    window.removeEventListener('offline', callback);
  };
}

function getSnapshot() {
  return navigator.onLine;
}

function getServerSnapshot() {
  return true; // Assume online during SSR (not applicable for Electron but good practice)
}

/**
 * Hook to detect online/offline network status.
 * Uses useSyncExternalStore for proper React 18 compatibility.
 */
export function useNetworkStatus() {
  const isOnline = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return isOnline;
}

/**
 * Hook that combines network status with price refresh capability.
 * Returns whether refresh is available (online and not already refreshing).
 */
export function useCanRefresh(isRefreshing: boolean) {
  const isOnline = useNetworkStatus();
  return isOnline && !isRefreshing;
}
