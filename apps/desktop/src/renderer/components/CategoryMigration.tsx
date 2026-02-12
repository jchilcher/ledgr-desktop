import React, { useState, useEffect } from 'react';

interface CategoryProportion {
  categoryId: string;
  categoryName: string;
  amount: number;
  proportion: number;
  transactionCount: number;
}

interface PeriodBreakdown {
  period: string;
  startDate: Date;
  endDate: Date;
  totalSpending: number;
  categories: CategoryProportion[];
}

interface CategoryShift {
  categoryId: string;
  categoryName: string;
  previousProportion: number;
  currentProportion: number;
  proportionChange: number;
  amountChange: number;
  direction: 'increasing' | 'decreasing';
  significance: 'minor' | 'moderate' | 'significant';
}

interface CategoryTrend {
  categoryId: string;
  categoryName: string;
  trend: 'increasing' | 'decreasing' | 'stable';
  averageProportion: number;
  volatility: number;
  history: Array<{
    period: string;
    proportion: number;
    amount: number;
  }>;
}

interface CategoryMigrationReport {
  periods: PeriodBreakdown[];
  shifts: CategoryShift[];
  trends: CategoryTrend[];
  summary: {
    totalPeriodsAnalyzed: number;
    significantShifts: number;
    mostGrowingCategory: string | null;
    mostDecliningCategory: string | null;
    mostVolatileCategory: string | null;
    mostStableCategory: string | null;
  };
  recommendations: string[];
}

const CategoryMigration: React.FC = () => {
  const [report, setReport] = useState<CategoryMigrationReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [monthsBack, setMonthsBack] = useState(12);
  const [view, setView] = useState<'stacked' | 'shifts' | 'trends'>('stacked');

  useEffect(() => {
    loadData();
  }, [monthsBack]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await window.api.categoryMigration.analyze({ monthsBack });
      setReport(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to analyze category migration');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(amount / 100);
  };

  const getSignificanceColor = (significance: string) => {
    switch (significance) {
      case 'significant': return '#ef4444';
      case 'moderate': return '#f59e0b';
      case 'minor': return '#3b82f6';
      default: return 'var(--color-text-muted)';
    }
  };

  const getTrendColor = (trend: string) => {
    switch (trend) {
      case 'increasing': return '#ef4444';
      case 'decreasing': return '#22c55e';
      case 'stable': return 'var(--color-text-muted)';
      default: return 'var(--color-text-muted)';
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'increasing': return '↑';
      case 'decreasing': return '↓';
      case 'stable': return '→';
      default: return '';
    }
  };

  // Generate colors for categories
  const categoryColors: Record<string, string> = {};
  const defaultColors = [
    '#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6',
    '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1',
  ];

  if (report) {
    const allCategories = new Set<string>();
    for (const period of report.periods) {
      for (const cat of period.categories) {
        allCategories.add(cat.categoryId);
      }
    }
    Array.from(allCategories).forEach((catId, i) => {
      categoryColors[catId] = defaultColors[i % defaultColors.length];
    });
  }

  if (loading) {
    return (
      <div className="category-migration category-migration--loading">
        <div className="spinner" />
        <span>Analyzing category migration...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="category-migration category-migration--error">
        <span style={{ color: 'var(--color-danger)' }}>Error: {error}</span>
        <button onClick={loadData} className="btn btn-secondary" style={{ marginLeft: '10px' }}>
          Retry
        </button>
      </div>
    );
  }

  if (!report || report.periods.length === 0) {
    return (
      <div className="category-migration category-migration--empty">
        <p>Not enough data to analyze category migration.</p>
        <p style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>
          At least 2 months of transaction history is needed.
        </p>
      </div>
    );
  }

  return (
    <div className="category-migration">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h3 style={{ margin: 0 }}>Spending Distribution Over Time</h3>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <select
            value={monthsBack}
            onChange={(e) => setMonthsBack(parseInt(e.target.value))}
            style={{ fontSize: '13px' }}
          >
            <option value="6">Last 6 months</option>
            <option value="12">Last 12 months</option>
            <option value="24">Last 24 months</option>
          </select>
          <button onClick={loadData} className="btn btn-secondary" style={{ fontSize: '13px' }}>
            Refresh
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: '12px',
          marginBottom: '24px',
        }}
      >
        <div style={{ padding: '12px', backgroundColor: 'var(--color-surface)', borderRadius: 'var(--radius-md)' }}>
          <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Periods Analyzed</div>
          <div style={{ fontSize: '20px', fontWeight: 'bold' }}>{report.summary.totalPeriodsAnalyzed}</div>
        </div>
        <div style={{ padding: '12px', backgroundColor: 'var(--color-surface)', borderRadius: 'var(--radius-md)' }}>
          <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Major Shifts</div>
          <div style={{ fontSize: '20px', fontWeight: 'bold', color: report.summary.significantShifts > 0 ? 'var(--color-warning)' : 'inherit' }}>
            {report.summary.significantShifts}
          </div>
        </div>
        {report.summary.mostGrowingCategory && (
          <div style={{ padding: '12px', backgroundColor: 'var(--color-surface)', borderRadius: 'var(--radius-md)' }}>
            <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Growing Most</div>
            <div style={{ fontSize: '14px', fontWeight: 'bold', color: 'var(--color-danger)' }}>
              {report.summary.mostGrowingCategory}
            </div>
          </div>
        )}
        {report.summary.mostDecliningCategory && (
          <div style={{ padding: '12px', backgroundColor: 'var(--color-surface)', borderRadius: 'var(--radius-md)' }}>
            <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Declining Most</div>
            <div style={{ fontSize: '14px', fontWeight: 'bold', color: 'var(--color-success)' }}>
              {report.summary.mostDecliningCategory}
            </div>
          </div>
        )}
      </div>

      {/* View Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        {(['stacked', 'shifts', 'trends'] as const).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            style={{
              padding: '8px 16px',
              backgroundColor: view === v ? 'var(--color-primary)' : 'var(--color-surface)',
              color: view === v ? 'white' : 'inherit',
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              cursor: 'pointer',
              fontSize: '13px',
            }}
          >
            {v === 'stacked' ? 'Distribution' : v.charAt(0).toUpperCase() + v.slice(1)}
          </button>
        ))}
      </div>

      {/* Stacked Area View */}
      {view === 'stacked' && (
        <div style={{ backgroundColor: 'var(--color-surface)', borderRadius: 'var(--radius-md)', padding: '16px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {report.periods.map((period) => (
              <div key={period.period}>
                <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginBottom: '4px' }}>
                  {period.period} ({formatCurrency(period.totalSpending)})
                </div>
                <div style={{ display: 'flex', height: '24px', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
                  {period.categories.slice(0, 8).map((cat) => (
                    <div
                      key={cat.categoryId}
                      title={`${cat.categoryName}: ${cat.proportion.toFixed(1)}% (${formatCurrency(cat.amount)})`}
                      style={{
                        width: `${cat.proportion}%`,
                        backgroundColor: categoryColors[cat.categoryId],
                        minWidth: cat.proportion > 0 ? '2px' : '0',
                      }}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Legend */}
          <div style={{ marginTop: '16px', display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
            {report.trends.slice(0, 8).map((trend) => (
              <div key={trend.categoryId} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px' }}>
                <div style={{ width: '12px', height: '12px', borderRadius: '2px', backgroundColor: categoryColors[trend.categoryId] }} />
                <span>{trend.categoryName} ({trend.averageProportion.toFixed(0)}%)</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Shifts View */}
      {view === 'shifts' && (
        <div>
          {report.shifts.length === 0 ? (
            <div style={{ padding: '20px', textAlign: 'center', color: 'var(--color-text-muted)', backgroundColor: 'var(--color-surface)', borderRadius: 'var(--radius-md)' }}>
              No significant category shifts detected in the last month.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {report.shifts.map((shift) => (
                <div
                  key={shift.categoryId}
                  style={{
                    padding: '12px 16px',
                    backgroundColor: 'var(--color-surface)',
                    borderRadius: 'var(--radius-md)',
                    borderLeft: `4px solid ${getSignificanceColor(shift.significance)}`,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <span style={{ fontWeight: '500' }}>{shift.categoryName}</span>
                      <span
                        style={{
                          marginLeft: '8px',
                          fontSize: '11px',
                          padding: '2px 6px',
                          borderRadius: 'var(--radius-sm)',
                          backgroundColor: getSignificanceColor(shift.significance),
                          color: 'white',
                        }}
                      >
                        {shift.significance}
                      </span>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '18px', fontWeight: 'bold', color: shift.direction === 'increasing' ? 'var(--color-danger)' : 'var(--color-success)' }}>
                        {shift.proportionChange > 0 ? '+' : ''}{shift.proportionChange.toFixed(1)}%
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                        {shift.previousProportion.toFixed(1)}% → {shift.currentProportion.toFixed(1)}%
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Trends View */}
      {view === 'trends' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {report.trends.map((trend) => (
            <div
              key={trend.categoryId}
              style={{
                padding: '12px 16px',
                backgroundColor: 'var(--color-surface)',
                borderRadius: 'var(--radius-md)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '12px', height: '12px', borderRadius: '2px', backgroundColor: categoryColors[trend.categoryId] }} />
                  <span style={{ fontWeight: '500' }}>{trend.categoryName}</span>
                  <span style={{ color: getTrendColor(trend.trend) }}>
                    {getTrendIcon(trend.trend)} {trend.trend}
                  </span>
                </div>
                <div style={{ fontSize: '14px' }}>
                  Avg: {trend.averageProportion.toFixed(1)}%
                </div>
              </div>

              {/* Mini sparkline */}
              <div style={{ display: 'flex', alignItems: 'end', gap: '2px', height: '30px' }}>
                {trend.history.map((h, i) => (
                  <div
                    key={i}
                    title={`${h.period}: ${h.proportion.toFixed(1)}%`}
                    style={{
                      flex: 1,
                      backgroundColor: categoryColors[trend.categoryId],
                      opacity: 0.6 + (i / trend.history.length) * 0.4,
                      height: `${Math.max(4, (h.proportion / Math.max(...trend.history.map(x => x.proportion))) * 100)}%`,
                      borderRadius: '2px 2px 0 0',
                    }}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Recommendations */}
      {report.recommendations.length > 0 && (
        <div style={{ marginTop: '24px' }}>
          <h4 style={{ margin: '0 0 12px 0' }}>Insights</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {report.recommendations.map((rec, index) => (
              <div
                key={index}
                style={{
                  padding: '12px',
                  backgroundColor: 'var(--color-surface)',
                  borderRadius: 'var(--radius-md)',
                  borderLeft: '4px solid var(--color-info)',
                  fontSize: '14px',
                }}
              >
                {rec}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default CategoryMigration;
