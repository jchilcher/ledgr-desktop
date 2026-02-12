interface PriceDisplayProps {
  /** Current price in cents */
  price: number | null;
  /** Cost basis in cents (for gain/loss calculation) */
  costBasis?: number | null;
  /** Number of shares (for total value/gain) */
  shares?: number;
  /** Whether this is a manually entered price */
  isManual?: boolean;
  /** Callback when pencil icon clicked */
  onEditClick?: () => void;
  /** Show compact display (just price) */
  compact?: boolean;
}

/**
 * Displays price with optional gain/loss.
 * Uses blue for gains, orange for losses (colorblind-friendly per CONTEXT.md).
 */
export function PriceDisplay({
  price,
  costBasis,
  shares = 1,
  isManual = false,
  onEditClick,
  compact = false,
}: PriceDisplayProps) {
  // Handle missing price
  if (price === null || price === undefined) {
    return (
      <span className="price-display price-missing">
        <span className="price-value">—</span>
        {onEditClick && (
          <button
            className="price-edit-btn"
            onClick={(e) => {
              e.stopPropagation();
              onEditClick();
            }}
            title="Enter price manually"
          >
            ✏️
          </button>
        )}
      </span>
    );
  }

  // Calculate values
  const priceInDollars = price / 100;
  const totalValue = (price * shares) / 100;

  // Calculate gain/loss if cost basis provided
  let gainLoss: number | null = null;
  let gainLossPercent: number | null = null;

  if (costBasis !== null && costBasis !== undefined && costBasis > 0) {
    const totalCost = (costBasis * shares) / 100;
    gainLoss = totalValue - totalCost;
    gainLossPercent = ((totalValue - totalCost) / totalCost) * 100;
  }

  const isPositive = gainLoss !== null && gainLoss >= 0;
  const gainLossClass = gainLoss !== null
    ? isPositive ? 'gain-positive' : 'gain-negative'
    : '';

  // Format currency
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  // Format percentage
  const formatPercent = (value: number) => {
    const sign = value >= 0 ? '+' : '';
    return `${sign}${value.toFixed(2)}%`;
  };

  if (compact) {
    return (
      <span className="price-display price-compact">
        <span className="price-value">{formatCurrency(priceInDollars)}</span>
        {isManual && <span className="price-manual-icon" title="Manually entered price">✏️</span>}
      </span>
    );
  }

  return (
    <span className="price-display">
      <span className="price-value">{formatCurrency(totalValue)}</span>
      {gainLoss !== null && (
        <span className={`price-gain-loss ${gainLossClass}`}>
          {isPositive ? '+' : '-'}{formatCurrency(Math.abs(gainLoss))}
          {' '}
          ({formatPercent(gainLossPercent!)})
        </span>
      )}
      {isManual && (
        <button
          className="price-edit-btn price-manual-icon"
          onClick={(e) => {
            e.stopPropagation();
            onEditClick?.();
          }}
          title="Manually entered price - click to edit"
        >
          ✏️
        </button>
      )}
      {!isManual && onEditClick && (
        <button
          className="price-edit-btn"
          onClick={(e) => {
            e.stopPropagation();
            onEditClick();
          }}
          title="Enter price manually"
        >
          ✏️
        </button>
      )}
    </span>
  );
}

/**
 * Displays daily price change.
 */
export function DailyChange({
  change,
  changePercent,
}: {
  change: number; // In cents
  changePercent: number;
}) {
  const changeInDollars = change / 100;
  const isPositive = change >= 0;
  const className = isPositive ? 'gain-positive' : 'gain-negative';
  const sign = isPositive ? '+' : '';

  return (
    <span className={`daily-change ${className}`}>
      {sign}${Math.abs(changeInDollars).toFixed(2)} ({sign}{changePercent.toFixed(2)}%)
    </span>
  );
}
