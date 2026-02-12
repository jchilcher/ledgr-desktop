import React, { useState, useEffect } from 'react';
import { Category } from '../../shared/types';

interface SeasonalPattern {
  id: string;
  categoryId: string;
  year: number;
  month: number;
  averageSpending: number;
  transactionCount: number;
  seasonalIndex: number;
  calculatedAt: Date;
}

interface HolidaySpike {
  categoryId: string;
  categoryName: string;
  month: number;
  spike: number;
  description: string;
}

interface SeasonalAnalysisResult {
  patterns: SeasonalPattern[];
  categoryAverages: Record<string, number>;
  seasonalIndices: Record<string, Record<number, number>>;
  holidaySpikes: HolidaySpike[];
}

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

const FULL_MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const SeasonalPatterns: React.FC = () => {
  const [result, setResult] = useState<SeasonalAnalysisResult | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'heatmap' | 'chart' | 'spikes'>('heatmap');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [analysisData, categoriesData] = await Promise.all([
        window.api.seasonalAnalysis.analyze(),
        window.api.categories.getAll(),
      ]);
      setResult(analysisData);
      setCategories(categoriesData.filter(c => c.type === 'expense'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to analyze seasonal patterns');
    } finally {
      setLoading(false);
    }
  };

  const getCategoryName = (categoryId: string) => {
    const category = categories.find(c => c.id === categoryId);
    return category?.name || 'Unknown';
  };

  const getCategoryColor = (categoryId: string) => {
    const category = categories.find(c => c.id === categoryId);
    return category?.color || '#6B7280';
  };

  const getHeatmapColor = (index: number) => {
    // Color scale from green (low) to red (high)
    if (index <= 0.5) return '#22c55e'; // Very low
    if (index <= 0.75) return '#84cc16'; // Low
    if (index <= 0.9) return '#eab308'; // Below average
    if (index <= 1.1) return '#f59e0b'; // Average
    if (index <= 1.25) return '#f97316'; // Above average
    if (index <= 1.5) return '#ef4444'; // High
    return '#dc2626'; // Very high
  };

  const getIntensityLabel = (index: number) => {
    if (index <= 0.5) return 'Very Low';
    if (index <= 0.75) return 'Low';
    if (index <= 0.9) return 'Below Avg';
    if (index <= 1.1) return 'Average';
    if (index <= 1.25) return 'Above Avg';
    if (index <= 1.5) return 'High';
    return 'Very High';
  };

  if (loading) {
    return (
      <div className="seasonal-patterns seasonal-patterns--loading">
        <div className="spinner" />
        <span>Analyzing seasonal patterns...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="seasonal-patterns seasonal-patterns--error">
        <span style={{ color: 'var(--color-danger)' }}>Error: {error}</span>
        <button onClick={loadData} className="btn btn-secondary" style={{ marginLeft: '10px' }}>
          Retry
        </button>
      </div>
    );
  }

  if (!result || result.patterns.length === 0) {
    return (
      <div className="seasonal-patterns seasonal-patterns--empty">
        <p>Not enough transaction history to analyze seasonal patterns.</p>
        <p style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>
          At least 3 months of data per category is needed.
        </p>
      </div>
    );
  }

  // Get unique categories with patterns
  const categoriesWithPatterns = [...new Set(result.patterns.map(p => p.categoryId))];

  // Filter patterns by selected category
  const filteredPatterns = selectedCategory === 'all'
    ? result.patterns
    : result.patterns.filter(p => p.categoryId === selectedCategory);

  // Group patterns by category for heatmap
  const patternsByCategory = new Map<string, Map<number, SeasonalPattern>>();
  for (const pattern of filteredPatterns) {
    if (!patternsByCategory.has(pattern.categoryId)) {
      patternsByCategory.set(pattern.categoryId, new Map());
    }
    patternsByCategory.get(pattern.categoryId)!.set(pattern.month, pattern);
  }

  return (
    <div className="seasonal-patterns">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h3 style={{ margin: 0 }}>Seasonal Spending Patterns</h3>
        <div style={{ display: 'flex', gap: '8px' }}>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            style={{ fontSize: '13px' }}
          >
            <option value="all">All Categories</option>
            {categoriesWithPatterns.map(catId => (
              <option key={catId} value={catId}>{getCategoryName(catId)}</option>
            ))}
          </select>
          <div style={{ display: 'flex', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)' }}>
            <button
              onClick={() => setViewMode('heatmap')}
              style={{
                padding: '4px 12px',
                fontSize: '13px',
                border: 'none',
                background: viewMode === 'heatmap' ? 'var(--color-primary)' : 'transparent',
                color: viewMode === 'heatmap' ? 'white' : 'inherit',
                cursor: 'pointer',
                borderRadius: 'var(--radius-sm) 0 0 var(--radius-sm)',
              }}
            >
              Heatmap
            </button>
            <button
              onClick={() => setViewMode('chart')}
              style={{
                padding: '4px 12px',
                fontSize: '13px',
                border: 'none',
                borderLeft: '1px solid var(--color-border)',
                background: viewMode === 'chart' ? 'var(--color-primary)' : 'transparent',
                color: viewMode === 'chart' ? 'white' : 'inherit',
                cursor: 'pointer',
              }}
            >
              Chart
            </button>
            <button
              onClick={() => setViewMode('spikes')}
              style={{
                padding: '4px 12px',
                fontSize: '13px',
                border: 'none',
                borderLeft: '1px solid var(--color-border)',
                background: viewMode === 'spikes' ? 'var(--color-primary)' : 'transparent',
                color: viewMode === 'spikes' ? 'white' : 'inherit',
                cursor: 'pointer',
                borderRadius: '0 var(--radius-sm) var(--radius-sm) 0',
              }}
            >
              Spikes
            </button>
          </div>
          <button onClick={loadData} className="btn btn-secondary" style={{ fontSize: '13px' }}>
            Refresh
          </button>
        </div>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', fontSize: '12px', flexWrap: 'wrap' }}>
        <span style={{ color: 'var(--color-text-muted)' }}>Spending Intensity:</span>
        {[0.5, 0.75, 1.0, 1.25, 1.5, 1.75].map((index) => (
          <span key={index} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span
              style={{
                width: '16px',
                height: '16px',
                backgroundColor: getHeatmapColor(index),
                borderRadius: '2px',
              }}
            />
            {getIntensityLabel(index)}
          </span>
        ))}
      </div>

      {viewMode === 'heatmap' && (
        <div className="heatmap-view" style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: '8px', borderBottom: '1px solid var(--color-border)' }}>
                  Category
                </th>
                {MONTH_NAMES.map((month, i) => (
                  <th key={i} style={{ padding: '8px', borderBottom: '1px solid var(--color-border)', fontSize: '12px' }}>
                    {month}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from(patternsByCategory.entries()).map(([categoryId, monthPatterns]) => (
                <tr key={categoryId}>
                  <td style={{ padding: '8px', borderBottom: '1px solid var(--color-border)' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span
                        style={{
                          width: '12px',
                          height: '12px',
                          borderRadius: '50%',
                          backgroundColor: getCategoryColor(categoryId),
                        }}
                      />
                      {getCategoryName(categoryId)}
                    </span>
                  </td>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => {
                    const pattern = monthPatterns.get(month);
                    return (
                      <td
                        key={month}
                        style={{
                          padding: '8px',
                          borderBottom: '1px solid var(--color-border)',
                          textAlign: 'center',
                          backgroundColor: pattern ? getHeatmapColor(pattern.seasonalIndex) : 'transparent',
                          color: pattern && pattern.seasonalIndex > 1.1 ? 'white' : 'inherit',
                        }}
                        title={pattern ? `${FULL_MONTH_NAMES[month - 1]}: $${(pattern.averageSpending / 100).toFixed(0)} avg (${(pattern.seasonalIndex * 100).toFixed(0)}% of annual avg)` : 'No data'}
                      >
                        {pattern ? `$${(pattern.averageSpending / 100).toFixed(0)}` : '-'}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {viewMode === 'chart' && (
        <div className="chart-view">
          {Array.from(patternsByCategory.entries()).map(([categoryId, monthPatterns]) => {
            const maxSpending = Math.max(...Array.from(monthPatterns.values()).map(p => p.averageSpending));
            return (
              <div key={categoryId} style={{ marginBottom: '24px' }}>
                <h4 style={{ margin: '0 0 12px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span
                    style={{
                      width: '12px',
                      height: '12px',
                      borderRadius: '50%',
                      backgroundColor: getCategoryColor(categoryId),
                    }}
                  />
                  {getCategoryName(categoryId)}
                </h4>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: '4px', height: '120px' }}>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => {
                    const pattern = monthPatterns.get(month);
                    const height = pattern ? (pattern.averageSpending / maxSpending) * 100 : 0;
                    return (
                      <div
                        key={month}
                        style={{
                          flex: 1,
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                      >
                        <div
                          style={{
                            width: '100%',
                            height: `${height}%`,
                            minHeight: pattern ? '4px' : '0',
                            backgroundColor: pattern ? getHeatmapColor(pattern.seasonalIndex) : 'var(--color-border)',
                            borderRadius: '2px 2px 0 0',
                            transition: 'height 0.3s ease',
                          }}
                          title={pattern ? `$${(pattern.averageSpending / 100).toFixed(0)}` : 'No data'}
                        />
                        <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                          {MONTH_NAMES[month - 1]}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {viewMode === 'spikes' && (
        <div className="spikes-view">
          <p style={{ color: 'var(--color-text-muted)', marginBottom: '16px' }}>
            Categories with significant seasonal spending increases (25%+ above average):
          </p>
          {result.holidaySpikes.length === 0 ? (
            <p style={{ color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
              No significant seasonal spikes detected.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {result.holidaySpikes.map((spike, index) => (
                <div
                  key={index}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '12px',
                    backgroundColor: 'var(--color-surface)',
                    borderRadius: 'var(--radius-md)',
                    borderLeft: `4px solid ${getCategoryColor(spike.categoryId)}`,
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: '500' }}>
                      {spike.categoryName} - {FULL_MONTH_NAMES[spike.month - 1]}
                    </div>
                    <div style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>
                      {spike.description}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '18px', fontWeight: 'bold', color: 'var(--color-danger)' }}>
                      +{spike.spike.toFixed(0)}%
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                      above average
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Year-over-year comparison hint */}
      <div style={{ marginTop: '24px', padding: '12px', backgroundColor: 'var(--color-surface)', borderRadius: 'var(--radius-md)' }}>
        <h4 style={{ margin: '0 0 8px 0', fontSize: '14px' }}>Understanding Seasonal Patterns</h4>
        <p style={{ margin: 0, fontSize: '13px', color: 'var(--color-text-muted)' }}>
          The seasonal index shows how spending in each month compares to your annual average.
          An index of 1.0 means average spending, while 1.5 means 50% above average.
          Use this to plan ahead for months when spending typically increases.
        </p>
      </div>
    </div>
  );
};

export default SeasonalPatterns;
