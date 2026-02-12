import { useState, useEffect } from 'react';
import { useSetManualPrice, useClearManualPrice } from '../hooks/useRefreshPrices';

interface ManualPriceModalProps {
  /** Symbol to set price for */
  symbol: string;
  /** Current price in cents (if any) */
  currentPrice?: number | null;
  /** Whether current price is manual */
  isManual?: boolean;
  /** Callback when modal closes */
  onClose: () => void;
  /** Callback after price is set */
  onPriceSet?: (priceInCents: number) => void;
}

/**
 * Modal for entering manual price override.
 * Per CONTEXT.md: Available on API failure (prompted) and anytime from holding menu.
 * Manual prices lock until user explicitly clears them.
 */
export function ManualPriceModal({
  symbol,
  currentPrice,
  isManual = false,
  onClose,
  onPriceSet,
}: ManualPriceModalProps) {
  const setManualPrice = useSetManualPrice();
  const clearManualPrice = useClearManualPrice();

  // Initialize with current price in dollars
  const initialPrice = currentPrice ? (currentPrice / 100).toFixed(2) : '';
  const [priceInput, setPriceInput] = useState(initialPrice);
  const [error, setError] = useState<string | null>(null);

  // Focus input on mount
  useEffect(() => {
    const input = document.getElementById('manual-price-input');
    input?.focus();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const priceValue = parseFloat(priceInput);
    if (isNaN(priceValue) || priceValue < 0) {
      setError('Please enter a valid price');
      return;
    }

    const priceInCents = Math.round(priceValue * 100);

    try {
      await setManualPrice.mutateAsync({ symbol, priceInCents });
      onPriceSet?.(priceInCents);
      onClose();
    } catch (err) {
      setError('Failed to save price');
    }
  };

  const handleClear = async () => {
    try {
      await clearManualPrice.mutateAsync(symbol);
      onClose();
    } catch (err) {
      setError('Failed to clear manual price');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose} onKeyDown={handleKeyDown}>
      <div className="modal manual-price-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Set Price for {symbol}</h3>
          <button className="modal-close" onClick={onClose}>x</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="manual-price-input">Price per Share</label>
            <div className="price-input-wrapper">
              <span className="price-input-prefix">$</span>
              <input
                id="manual-price-input"
                type="number"
                step="0.01"
                min="0"
                value={priceInput}
                onChange={e => setPriceInput(e.target.value)}
                placeholder="0.00"
                className="price-input"
              />
            </div>
            {error && <span className="form-error">{error}</span>}
          </div>

          <p className="manual-price-info">
            <strong>Note:</strong> Manual prices will not be updated during refresh until you clear them.
          </p>

          <div className="modal-actions">
            {isManual && (
              <button
                type="button"
                className="btn btn-danger"
                onClick={handleClear}
                disabled={clearManualPrice.isPending}
              >
                Clear Manual Price
              </button>
            )}
            <div className="modal-actions-right">
              <button type="button" className="btn btn-secondary" onClick={onClose}>
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={setManualPrice.isPending}
              >
                {setManualPrice.isPending ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
