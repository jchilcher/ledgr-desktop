import React, { useState, useEffect, useCallback } from 'react';
import { Category, RecurringItem } from '../../shared/types';
import WhatIfModificationForm from './WhatIfModificationForm';
import {
  useWhatIfProjections,
  WhatIfModification,
  WhatIfProjectionPoint,
} from '../hooks/useWhatIfProjections';

interface ForecastData {
  currentBalance: number;
  projections: Array<{
    date: string;
    balance: number;
  }>;
}

interface WhatIfPanelProps {
  forecast: ForecastData;
  categories: Category[];
  onProjectionsChange: (projections: WhatIfProjectionPoint[] | null) => void;
  onClose: () => void;
  onForecastReload: () => void;
}

const formatCurrency = (amountInCents: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amountInCents / 100);
};

const WhatIfPanel: React.FC<WhatIfPanelProps> = ({
  forecast,
  categories,
  onProjectionsChange,
  onClose,
  onForecastReload,
}) => {
  const [recurringItems, setRecurringItems] = useState<RecurringItem[]>([]);
  const [modifications, setModifications] = useState<WhatIfModification[]>([]);
  const [applying, setApplying] = useState(false);
  const [applySuccess, setApplySuccess] = useState(false);

  useEffect(() => {
    window.api.recurring.getActive().then(items => {
      setRecurringItems(items);
    });
  }, []);

  const whatIfResult = useWhatIfProjections(
    forecast.projections,
    forecast.currentBalance,
    modifications,
    recurringItems,
  );

  useEffect(() => {
    onProjectionsChange(whatIfResult?.modifiedProjections ?? null);
  }, [whatIfResult, onProjectionsChange]);

  const handleAddModification = useCallback((mod: WhatIfModification) => {
    setModifications(prev => [...prev, mod]);
  }, []);

  const handleRemoveModification = useCallback((index: number) => {
    setModifications(prev => prev.filter((_, i) => i !== index));
  }, []);

  const handleClear = useCallback(() => {
    setModifications([]);
  }, []);

  const handleApply = async () => {
    setApplying(true);
    setApplySuccess(false);
    try {
      for (const mod of modifications) {
        if (mod.type === 'pause_expense' && mod.recurringItemId) {
          await window.api.recurring.update(mod.recurringItemId, { isActive: false });
        }
      }
      setModifications([]);
      onForecastReload();
      setApplySuccess(true);
      setTimeout(() => setApplySuccess(false), 3000);
    } finally {
      setApplying(false);
    }
  };

  const hasApplicableChanges = modifications.some(m => m.type === 'pause_expense' && m.recurringItemId);
  const comparison = whatIfResult?.comparison;

  return (
    <div style={{
      marginBottom: '20px',
      border: '2px solid var(--color-primary)',
      borderRadius: 'var(--radius-md)',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '12px 16px',
        backgroundColor: 'var(--color-primary)',
        color: 'white',
      }}>
        <span style={{ fontWeight: 600, fontSize: '14px' }}>
          What-If Mode
        </span>
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            color: 'white',
            cursor: 'pointer',
            fontSize: '18px',
            padding: '0 4px',
            lineHeight: 1,
          }}
        >
          x
        </button>
      </div>

      <div style={{ padding: '16px' }}>
        {/* Modification Form */}
        <WhatIfModificationForm
          recurringItems={recurringItems}
          categories={categories}
          onAddModification={handleAddModification}
        />

        {/* Modification chips */}
        {modifications.length > 0 && (
          <div style={{ marginTop: '12px' }}>
            <div style={{ fontWeight: 500, marginBottom: '4px', fontSize: '13px' }}>
              Modifications ({modifications.length})
            </div>
            <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginBottom: '8px' }}>
              Only bill pause/resume changes are saved. Category and income adjustments are for projection only.
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {modifications.map((mod, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '6px 10px',
                    backgroundColor: 'var(--color-surface)',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--color-border)',
                    fontSize: '13px',
                  }}
                >
                  <span>{mod.label}</span>
                  <button
                    onClick={() => handleRemoveModification(i)}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: 'var(--color-text-muted)',
                      fontSize: '16px',
                      padding: '0 4px',
                      lineHeight: 1,
                    }}
                  >
                    x
                  </button>
                </div>
              ))}
              <button
                onClick={handleClear}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--color-text-muted)',
                  fontSize: '12px',
                  textDecoration: 'underline',
                }}
              >
                Clear all
              </button>
            </div>
          </div>
        )}

        {/* Comparison Summary */}
        {comparison && (
          <div style={{
            marginTop: '16px',
            padding: '12px',
            backgroundColor: 'var(--color-surface)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--color-border)',
          }}>
            <div style={{ fontWeight: 500, marginBottom: '10px', fontSize: '13px' }}>
              Impact Summary
            </div>

            {/* Comparison grid */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr auto auto auto',
              gap: '6px 16px',
              fontSize: '13px',
              alignItems: 'center',
            }}>
              {/* Header row */}
              <div style={{ fontWeight: 600, color: 'var(--color-text-muted)', fontSize: '11px', textTransform: 'uppercase' }}>
                Metric
              </div>
              <div style={{ fontWeight: 600, color: 'var(--color-text-muted)', fontSize: '11px', textTransform: 'uppercase', textAlign: 'right' }}>
                Original
              </div>
              <div style={{ fontWeight: 600, color: 'var(--color-primary)', fontSize: '11px', textTransform: 'uppercase', textAlign: 'right' }}>
                What-If
              </div>
              <div style={{ fontWeight: 600, color: 'var(--color-text-muted)', fontSize: '11px', textTransform: 'uppercase', textAlign: 'right' }}>
                Delta
              </div>

              {/* Ending balance */}
              <div>Ending Balance</div>
              <div style={{
                textAlign: 'right',
                color: comparison.originalEndingBalance < 0 ? 'var(--color-danger)' : 'var(--color-text)',
              }}>
                {formatCurrency(comparison.originalEndingBalance)}
              </div>
              <div style={{
                textAlign: 'right',
                fontWeight: 600,
                color: comparison.modifiedEndingBalance < 0 ? 'var(--color-danger)' : 'var(--color-success)',
              }}>
                {formatCurrency(comparison.modifiedEndingBalance)}
              </div>
              <div style={{
                textAlign: 'right',
                color: (comparison.modifiedEndingBalance - comparison.originalEndingBalance) >= 0
                  ? 'var(--color-success)'
                  : 'var(--color-danger)',
              }}>
                {(comparison.modifiedEndingBalance - comparison.originalEndingBalance) >= 0 ? '+' : ''}
                {formatCurrency(comparison.modifiedEndingBalance - comparison.originalEndingBalance)}
              </div>

              {/* Lowest balance */}
              <div>Lowest Balance</div>
              <div style={{
                textAlign: 'right',
                color: comparison.originalLowestBalance < 0 ? 'var(--color-danger)' : 'var(--color-text)',
              }}>
                {formatCurrency(comparison.originalLowestBalance)}
              </div>
              <div style={{
                textAlign: 'right',
                fontWeight: 600,
                color: comparison.modifiedLowestBalance < 0 ? 'var(--color-danger)' : 'var(--color-success)',
              }}>
                {formatCurrency(comparison.modifiedLowestBalance)}
              </div>
              <div style={{
                textAlign: 'right',
                color: (comparison.modifiedLowestBalance - comparison.originalLowestBalance) >= 0
                  ? 'var(--color-success)'
                  : 'var(--color-danger)',
              }}>
                {(comparison.modifiedLowestBalance - comparison.originalLowestBalance) >= 0 ? '+' : ''}
                {formatCurrency(comparison.modifiedLowestBalance - comparison.originalLowestBalance)}
              </div>

              {/* Days until negative */}
              <div>Days Until Negative</div>
              <div style={{
                textAlign: 'right',
                color: comparison.originalDaysUntilNegative !== null ? 'var(--color-danger)' : 'var(--color-success)',
              }}>
                {comparison.originalDaysUntilNegative !== null ? `${comparison.originalDaysUntilNegative} days` : 'Safe'}
              </div>
              <div style={{
                textAlign: 'right',
                fontWeight: 600,
                color: comparison.modifiedDaysUntilNegative !== null ? 'var(--color-danger)' : 'var(--color-success)',
              }}>
                {comparison.modifiedDaysUntilNegative !== null ? `${comparison.modifiedDaysUntilNegative} days` : 'Safe'}
              </div>
              <div style={{
                textAlign: 'right',
                color: 'var(--color-text-muted)',
              }}>
                {comparison.originalDaysUntilNegative !== null && comparison.modifiedDaysUntilNegative !== null
                  ? `${comparison.modifiedDaysUntilNegative - comparison.originalDaysUntilNegative > 0 ? '+' : ''}${comparison.modifiedDaysUntilNegative - comparison.originalDaysUntilNegative} days`
                  : comparison.originalDaysUntilNegative !== null && comparison.modifiedDaysUntilNegative === null
                  ? 'Resolved'
                  : '-'}
              </div>

              {/* Monthly savings */}
              <div>Monthly Savings</div>
              <div style={{ textAlign: 'right' }}>-</div>
              <div style={{
                textAlign: 'right',
                fontWeight: 600,
                color: 'var(--color-success)',
              }}>
                {formatCurrency(comparison.totalMonthlySavings)}
              </div>
              <div style={{ textAlign: 'right', color: 'var(--color-text-muted)' }}>
                /mo
              </div>
            </div>

            {/* Apply button */}
            {hasApplicableChanges && (
              <button
                onClick={handleApply}
                disabled={applying}
                className="btn btn-success"
                style={{ width: '100%', marginTop: '12px' }}
              >
                {applying ? 'Pausing...' : 'Pause Selected Bills'}
              </button>
            )}
            {applySuccess && (
              <div style={{
                marginTop: '8px',
                padding: '8px 12px',
                backgroundColor: 'var(--color-success)',
                color: 'white',
                borderRadius: 'var(--radius-sm)',
                fontSize: '13px',
                textAlign: 'center',
              }}>
                Selected bills have been paused successfully.
              </div>
            )}
          </div>
        )}

        {modifications.length === 0 && (
          <div style={{
            marginTop: '12px',
            padding: '20px',
            textAlign: 'center',
            color: 'var(--color-text-muted)',
            fontSize: '13px',
            backgroundColor: 'var(--color-surface)',
            borderRadius: 'var(--radius-md)',
            border: '1px dashed var(--color-border)',
          }}>
            Add modifications above to see how they would affect your forecast
          </div>
        )}
      </div>
    </div>
  );
};

export default WhatIfPanel;
