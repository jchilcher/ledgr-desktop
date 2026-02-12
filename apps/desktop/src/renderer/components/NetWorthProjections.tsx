import { useState, useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ReferenceLine,
} from 'recharts';
import type { NetWorthProjectionConfig } from '@ledgr/core';
import { useNetWorthProjections } from '../hooks/useNetWorth';

interface NetWorthProjectionsProps {
  className?: string;
}

export function NetWorthProjections({ className }: NetWorthProjectionsProps) {
  const [horizonYears, setHorizonYears] = useState(5);
  const [mode, setMode] = useState<'auto' | 'custom'>('auto');

  // Custom assumptions (when mode is 'custom')
  const [monthlyAssetGrowth, setMonthlyAssetGrowth] = useState(1000);
  const [monthlyLiabilityReduction, setMonthlyLiabilityReduction] = useState(500);

  const config: NetWorthProjectionConfig = useMemo(() => {
    const baseConfig: NetWorthProjectionConfig = {
      months: horizonYears * 12,
      useTrendAnalysis: mode === 'auto',
      confidenceLevel: 0.90,
    };

    if (mode === 'custom') {
      return {
        ...baseConfig,
        monthlyAssetGrowth: monthlyAssetGrowth * 100, // Convert to cents
        monthlyLiabilityReduction: monthlyLiabilityReduction * 100,
      };
    }

    return baseConfig;
  }, [horizonYears, mode, monthlyAssetGrowth, monthlyLiabilityReduction]);

  const { projections, loading, error } = useNetWorthProjections(config);

  // Prepare chart data
  const chartData = useMemo(() => {
    if (!projections) return [];

    return projections.projections.map(point => ({
      date: point.date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
      expected: point.projected / 100,
      optimistic: point.upperBound / 100,
      pessimistic: point.lowerBound / 100,
    }));
  }, [projections]);

  // Upcoming milestones (not yet achieved)
  const upcomingMilestones = useMemo(() => {
    if (!projections) return [];
    return projections.milestones
      .filter(m => !m.achieved && m.projectedDate)
      .slice(0, 3);
  }, [projections]);

  if (loading) {
    return (
      <div className={`section ${className}`}>
        <div className="animate-pulse">
          <div style={{ height: '16px', backgroundColor: 'var(--color-border)', borderRadius: 'var(--radius-sm)', width: '25%', marginBottom: '16px' }}></div>
          <div style={{ height: '256px', backgroundColor: 'var(--color-border)', borderRadius: 'var(--radius-sm)' }}></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`section ${className}`} style={{ color: 'var(--color-danger)' }}>
        Error generating projections: {error}
      </div>
    );
  }

  return (
    <div className={`section ${className}`}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '16px' }}>
        <div>
          <h3 style={{ margin: 0 }}>Net Worth Projections</h3>
          {projections && projections.confidence !== undefined && (
            <p style={{ fontSize: '14px', color: 'var(--color-text-muted)', margin: '4px 0 0 0' }}>
              Confidence: {projections.confidence.toFixed(0)}%
              {mode === 'auto' && ' (based on historical trends)'}
            </p>
          )}
        </div>

        {/* Controls */}
        <div style={{ display: 'flex', gap: '16px' }}>
          {/* Horizon selector */}
          <div>
            <label style={{ display: 'block', fontSize: '12px', color: 'var(--color-text-muted)', marginBottom: '4px' }}>
              Horizon
            </label>
            <select
              value={horizonYears}
              onChange={e => setHorizonYears(Number(e.target.value))}
              style={{ padding: '4px 8px', fontSize: '14px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)' }}
            >
              <option value={1}>1 Year</option>
              <option value={3}>3 Years</option>
              <option value={5}>5 Years</option>
              <option value={10}>10 Years</option>
            </select>
          </div>

          {/* Mode toggle */}
          <div>
            <label style={{ display: 'block', fontSize: '12px', color: 'var(--color-text-muted)', marginBottom: '4px' }}>
              Mode
            </label>
            <div style={{ display: 'flex', gap: '4px' }}>
              <button
                onClick={() => setMode('auto')}
                className={mode === 'auto' ? 'btn btn-primary' : 'btn btn-secondary'}
                style={{ padding: '4px 12px', fontSize: '14px' }}
              >
                Auto
              </button>
              <button
                onClick={() => setMode('custom')}
                className={mode === 'custom' ? 'btn btn-primary' : 'btn btn-secondary'}
                style={{ padding: '4px 12px', fontSize: '14px' }}
              >
                Custom
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Custom assumptions form */}
      {mode === 'custom' && (
        <div style={{ display: 'flex', gap: '24px', marginBottom: '16px', padding: '16px', backgroundColor: 'var(--color-surface)', borderRadius: 'var(--radius-md)' }}>
          <div>
            <label style={{ display: 'block', fontSize: '12px', color: 'var(--color-text-muted)', marginBottom: '4px' }}>
              Monthly Asset Growth ($)
            </label>
            <input
              type="number"
              value={monthlyAssetGrowth}
              onChange={e => setMonthlyAssetGrowth(Number(e.target.value))}
              style={{ width: '128px', padding: '4px 8px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '12px', color: 'var(--color-text-muted)', marginBottom: '4px' }}>
              Monthly Liability Reduction ($)
            </label>
            <input
              type="number"
              value={monthlyLiabilityReduction}
              onChange={e => setMonthlyLiabilityReduction(Number(e.target.value))}
              style={{ width: '128px', padding: '4px 8px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)' }}
            />
          </div>
        </div>
      )}

      {/* Chart */}
      <div style={{ height: '288px' }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis
              tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
            />
            <Tooltip
              formatter={(value) => `$${(value as number).toLocaleString()}`}
              labelStyle={{ fontWeight: 'bold' }}
            />
            <Legend />

            {/* Optimistic scenario */}
            <Line
              type="monotone"
              dataKey="optimistic"
              name="Optimistic"
              stroke="#10b981"
              strokeDasharray="5 5"
              dot={false}
              strokeWidth={1}
            />

            {/* Expected scenario */}
            <Line
              type="monotone"
              dataKey="expected"
              name="Expected"
              stroke="#2563eb"
              dot={false}
              strokeWidth={2}
            />

            {/* Pessimistic scenario */}
            <Line
              type="monotone"
              dataKey="pessimistic"
              name="Pessimistic"
              stroke="#f59e0b"
              strokeDasharray="5 5"
              dot={false}
              strokeWidth={1}
            />

            {/* Milestone reference lines */}
            {upcomingMilestones.map(milestone => (
              <ReferenceLine
                key={milestone.amount}
                y={milestone.amount / 100}
                stroke="#9ca3af"
                strokeDasharray="3 3"
                label={{ value: milestone.label, position: 'left', fontSize: 10 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Milestones */}
      <div style={{ marginTop: '24px', paddingTop: '16px', borderTop: '1px solid var(--color-border)' }}>
        <h4 style={{ fontSize: '14px', fontWeight: 500, color: 'var(--color-text)', marginBottom: '8px' }}>
          Milestones
        </h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {projections?.milestones.slice(0, 5).map(milestone => (
            <div
              key={milestone.amount}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontSize: '14px',
                color: milestone.achieved ? 'var(--color-success)' : 'var(--color-text-muted)',
              }}
            >
              <span>{milestone.label}</span>
              <span>
                {milestone.achieved
                  ? 'Achieved'
                  : milestone.projectedDate
                    ? milestone.projectedDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
                    : 'Not projected'}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default NetWorthProjections;
