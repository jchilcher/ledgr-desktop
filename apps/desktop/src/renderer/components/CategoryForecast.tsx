import React, { useState, useEffect } from 'react';
import { Category } from '../../shared/types';
import { CategorySpendingForecast } from '../../shared/window';
import EmptyState from './EmptyState';

const CategoryForecast: React.FC = () => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [forecasts, setForecasts] = useState<CategorySpendingForecast[]>([]);
  const [loading, setLoading] = useState(true);
  const [forecastDays, setForecastDays] = useState<number>(30);
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());

  // Fixed 90 days history for consistency
  const historyDays = 90;

  // Load categories and forecasts
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const cats = await window.api.categories.getAll();
        setCategories(cats);

        const forecastData = await window.api.forecast.allCategories(forecastDays, historyDays);
        setForecasts(forecastData);
      } catch (error) {
        console.error('Failed to load forecasts:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [forecastDays]);

  // Get category name by ID
  const getCategoryName = (categoryId: string) => {
    const cat = categories.find(c => c.id === categoryId);
    return cat?.name || 'Unknown';
  };

  // Get category color by ID
  const getCategoryColor = (categoryId: string) => {
    const cat = categories.find(c => c.id === categoryId);
    return cat?.color || '#888888';
  };

  // Toggle card expansion
  const toggleCard = (categoryId: string) => {
    setExpandedCards(prev => {
      const next = new Set(prev);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });
  };

  // Plain language translations
  const getConfidenceLabel = (confidence: number): { text: string; quality: 'good' | 'fair' | 'limited' } => {
    if (confidence >= 0.7) return { text: 'Good estimate', quality: 'good' };
    if (confidence >= 0.4) return { text: 'Fair estimate', quality: 'fair' };
    return { text: 'Limited data', quality: 'limited' };
  };

  const getTrendText = (forecast: CategorySpendingForecast): string => {
    const change = forecast.projectedSpending - forecast.historicalAverage;
    const changePercent = forecast.historicalAverage > 0
      ? Math.abs((change / forecast.historicalAverage) * 100)
      : 0;

    if (forecast.trend === 'increasing') {
      return `Spending up ~${Math.round(changePercent)}%`;
    }
    if (forecast.trend === 'decreasing') {
      return `Spending down ~${Math.round(changePercent)}%`;
    }
    return 'About the same as usual';
  };

  const getSeasonalNote = (factor: number): string | null => {
    if (factor > 1.1) return 'Spending typically higher this time of year';
    if (factor < 0.9) return 'Spending typically lower this time of year';
    return null;
  };

  // Calculate total projected spending
  const totalProjected = forecasts.reduce((sum, f) => sum + f.projectedSpending, 0);

  // Calculate progress percentage (projected vs typical)
  const getProgressPercent = (forecast: CategorySpendingForecast): number => {
    if (forecast.historicalAverage === 0) return 50;
    const ratio = forecast.projectedSpending / forecast.historicalAverage;
    // Cap between 0 and 200 for display, then normalize to 0-100
    return Math.min(100, Math.max(0, (ratio / 2) * 100));
  };

  // Sort forecasts by projected amount (highest first)
  const sortedForecasts = [...forecasts].sort((a, b) => b.projectedSpending - a.projectedSpending);

  // Forecast period labels
  const periodLabels: { [key: number]: string } = {
    7: 'Next week',
    14: 'Next 2 weeks',
    30: 'Next month',
    60: 'Next 2 months',
    90: 'Next 3 months',
  };

  return (
    <div style={{ padding: '20px', maxWidth: '800px' }}>
      <h2>Spending Forecast</h2>
      <p style={{ color: 'var(--color-text-muted)', marginBottom: '24px' }}>
        See what you&apos;re likely to spend based on your history
      </p>

      {/* Simplified Controls */}
      <div style={{
        display: 'flex',
        gap: '16px',
        marginBottom: '24px',
        alignItems: 'center',
      }}>
        <label style={{ fontWeight: '500', color: 'var(--color-text)' }}>Show forecast for:</label>
        <select
          value={forecastDays}
          onChange={(e) => setForecastDays(Number(e.target.value))}
          style={{ minWidth: '150px' }}
        >
          <option value={7}>Next week</option>
          <option value={14}>Next 2 weeks</option>
          <option value={30}>Next month</option>
          <option value={60}>Next 2 months</option>
          <option value={90}>Next 3 months</option>
        </select>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--color-text-muted)' }}>
          Loading forecasts...
        </div>
      ) : forecasts.length === 0 ? (
        <EmptyState
          icon="🔮"
          title="No forecast data available yet"
          description="Import transactions to see category spending predictions."
        />
      ) : (
        <>
          {/* Total Summary Card */}
          <div className="card" style={{ marginBottom: '24px', textAlign: 'center' }}>
            <div style={{ color: 'var(--color-text-muted)', fontSize: '14px', marginBottom: '8px' }}>
              Total Projected Spending
            </div>
            <div style={{ fontSize: '36px', fontWeight: '700', color: 'var(--color-text)' }}>
              ${(totalProjected / 100).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </div>
            <div style={{ color: 'var(--color-text-muted)', fontSize: '14px', marginTop: '4px' }}>
              {periodLabels[forecastDays] || `for the next ${forecastDays} days`}
            </div>
          </div>

          {/* Category Cards */}
          <div className="card-grid" style={{ gap: '12px' }}>
            {sortedForecasts.map((forecast) => {
              const categoryName = getCategoryName(forecast.categoryId);
              const categoryColor = getCategoryColor(forecast.categoryId);
              const isExpanded = expandedCards.has(forecast.categoryId);
              const confidenceInfo = getConfidenceLabel(forecast.confidence);
              const trendText = getTrendText(forecast);
              const seasonalNote = getSeasonalNote(forecast.seasonalityFactor);
              const progressPercent = getProgressPercent(forecast);

              return (
                <div
                  key={forecast.categoryId}
                  className="card"
                  style={{ padding: '16px' }}
                >
                  {/* Main Content */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span
                        style={{
                          width: '12px',
                          height: '12px',
                          borderRadius: '50%',
                          backgroundColor: categoryColor,
                          flexShrink: 0,
                        }}
                      />
                      <span style={{ fontWeight: '600', color: 'var(--color-text)' }}>
                        {categoryName}
                      </span>
                    </div>
                    <span style={{ fontSize: '20px', fontWeight: '700', color: 'var(--color-text)' }}>
                      ${(forecast.projectedSpending / 100).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </span>
                  </div>

                  {/* Trend Text */}
                  <div style={{
                    fontSize: '14px',
                    color: forecast.trend === 'increasing' ? 'var(--color-danger)' :
                           forecast.trend === 'decreasing' ? 'var(--color-success)' : 'var(--color-text-muted)',
                    marginBottom: '12px',
                  }}>
                    {trendText}
                  </div>

                  {/* Progress Bar */}
                  <div className="forecast-progress-bar">
                    <div
                      className="forecast-progress-fill"
                      style={{
                        width: `${progressPercent}%`,
                        backgroundColor: categoryColor,
                      }}
                    />
                    <div className="forecast-progress-midline" />
                  </div>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: '11px',
                    color: 'var(--color-text-muted)',
                    marginTop: '4px',
                  }}>
                    <span>Lower</span>
                    <span>Typical</span>
                    <span>Higher</span>
                  </div>

                  {/* Show More Button */}
                  <button
                    onClick={() => toggleCard(forecast.categoryId)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--color-primary)',
                      fontSize: '13px',
                      cursor: 'pointer',
                      padding: '8px 0 0 0',
                      marginTop: '8px',
                    }}
                  >
                    {isExpanded ? 'Show less' : 'Show more'}
                  </button>

                  {/* Expanded Details */}
                  {isExpanded && (
                    <div style={{
                      marginTop: '16px',
                      paddingTop: '16px',
                      borderTop: '1px solid var(--color-border)',
                      fontSize: '14px',
                    }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: 'var(--color-text-muted)' }}>Typical monthly spend:</span>
                          <span style={{ color: 'var(--color-text)' }}>
                            ${(forecast.historicalAverage / 100).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                          </span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: 'var(--color-text-muted)' }}>Forecast quality:</span>
                          <span style={{
                            color: confidenceInfo.quality === 'good' ? 'var(--color-success)' :
                                   confidenceInfo.quality === 'fair' ? 'var(--color-warning)' : 'var(--color-text-muted)',
                          }}>
                            {confidenceInfo.text}
                          </span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: 'var(--color-text-muted)' }}>Based on:</span>
                          <span style={{ color: 'var(--color-text)' }}>
                            {forecast.transactionCount} transaction{forecast.transactionCount !== 1 ? 's' : ''}
                          </span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: 'var(--color-text-muted)' }}>Expected range:</span>
                          <span style={{ color: 'var(--color-text)' }}>
                            ${(forecast.confidenceInterval.lower / 100).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} – ${(forecast.confidenceInterval.upper / 100).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                          </span>
                        </div>
                        {seasonalNote && (
                          <div style={{
                            marginTop: '8px',
                            padding: '8px 12px',
                            backgroundColor: 'var(--color-warning-bg)',
                            borderRadius: 'var(--radius-sm)',
                            color: 'var(--color-warning)',
                            fontSize: '13px',
                          }}>
                            {seasonalNote}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};

export default CategoryForecast;
