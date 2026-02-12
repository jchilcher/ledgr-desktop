import { formatDistance } from 'date-fns';

interface StalenessIndicatorProps {
  /** Unix timestamp of last price update */
  timestamp: number | null;
  /** Threshold for showing stale warning (ms), default 1 hour */
  staleThreshold?: number;
  /** Show detailed timestamp on hover */
  showTooltip?: boolean;
}

const DEFAULT_STALE_THRESHOLD = 60 * 60 * 1000; // 1 hour

/**
 * Displays relative time with stale warning.
 * Per CONTEXT.md: relative time ("5 minutes ago") with exact time on hover,
 * yellow/orange badge when stale (>1 hour).
 */
export function StalenessIndicator({
  timestamp,
  staleThreshold = DEFAULT_STALE_THRESHOLD,
  showTooltip = true,
}: StalenessIndicatorProps) {
  if (!timestamp) {
    return <span className="staleness-indicator staleness-unknown">No price data</span>;
  }

  const now = Date.now();
  const age = now - timestamp;
  const isStale = age > staleThreshold;

  // Format relative time using date-fns
  const relativeTime = formatDistance(timestamp, now, {
    addSuffix: true,
    includeSeconds: true,
  });

  // Format exact time for tooltip
  const exactTime = new Date(timestamp).toLocaleString();

  return (
    <span
      className={`staleness-indicator ${isStale ? 'staleness-stale' : 'staleness-fresh'}`}
      title={showTooltip ? `Updated: ${exactTime}` : undefined}
    >
      {relativeTime}
      {isStale && <span className="staleness-badge">Stale</span>}
    </span>
  );
}

/**
 * Offline indicator badge.
 */
export function OfflineIndicator() {
  return (
    <span className="offline-indicator">
      <span className="offline-badge">Offline</span>
      <span className="offline-text">Showing cached prices</span>
    </span>
  );
}
