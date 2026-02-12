import { useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';

interface ChartDataPoint {
  date: string;
  portfolio: number;
  benchmark?: number;
}

interface PerformanceChartProps {
  portfolioData: ChartDataPoint[];
  benchmarkData?: ChartDataPoint[];
  showBenchmark?: boolean;
  onToggleBenchmark?: () => void;
}

// Accessible color palette from 04-CONTEXT.md
const COLORS = {
  portfolio: '#2563eb',      // Blue for portfolio
  benchmark: '#9ca3af',      // Gray for benchmark
  gain: '#2563eb',           // Blue for gains
  loss: '#ea580c',           // Orange for losses
  gridLine: '#e5e7eb',
};

export function PerformanceChart({
  portfolioData,
  benchmarkData,
  showBenchmark = false,
  onToggleBenchmark,
}: PerformanceChartProps) {
  // Normalize both series to start at 100 for comparison
  const normalizedData = useMemo(() => {
    if (portfolioData.length === 0) return [];

    const portfolioStart = portfolioData[0].portfolio;
    const benchmarkStart = benchmarkData?.[0]?.benchmark ?? 100;

    return portfolioData.map((point, index) => {
      const normalizedPortfolio = portfolioStart > 0
        ? (point.portfolio / portfolioStart) * 100
        : 100;

      const benchmarkPoint = benchmarkData?.[index];
      const normalizedBenchmark = benchmarkPoint && benchmarkStart > 0
        ? (benchmarkPoint.benchmark! / benchmarkStart) * 100
        : undefined;

      return {
        date: point.date,
        portfolio: normalizedPortfolio,
        benchmark: normalizedBenchmark,
      };
    });
  }, [portfolioData, benchmarkData]);

  // Calculate if portfolio is up or down overall
  const isPositive = useMemo(() => {
    if (normalizedData.length < 2) return true;
    return normalizedData[normalizedData.length - 1].portfolio >= 100;
  }, [normalizedData]);

  const formatTooltip = (value: number) => {
    const change = value - 100;
    const sign = change >= 0 ? '+' : '';
    return `${sign}${change.toFixed(2)}%`;
  };

  if (portfolioData.length === 0) {
    return (
      <div className="performance-chart">
        <div className="chart-header">
          <h4>Portfolio Performance</h4>
        </div>
        <div className="chart-empty">
          <p>Add holdings to see performance over time</p>
        </div>
      </div>
    );
  }

  return (
    <div className="performance-chart">
      <div className="chart-header">
        <h4>Portfolio Performance</h4>
        {benchmarkData && onToggleBenchmark && (
          <label className="benchmark-toggle">
            <input
              type="checkbox"
              checked={showBenchmark}
              onChange={onToggleBenchmark}
            />
            <span>Compare to S&P 500</span>
          </label>
        )}
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={normalizedData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={COLORS.gridLine} />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 12 }}
            tickFormatter={(value) => {
              const date = new Date(value);
              return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            }}
          />
          <YAxis
            tick={{ fontSize: 12 }}
            tickFormatter={(value) => `${value.toFixed(0)}%`}
            domain={['auto', 'auto']}
          />
          <Tooltip
            formatter={(value, name) => [
              formatTooltip(value as number),
              name === 'portfolio' ? 'Your Portfolio' : 'S&P 500',
            ]}
            labelFormatter={(label) => new Date(label).toLocaleDateString('en-US', {
              month: 'long',
              day: 'numeric',
              year: 'numeric',
            })}
          />
          <Legend />
          <ReferenceLine y={100} stroke="#9ca3af" strokeDasharray="5 5" />

          <Line
            type="monotone"
            dataKey="portfolio"
            name="Your Portfolio"
            stroke={isPositive ? COLORS.gain : COLORS.loss}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 6 }}
          />

          {showBenchmark && (
            <Line
              type="monotone"
              dataKey="benchmark"
              name="S&P 500"
              stroke={COLORS.benchmark}
              strokeWidth={2}
              strokeDasharray="5 5"
              dot={false}
              activeDot={{ r: 4 }}
            />
          )}
        </LineChart>
      </ResponsiveContainer>

      {showBenchmark && normalizedData.length > 0 && (
        <div className="chart-callout">
          {(() => {
            const lastPortfolio = normalizedData[normalizedData.length - 1].portfolio;
            const lastBenchmark = normalizedData[normalizedData.length - 1].benchmark ?? 100;
            const diff = lastPortfolio - lastBenchmark;
            const isOutperforming = diff >= 0;

            return (
              <span className={isOutperforming ? 'gain' : 'loss'}>
                {isOutperforming ? '+' : ''}{diff.toFixed(2)}% vs benchmark
              </span>
            );
          })()}
        </div>
      )}
    </div>
  );
}
