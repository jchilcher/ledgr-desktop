import { useState, useMemo } from 'react';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { useNetWorthHistoryRange } from '../hooks/useNetWorth';

type TimeRange = '1M' | '3M' | '6M' | '1Y' | 'ALL' | 'CUSTOM';
type ChartMode = 'total' | 'stacked';

interface NetWorthChartProps {
  className?: string;
}

export function NetWorthChart({ className }: NetWorthChartProps) {
  const [timeRange, setTimeRange] = useState<TimeRange>('1Y');
  const [chartMode, setChartMode] = useState<ChartMode>('total');
  const [customStartDate, setCustomStartDate] = useState<Date | null>(null);
  const [customEndDate, setCustomEndDate] = useState<Date | null>(null);

  // Calculate date range
  const { startDate, endDate } = useMemo(() => {
    const end = new Date();
    let start: Date;

    switch (timeRange) {
      case '1M':
        start = new Date(end);
        start.setMonth(start.getMonth() - 1);
        break;
      case '3M':
        start = new Date(end);
        start.setMonth(start.getMonth() - 3);
        break;
      case '6M':
        start = new Date(end);
        start.setMonth(start.getMonth() - 6);
        break;
      case '1Y':
        start = new Date(end);
        start.setFullYear(start.getFullYear() - 1);
        break;
      case 'ALL':
        start = new Date(2000, 0, 1); // Effectively all time
        break;
      case 'CUSTOM':
        start = customStartDate ?? new Date(end.getTime() - 365 * 24 * 60 * 60 * 1000);
        break;
      default:
        start = new Date(end);
        start.setFullYear(start.getFullYear() - 1);
    }

    return {
      startDate: start,
      endDate: timeRange === 'CUSTOM' && customEndDate ? customEndDate : end,
    };
  }, [timeRange, customStartDate, customEndDate]);

  const { snapshots, loading, error } = useNetWorthHistoryRange(startDate, endDate);

  // Transform data for chart
  const chartData = useMemo(() => {
    return snapshots.map(snapshot => ({
      date: new Date(snapshot.date).toLocaleDateString(),
      timestamp: new Date(snapshot.date).getTime(),
      netWorth: snapshot.netWorth / 100, // Convert cents to dollars
      assets: snapshot.totalAssets / 100,
      liabilities: snapshot.totalLiabilities / 100,
      bankAccounts: snapshot.bankAccountsTotal / 100,
      investments: snapshot.investmentAccountsTotal / 100,
      manualAssets: snapshot.manualAssetsTotal / 100,
    }));
  }, [snapshots]);

  // Format currency for display
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const timeRangeButtons: TimeRange[] = ['1M', '3M', '6M', '1Y', 'ALL', 'CUSTOM'];

  if (loading) {
    return (
      <div className={`section ${className}`}>
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`section ${className}`} style={{ color: 'var(--color-danger)' }}>
        Error loading chart: {error}
      </div>
    );
  }

  return (
    <div className={`section ${className}`}>
      {/* Header with controls */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h3 style={{ margin: 0 }}>Net Worth History</h3>

        <div style={{ display: 'flex', gap: '16px' }}>
          {/* Time range selector */}
          <div style={{ display: 'flex', gap: '4px' }}>
            {timeRangeButtons.map(range => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={timeRange === range ? 'btn btn-primary' : 'btn btn-secondary'}
                style={{ padding: '4px 12px', fontSize: '14px' }}
              >
                {range}
              </button>
            ))}
          </div>

          {/* Chart mode toggle */}
          <div style={{ display: 'flex', gap: '4px', borderLeft: '1px solid var(--color-border)', paddingLeft: '16px' }}>
            <button
              onClick={() => setChartMode('total')}
              className={chartMode === 'total' ? 'btn btn-primary' : 'btn btn-secondary'}
              style={{ padding: '4px 12px', fontSize: '14px' }}
            >
              Total
            </button>
            <button
              onClick={() => setChartMode('stacked')}
              className={chartMode === 'stacked' ? 'btn btn-primary' : 'btn btn-secondary'}
              style={{ padding: '4px 12px', fontSize: '14px' }}
            >
              Breakdown
            </button>
          </div>
        </div>
      </div>

      {/* Custom date picker */}
      {timeRange === 'CUSTOM' && (
        <div style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '14px', color: 'var(--color-text-muted)', marginBottom: '4px' }}>
              Start Date
            </label>
            <input
              type="date"
              value={customStartDate?.toISOString().split('T')[0] ?? ''}
              onChange={e => setCustomStartDate(new Date(e.target.value))}
              style={{ padding: '4px 8px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '14px', color: 'var(--color-text-muted)', marginBottom: '4px' }}>
              End Date
            </label>
            <input
              type="date"
              value={customEndDate?.toISOString().split('T')[0] ?? ''}
              onChange={e => setCustomEndDate(new Date(e.target.value))}
              style={{ padding: '4px 8px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)' }}
            />
          </div>
        </div>
      )}

      {/* Chart */}
      <div style={{ height: '320px' }}>
        {chartData.length === 0 ? (
          <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-muted)' }}>
            No historical data available. Net worth will be tracked over time.
          </div>
        ) : chartMode === 'total' ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis tickFormatter={formatCurrency} />
              <Tooltip
                formatter={(value) => formatCurrency(value as number)}
                labelStyle={{ fontWeight: 'bold' }}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="netWorth"
                name="Net Worth"
                stroke="#2563eb"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis tickFormatter={formatCurrency} />
              <Tooltip
                formatter={(value) => formatCurrency(value as number)}
                labelStyle={{ fontWeight: 'bold' }}
              />
              <Legend />
              <Area
                type="monotone"
                dataKey="bankAccounts"
                name="Bank Accounts"
                stackId="assets"
                stroke="#10b981"
                fill="#10b981"
                fillOpacity={0.6}
              />
              <Area
                type="monotone"
                dataKey="investments"
                name="Investments"
                stackId="assets"
                stroke="#3b82f6"
                fill="#3b82f6"
                fillOpacity={0.6}
              />
              <Area
                type="monotone"
                dataKey="manualAssets"
                name="Other Assets"
                stackId="assets"
                stroke="#8b5cf6"
                fill="#8b5cf6"
                fillOpacity={0.6}
              />
              <Area
                type="monotone"
                dataKey="liabilities"
                name="Liabilities"
                stroke="#ef4444"
                fill="#ef4444"
                fillOpacity={0.4}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

export default NetWorthChart;
