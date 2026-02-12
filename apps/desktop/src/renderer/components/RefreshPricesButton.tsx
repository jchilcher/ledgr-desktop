import { useEffect, useState } from 'react';
import { useRefreshPrices } from '../hooks/useRefreshPrices';
import { useNetworkStatus, useCanRefresh } from '../hooks/useNetworkStatus';
import { OfflineIndicator } from './StalenessIndicator';

interface RefreshPricesButtonProps {
  /** Symbols to refresh */
  symbols: string[];
  /** Callback after successful refresh */
  onRefreshComplete?: () => void;
  /** Show compact button (icon only) */
  compact?: boolean;
}

/**
 * Button to refresh all portfolio prices with progress indicator.
 * Per CONTEXT.md: Manual refresh only, progress indicator ("3 of 12 holdings updated..."),
 * brief toast on success.
 */
export function RefreshPricesButton({
  symbols,
  onRefreshComplete,
  compact = false,
}: RefreshPricesButtonProps) {
  const { refresh, isRefreshing, progress, isSuccess, error, reset } = useRefreshPrices(symbols);
  const isOnline = useNetworkStatus();
  const canRefresh = useCanRefresh(isRefreshing);
  const [showToast, setShowToast] = useState(false);

  // Show success toast
  useEffect(() => {
    if (isSuccess) {
      setShowToast(true);
      onRefreshComplete?.();
      const timer = setTimeout(() => {
        setShowToast(false);
        reset();
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [isSuccess, onRefreshComplete, reset]);

  const handleClick = () => {
    if (canRefresh) {
      refresh();
    }
  };

  // Progress text
  const progressText = isRefreshing
    ? `${progress.completed} of ${progress.total} updated...`
    : null;

  // Error count
  const errorCount = progress.errors.length;

  if (!isOnline) {
    return (
      <div className="refresh-container">
        <button className="btn btn-secondary refresh-btn" disabled>
          {compact ? '🔄' : 'Refresh Prices'}
        </button>
        <OfflineIndicator />
      </div>
    );
  }

  return (
    <div className="refresh-container">
      <button
        className={`btn ${isRefreshing ? 'btn-secondary' : 'btn-primary'} refresh-btn`}
        onClick={handleClick}
        disabled={!canRefresh || symbols.length === 0}
      >
        {isRefreshing ? (
          <>
            <span className="refresh-spinner">⟳</span>
            {!compact && ' Refreshing...'}
          </>
        ) : (
          <>
            🔄
            {!compact && ' Refresh Prices'}
          </>
        )}
      </button>

      {/* Progress indicator */}
      {isRefreshing && progressText && (
        <div className="refresh-progress">
          <div className="refresh-progress-bar">
            <div
              className="refresh-progress-fill"
              style={{ width: `${(progress.completed / progress.total) * 100}%` }}
            />
          </div>
          <span className="refresh-progress-text">{progressText}</span>
        </div>
      )}

      {/* Success toast */}
      {showToast && (
        <div className="refresh-toast refresh-toast-success">
          ✓ Prices updated
          {errorCount > 0 && ` (${errorCount} failed)`}
        </div>
      )}

      {/* Error display */}
      {error && (
        <div className="refresh-toast refresh-toast-error">
          Failed to refresh prices: {error.message}
        </div>
      )}
    </div>
  );
}
