import React, { useState, useEffect, useCallback, useRef } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Category } from '../../shared/types';
import ChartExportButton from './ChartExportButton';
import { useHousehold } from '../contexts/HouseholdContext';

interface CategoryTrendData {
  categoryId: string;
  categoryName: string;
  period: string;
  total: number;
  count: number;
  average: number;
  color: string;
}

type DatePreset = 'last-3-months' | 'last-6-months' | 'this-year' | 'last-year' | 'custom';
type Grouping = 'day' | 'week' | 'month' | 'year';

const CategoryTrends: React.FC = () => {
  const { householdFilter } = useHousehold();
  const chartRef = useRef<HTMLDivElement>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [trendData, setTrendData] = useState<CategoryTrendData[]>([]);
  const [datePreset, setDatePreset] = useState<DatePreset>('last-3-months');
  const [grouping, setGrouping] = useState<Grouping>('month');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const initialLoadDone = useRef(false);

  // Helper to get date range based on preset
  const getDateRange = useCallback((preset: DatePreset): { start: string; end: string } => {
    const start = new Date();
    const end = new Date();

    switch (preset) {
      case 'last-3-months':
        start.setMonth(start.getMonth() - 3);
        start.setDate(1);
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
        break;
      case 'last-6-months':
        start.setMonth(start.getMonth() - 6);
        start.setDate(1);
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
        break;
      case 'this-year':
        start.setMonth(0);
        start.setDate(1);
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
        break;
      case 'last-year':
        start.setFullYear(start.getFullYear() - 1);
        start.setMonth(0);
        start.setDate(1);
        start.setHours(0, 0, 0, 0);
        end.setFullYear(end.getFullYear() - 1);
        end.setMonth(11);
        end.setDate(31);
        end.setHours(23, 59, 59, 999);
        break;
      case 'custom':
        return { start: startDate, end: endDate };
    }

    return {
      start: start.toISOString().split('T')[0],
      end: end.toISOString().split('T')[0],
    };
  }, [startDate, endDate]);

  // Load categories on mount and restore saved selection
  useEffect(() => {
    const loadCategories = async () => {
      try {
        const cats = await window.api.categories.getAll();
        // Filter to only expense categories for trends
        const expenseCategories = cats.filter((c: Category) => c.type === 'expense');
        setCategories(expenseCategories);

        const expenseCategoryIds = new Set(expenseCategories.map((c: Category) => c.id));

        // Try to restore saved selection
        let restored = false;
        try {
          const saved = await window.api.analytics.getCategoryTrendsSelectedCategories();
          if (saved) {
            const savedIds: string[] = JSON.parse(saved);
            const validIds = savedIds.filter(id => expenseCategoryIds.has(id));
            if (validIds.length > 0) {
              setSelectedCategories(validIds);
              restored = true;
            }
          }
        } catch {
          // Ignore parse errors, fall through to default
        }

        // Fall back to top 5 if no saved selection
        if (!restored && expenseCategories.length > 0) {
          const topCategories = expenseCategories.slice(0, Math.min(5, expenseCategories.length));
          setSelectedCategories(topCategories.map((c: Category) => c.id));
        }

        initialLoadDone.current = true;
      } catch (error) {
        console.error('Failed to load categories:', error);
      }
    };
    loadCategories();
  }, []);

  // Load trend data when categories or date range changes
  useEffect(() => {
    const loadTrendData = async () => {
      if (selectedCategories.length === 0) {
        setTrendData([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const { start, end } = getDateRange(datePreset);
        const data = await window.api.analytics.getCategoryTrendsOverTime(
          selectedCategories,
          grouping,
          start,
          end
        );
        setTrendData(data);
      } catch (error) {
        console.error('Failed to load category trends:', error);
        setTrendData([]);
      } finally {
        setLoading(false);
      }
    };

    loadTrendData();
  }, [selectedCategories, datePreset, grouping, startDate, endDate, getDateRange, householdFilter]);

  // Persist selection changes to DB
  useEffect(() => {
    if (!initialLoadDone.current) return;
    window.api.analytics.setCategoryTrendsSelectedCategories(
      JSON.stringify(selectedCategories)
    ).catch(() => {/* fire-and-forget */});
  }, [selectedCategories]);

  // Toggle category selection
  const toggleCategory = (categoryId: string) => {
    setSelectedCategories(prev => {
      if (prev.includes(categoryId)) {
        return prev.filter(id => id !== categoryId);
      } else {
        return [...prev, categoryId];
      }
    });
  };

  // Transform data for Recharts (group by period with multiple series)
  const getChartData = () => {
    // Get unique periods
    const periods = Array.from(new Set(trendData.map(d => d.period))).sort();

    // Build data structure: one entry per period with all categories as properties
    return periods.map(period => {
      const entry: Record<string, unknown> = { period };

      selectedCategories.forEach(catId => {
        const dataPoint = trendData.find(d => d.period === period && d.categoryId === catId);
        entry[catId] = dataPoint ? dataPoint.total : 0;
      });

      return entry;
    });
  };

  // Get category info for legend
  const getCategoryInfo = (categoryId: string) => {
    const trendItem = trendData.find(d => d.categoryId === categoryId);
    const category = categories.find(c => c.id === categoryId);
    return {
      name: trendItem?.categoryName || category?.name || 'Unknown',
      color: trendItem?.color || category?.color || '#888888',
    };
  };

  // Calculate statistics for each category
  const getCategoryStats = (categoryId: string) => {
    const categoryData = trendData.filter(d => d.categoryId === categoryId);
    if (categoryData.length === 0) return null;

    const totals = categoryData.map(d => d.total);
    const sum = totals.reduce((a, b) => a + b, 0);
    const avg = sum / totals.length;
    const max = Math.max(...totals);
    const min = Math.min(...totals);

    // Calculate trend (simple linear regression slope)
    const n = totals.length;
    if (n < 2) return { avg, max, min, trend: 'stable' };

    const xSum = (n * (n - 1)) / 2; // Sum of 0, 1, 2, ..., n-1
    const ySum = sum;
    const xySum = totals.reduce((acc, y, x) => acc + x * y, 0);
    const xSquareSum = (n * (n - 1) * (2 * n - 1)) / 6;

    const slope = (n * xySum - xSum * ySum) / (n * xSquareSum - xSum * xSum);

    let trend: 'increasing' | 'decreasing' | 'stable';
    const threshold = avg * 0.1; // 10% of average
    if (Math.abs(slope) < threshold) {
      trend = 'stable';
    } else if (slope > 0) {
      trend = 'increasing';
    } else {
      trend = 'decreasing';
    }

    return { avg, max, min, trend };
  };

  const chartData = getChartData();

  return (
    <div style={{ padding: '20px' }}>
      <h2>Category Trends Over Time</h2>

      {/* Category Selection */}
      <div className="card" style={{ marginBottom: '20px' }}>
        <h3 style={{ marginTop: 0 }}>Select Categories</h3>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
          {categories.map(category => (
            <label
              key={category.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '8px 12px',
                border: selectedCategories.includes(category.id) ? '2px solid var(--color-success)' : '2px solid var(--color-border)',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: selectedCategories.includes(category.id) ? 'var(--color-success-bg)' : 'var(--color-surface)',
                cursor: 'pointer',
                opacity: 1,
                transition: 'all 0.15s ease',
              }}
            >
              <input
                type="checkbox"
                checked={selectedCategories.includes(category.id)}
                onChange={() => toggleCategory(category.id)}
                style={{ marginRight: '8px' }}
              />
              <span style={{
                width: '12px',
                height: '12px',
                borderRadius: '50%',
                backgroundColor: category.color || '#888',
                marginRight: '8px',
              }} />
              <span>{category.name}</span>
            </label>
          ))}
        </div>
        {selectedCategories.length === 0 && (
          <p style={{ color: 'var(--color-text-muted)', fontSize: '14px', marginTop: '10px', marginBottom: 0 }}>
            Select at least one category to view trends
          </p>
        )}
      </div>

      {/* Controls */}
      <div style={{
        display: 'flex',
        gap: '15px',
        marginBottom: '20px',
        flexWrap: 'wrap',
        alignItems: 'center'
      }}>
        <div>
          <label style={{ marginRight: '10px', fontWeight: 'bold' }}>Date Range:</label>
          <select
            data-testid="date-range-select"
            value={datePreset}
            onChange={(e) => setDatePreset(e.target.value as DatePreset)}
          >
            <option value="last-3-months">Last 3 Months</option>
            <option value="last-6-months">Last 6 Months</option>
            <option value="this-year">This Year</option>
            <option value="last-year">Last Year</option>
            <option value="custom">Custom Range</option>
          </select>
        </div>

        {datePreset === 'custom' && (
          <>
            <div>
              <label style={{ marginRight: '5px' }}>From:</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div>
              <label style={{ marginRight: '5px' }}>To:</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </>
        )}

        <div>
          <label style={{ marginRight: '10px', fontWeight: 'bold' }}>Group By:</label>
          <select
            data-testid="grouping-select"
            value={grouping}
            onChange={(e) => setGrouping(e.target.value as Grouping)}
          >
            <option value="day">Daily</option>
            <option value="week">Weekly</option>
            <option value="month">Monthly</option>
            <option value="year">Yearly</option>
          </select>
        </div>
      </div>

      {/* Chart */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--color-text-muted)' }}>
          Loading trends...
        </div>
      ) : selectedCategories.length === 0 ? (
        <div className="card" style={{ textAlign: 'center' }}>
          <p style={{ color: 'var(--color-text-muted)' }}>Select categories above to view their spending trends over time</p>
        </div>
      ) : chartData.length === 0 ? (
        <div className="card" style={{ textAlign: 'center' }}>
          <p style={{ color: 'var(--color-text-muted)' }}>No data available for the selected date range</p>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '8px' }}>
            <ChartExportButton chartRef={chartRef} filename="category-trends" />
          </div>
          <div ref={chartRef}>
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="period"
                angle={-45}
                textAnchor="end"
                height={80}
                tick={{ fontSize: 12 }}
              />
              <YAxis
                tickFormatter={(value) => `$${(value / 100).toFixed(0)}`}
                tick={{ fontSize: 12 }}
              />
              <Tooltip
                formatter={(value: number | undefined) => value ? `$${(value / 100).toFixed(2)}` : '$0.00'}
                labelStyle={{ fontWeight: 'bold' }}
              />
              <Legend
                verticalAlign="top"
                height={36}
                wrapperStyle={{ paddingBottom: '10px' }}
              />
              {selectedCategories.map(catId => {
                const info = getCategoryInfo(catId);
                return (
                  <Line
                    key={catId}
                    type="monotone"
                    dataKey={catId}
                    name={info.name}
                    stroke={info.color}
                    strokeWidth={2}
                    dot={{ r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                );
              })}
            </LineChart>
          </ResponsiveContainer>
          </div>

          {/* Statistics Table */}
          <div className="card" style={{ marginTop: '30px' }}>
            <h3>Category Statistics</h3>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Category</th>
                  <th style={{ textAlign: 'right' }}>Average</th>
                  <th style={{ textAlign: 'right' }}>Maximum</th>
                  <th style={{ textAlign: 'right' }}>Minimum</th>
                  <th style={{ textAlign: 'center' }}>Trend</th>
                </tr>
              </thead>
              <tbody>
                {selectedCategories.map(catId => {
                  const info = getCategoryInfo(catId);
                  const stats = getCategoryStats(catId);

                  if (!stats) return null;

                  return (
                    <tr key={catId}>
                      <td style={{ display: 'flex', alignItems: 'center' }}>
                        <span style={{
                          width: '12px',
                          height: '12px',
                          borderRadius: '50%',
                          backgroundColor: info.color,
                          marginRight: '8px',
                        }} />
                        {info.name}
                      </td>
                      <td style={{ textAlign: 'right' }}>${(stats.avg / 100).toFixed(2)}</td>
                      <td style={{ textAlign: 'right' }}>${(stats.max / 100).toFixed(2)}</td>
                      <td style={{ textAlign: 'right' }}>${(stats.min / 100).toFixed(2)}</td>
                      <td style={{
                        textAlign: 'center',
                        color: stats.trend === 'increasing' ? 'var(--color-danger)' : stats.trend === 'decreasing' ? 'var(--color-success)' : 'var(--color-text-muted)'
                      }}>
                        {stats.trend === 'increasing' && '📈 Increasing'}
                        {stats.trend === 'decreasing' && '📉 Decreasing'}
                        {stats.trend === 'stable' && '➡️ Stable'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
};

export default CategoryTrends;
