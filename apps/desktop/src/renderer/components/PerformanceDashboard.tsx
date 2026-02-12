import { useState, useEffect, useCallback } from 'react';
import type {
  PerformanceMetrics,
  PerformanceOptions,
  PerformancePeriod,
  PositionGainLoss,
} from '../../shared/types';
import { TWRTooltip, MWRTooltip, BenchmarkTooltip } from './PerformanceTooltips';
import { PerformanceChart } from './PerformanceChart';

const PERIOD_OPTIONS: Array<{ value: PerformancePeriod; label: string }> = [
  { value: '1D', label: '1D' },
  { value: '1W', label: '1W' },
  { value: '1M', label: '1M' },
  { value: '3M', label: '3M' },
  { value: 'YTD', label: 'YTD' },
  { value: '1Y', label: '1Y' },
  { value: 'ALL', label: 'All' },
  { value: 'CUSTOM', label: 'Custom' },
];

// Format currency in cents to dollars
function formatCurrency(cents: number): string {
  const dollars = cents / 100;
  return dollars.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatPercent(value: number): string {
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}%`;
}

export function PerformanceDashboard() {
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<PerformancePeriod>('YTD');
  const [showBenchmark, setShowBenchmark] = useState(true);
  const [expandedPosition, setExpandedPosition] = useState<string | null>(null);
  const [customDates, setCustomDates] = useState({
    start: '',
    end: '',
  });

  // Load default period from settings on mount
  useEffect(() => {
    window.api.performance.getDefaultPeriod().then((period) => {
      setSelectedPeriod(period);
    });
  }, []);

  // Fetch metrics when period changes
  const fetchMetrics = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const options: PerformanceOptions = {
        period: selectedPeriod,
        includeBenchmark: showBenchmark,
      };

      if (selectedPeriod === 'CUSTOM' && customDates.start && customDates.end) {
        options.customStartDate = new Date(customDates.start);
        options.customEndDate = new Date(customDates.end);
      }

      const data = await window.api.performance.getMetrics(options);
      setMetrics(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load performance data');
    } finally {
      setLoading(false);
    }
  }, [selectedPeriod, showBenchmark, customDates]);

  useEffect(() => {
    fetchMetrics();
  }, [fetchMetrics]);

  // Save period preference when changed
  const handlePeriodChange = (period: PerformancePeriod) => {
    setSelectedPeriod(period);
    window.api.performance.setDefaultPeriod(period);
  };

  if (loading) {
    return (
      <div className="performance-dashboard loading">
        <div className="spinner" />
        <p>Loading performance data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="performance-dashboard error">
        <p className="error-message">{error}</p>
        <button onClick={fetchMetrics} className="btn btn-primary">Retry</button>
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="performance-dashboard empty">
        <p>No performance data available. Add holdings to see your portfolio performance.</p>
      </div>
    );
  }

  const { portfolio, positions, returns } = metrics;
  const isPositive = portfolio.unrealizedGain >= 0;

  return (
    <div className="performance-dashboard">
      {/* Hero Card */}
      <div className="hero-card">
        <div className="hero-main">
          <span className="hero-label">Total Portfolio Value</span>
          <span className="hero-value">{formatCurrency(portfolio.totalValue)}</span>
        </div>

        <div className="hero-metrics">
          <div className={`hero-metric ${isPositive ? 'gain' : 'loss'}`}>
            <span className="metric-label">Unrealized Gain/Loss</span>
            <span className="metric-value">
              {formatCurrency(portfolio.unrealizedGain)} ({formatPercent(portfolio.unrealizedGainPercent)})
            </span>
          </div>

          <div className={`hero-metric ${portfolio.dayChange >= 0 ? 'gain' : 'loss'}`}>
            <span className="metric-label">Today&apos;s Change</span>
            <span className="metric-value">
              {formatCurrency(portfolio.dayChange)} ({formatPercent(portfolio.dayChangePercent)})
            </span>
          </div>
        </div>
      </div>

      {/* Period Selector */}
      <div className="period-selector">
        <div className="period-buttons">
          {PERIOD_OPTIONS.map(({ value, label }) => (
            <button
              key={value}
              className={`period-btn ${selectedPeriod === value ? 'active' : ''}`}
              onClick={() => handlePeriodChange(value)}
            >
              {label}
            </button>
          ))}
        </div>

        {selectedPeriod === 'CUSTOM' && (
          <div className="custom-dates">
            <input
              type="date"
              value={customDates.start}
              onChange={(e) => setCustomDates(prev => ({ ...prev, start: e.target.value }))}
              max={customDates.end || undefined}
            />
            <span>to</span>
            <input
              type="date"
              value={customDates.end}
              onChange={(e) => setCustomDates(prev => ({ ...prev, end: e.target.value }))}
              min={customDates.start || undefined}
              max={new Date().toISOString().split('T')[0]}
            />
          </div>
        )}
      </div>

      {/* Return Metrics with Tooltips */}
      <div className="return-metrics">
        <TWRTooltip value={returns.twr} />
        <MWRTooltip value={returns.mwr} />
        {metrics.benchmarkReturn !== undefined && (
          <BenchmarkTooltip
            portfolioReturn={returns.twr}
            benchmarkReturn={metrics.benchmarkReturn}
          />
        )}
      </div>

      {/* Realized Gains Section */}
      {(portfolio.realizedGainYTD !== 0 || portfolio.realizedGainTotal !== 0) && (
        <div className="realized-gains-section">
          <h4>Realized Gains</h4>
          <div className="realized-metrics">
            <div className={`realized-metric ${portfolio.realizedGainYTD >= 0 ? 'gain' : 'loss'}`}>
              <span className="metric-label">Year-to-Date</span>
              <span className="metric-value">{formatCurrency(portfolio.realizedGainYTD)}</span>
            </div>
            <div className={`realized-metric ${portfolio.realizedGainTotal >= 0 ? 'gain' : 'loss'}`}>
              <span className="metric-label">All-Time</span>
              <span className="metric-value">{formatCurrency(portfolio.realizedGainTotal)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Performance Chart */}
      <PerformanceChart
        portfolioData={[]} // Chart data would come from historical snapshots
        benchmarkData={[]}
        showBenchmark={showBenchmark}
        onToggleBenchmark={() => setShowBenchmark(!showBenchmark)}
      />

      {/* Per-Position Performance (Expandable) */}
      <div className="positions-section">
        <h4>Position Performance</h4>
        <div className="positions-list">
          {positions.length === 0 ? (
            <p className="empty-state">No positions to display. Add holdings to see position performance.</p>
          ) : (
            positions.map((position) => (
              <PositionRow
                key={position.holdingId}
                position={position}
                isExpanded={expandedPosition === position.holdingId}
                onToggle={() => setExpandedPosition(
                  expandedPosition === position.holdingId ? null : position.holdingId
                )}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function PositionRow({
  position,
  isExpanded,
  onToggle,
}: {
  position: PositionGainLoss;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const isPositive = position.unrealizedGain >= 0;

  return (
    <div className={`position-row ${isExpanded ? 'expanded' : ''}`}>
      <div className="position-summary" onClick={onToggle}>
        <div className="position-info">
          <span className="position-ticker">{position.ticker}</span>
          <span className="position-name">{position.name}</span>
        </div>
        <div className="position-value">
          <span className="value">{formatCurrency(position.currentValue)}</span>
          <span className={`gain-loss ${isPositive ? 'gain' : 'loss'}`}>
            {formatCurrency(position.unrealizedGain)} ({formatPercent(position.unrealizedGainPercent)})
          </span>
        </div>
        <button className="expand-btn" aria-label={isExpanded ? 'Collapse' : 'Expand'}>
          {isExpanded ? '-' : '+'}
        </button>
      </div>

      {isExpanded && (
        <div className="position-details">
          <div className="detail-row">
            <span className="label">Shares</span>
            <span className="value">{position.shares.toLocaleString(undefined, { maximumFractionDigits: 4 })}</span>
          </div>
          <div className="detail-row">
            <span className="label">Cost Basis</span>
            <span className="value">{formatCurrency(position.costBasis)}</span>
          </div>
          <div className="detail-row">
            <span className="label">Current Value</span>
            <span className="value">{formatCurrency(position.currentValue)}</span>
          </div>
          <div className="detail-row">
            <span className="label">Day Change</span>
            <span className={`value ${position.dayChange >= 0 ? 'gain' : 'loss'}`}>
              {formatCurrency(position.dayChange)} ({formatPercent(position.dayChangePercent)})
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
