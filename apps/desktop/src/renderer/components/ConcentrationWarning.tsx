import { useState, useEffect, useMemo } from 'react';
import { Investment, InvestmentSettings } from '../../shared/types';

interface ConcentrationWarningProps {
  investments: Investment[];
  onSettingsClick?: () => void;
}

interface OverweightPosition {
  investment: Investment;
  percentage: number;
  exceededBy: number;
}

const DEFAULT_THRESHOLD = 25;

export function ConcentrationWarning({ investments, onSettingsClick }: ConcentrationWarningProps) {
  const [settings, setSettings] = useState<InvestmentSettings | null>(null);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const data = await window.api.investmentSettings.get();
      setSettings(data);
    } catch (error) {
      console.error('Failed to load investment settings:', error);
    }
  };

  const threshold = settings?.concentrationThreshold ?? DEFAULT_THRESHOLD;

  const totalValue = useMemo(() => {
    return investments.reduce((sum, inv) => sum + (inv.shares * inv.currentPrice), 0);
  }, [investments]);

  const overweightPositions: OverweightPosition[] = useMemo(() => {
    if (totalValue === 0) return [];

    return investments
      .map(inv => {
        const value = inv.shares * inv.currentPrice;
        const percentage = (value / totalValue) * 100;
        return {
          investment: inv,
          percentage,
          exceededBy: percentage - threshold,
        };
      })
      .filter(pos => pos.exceededBy > 0)
      .sort((a, b) => b.exceededBy - a.exceededBy);
  }, [investments, totalValue, threshold]);

  // Calculate sector concentration as well
  const sectorConcentration = useMemo(() => {
    if (totalValue === 0) return [];

    const sectorMap = new Map<string, number>();
    investments.forEach(inv => {
      const sector = (inv as unknown as { sector?: string }).sector || 'Uncategorized';
      const value = inv.shares * inv.currentPrice;
      sectorMap.set(sector, (sectorMap.get(sector) || 0) + value);
    });

    return Array.from(sectorMap.entries())
      .map(([sector, value]) => ({
        sector,
        percentage: (value / totalValue) * 100,
        exceededBy: ((value / totalValue) * 100) - threshold,
      }))
      .filter(s => s.exceededBy > 0)
      .sort((a, b) => b.exceededBy - a.exceededBy);
  }, [investments, totalValue, threshold]);

  const hasWarnings = overweightPositions.length > 0 || sectorConcentration.length > 0;

  if (!hasWarnings || isDismissed) return null;

  return (
    <div className="concentration-warning-banner">
      <div className="warning-icon">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/>
        </svg>
      </div>

      <div className="warning-content">
        <div className="warning-title">
          Concentration Warning
        </div>
        <div className="warning-message">
          {overweightPositions.length > 0 && (
            <span>
              {overweightPositions.length} position{overweightPositions.length !== 1 ? 's' : ''} exceed{overweightPositions.length === 1 ? 's' : ''} {threshold}% of portfolio:
              {' '}
              <strong>
                {overweightPositions.slice(0, 3).map(p => p.investment.ticker || p.investment.name).join(', ')}
                {overweightPositions.length > 3 && ` +${overweightPositions.length - 3} more`}
              </strong>
            </span>
          )}
          {sectorConcentration.length > 0 && overweightPositions.length > 0 && ' | '}
          {sectorConcentration.length > 0 && (
            <span>
              {sectorConcentration.length} sector{sectorConcentration.length !== 1 ? 's' : ''} overweight:
              {' '}
              <strong>{sectorConcentration.map(s => s.sector).join(', ')}</strong>
            </span>
          )}
        </div>
      </div>

      <div className="warning-actions">
        {onSettingsClick && (
          <button className="settings-btn" onClick={onSettingsClick}>
            Adjust Threshold ({threshold}%)
          </button>
        )}
        <button className="dismiss-btn" onClick={() => setIsDismissed(true)}>
          Dismiss
        </button>
      </div>
    </div>
  );
}

// Badge component for individual holding rows
export function ConcentrationBadge({
  percentage,
  threshold = DEFAULT_THRESHOLD,
}: {
  percentage: number;
  threshold?: number;
}) {
  if (percentage <= threshold) return null;

  return (
    <span className="concentration-badge" title={`Position exceeds ${threshold}% threshold`}>
      {percentage.toFixed(1)}%
    </span>
  );
}

// Settings modal component for configuring threshold
interface ConcentrationSettingsProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  currentThreshold: number;
}

export function ConcentrationSettings({
  isOpen,
  onClose,
  onSave,
  currentThreshold,
}: ConcentrationSettingsProps) {
  const [threshold, setThreshold] = useState(currentThreshold);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setThreshold(currentThreshold);
  }, [currentThreshold, isOpen]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await window.api.investmentSettings.update({
        concentrationThreshold: threshold,
      });
      onSave();
      onClose();
    } catch (error) {
      console.error('Failed to save settings:', error);
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content concentration-settings-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Concentration Settings</h3>
          <button className="close-btn" onClick={onClose}>&times;</button>
        </div>

        <div className="settings-form">
          <div className="form-group">
            <label>Concentration Warning Threshold</label>
            <div className="threshold-input">
              <input
                type="range"
                min="5"
                max="50"
                step="5"
                value={threshold}
                onChange={e => setThreshold(Number(e.target.value))}
              />
              <span className="threshold-value">{threshold}%</span>
            </div>
            <p className="form-help">
              You&apos;ll receive a warning when any single position or sector exceeds this percentage of your portfolio.
            </p>
          </div>

          <div className="threshold-presets">
            <span className="presets-label">Quick select:</span>
            {[10, 15, 20, 25, 30].map(preset => (
              <button
                key={preset}
                className={threshold === preset ? 'active' : ''}
                onClick={() => setThreshold(preset)}
              >
                {preset}%
              </button>
            ))}
          </div>
        </div>

        <div className="modal-actions">
          <button className="cancel-btn" onClick={onClose}>
            Cancel
          </button>
          <button className="save-btn" onClick={handleSave} disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
