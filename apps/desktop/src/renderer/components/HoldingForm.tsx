import React, { useState, useEffect } from 'react';
import { Holding } from '../../shared/types';

interface HoldingFormProps {
  accountId: string;
  holding?: Holding | null;
  onSave: (holding: Holding) => void;
  onCancel: () => void;
}

const sectors = [
  'Technology',
  'Healthcare',
  'Financial',
  'Consumer Cyclical',
  'Consumer Defensive',
  'Industrials',
  'Energy',
  'Utilities',
  'Real Estate',
  'Materials',
  'Communication Services',
  'Other',
];

export function HoldingForm({ accountId, holding, onSave, onCancel }: HoldingFormProps) {
  const [ticker, setTicker] = useState('');
  const [name, setName] = useState('');
  const [sector, setSector] = useState('');
  const [currentPrice, setCurrentPrice] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [needsInitialLot, setNeedsInitialLot] = useState(false);
  const [createdHoldingId, setCreatedHoldingId] = useState<string | null>(null);

  // Lot form state for add mode
  const [purchaseDate, setPurchaseDate] = useState('');
  const [shares, setShares] = useState('');
  const [costPerShare, setCostPerShare] = useState('');

  useEffect(() => {
    if (holding) {
      setTicker(holding.ticker);
      setName(holding.name);
      setSector(holding.sector || '');
      setCurrentPrice((holding.currentPrice / 100).toFixed(2));
    }
  }, [holding]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validation
    if (!ticker.trim()) {
      setError('Ticker symbol is required');
      return;
    }

    if (!name.trim()) {
      setError('Name is required');
      return;
    }

    if (!currentPrice.trim()) {
      setError('Current price is required');
      return;
    }

    const priceValue = parseFloat(currentPrice);
    if (isNaN(priceValue) || priceValue < 0) {
      setError('Current price must be a valid number');
      return;
    }

    try {
      setLoading(true);

      if (holding) {
        // Edit mode - update holding
        const updated = await window.api.holdings.update(holding.id, {
          ticker: ticker.trim().toUpperCase(),
          name: name.trim(),
          sector: sector.trim() || null,
          currentPrice: Math.round(priceValue * 100), // Convert to cents
          lastPriceUpdate: new Date(),
        });

        if (updated) {
          onSave(updated);
        }
      } else {
        // Add mode - create holding then prompt for initial lot
        const created = await window.api.holdings.create({
          accountId,
          ticker: ticker.trim().toUpperCase(),
          name: name.trim(),
          currentPrice: Math.round(priceValue * 100), // Convert to cents
          sector: sector.trim() || null,
          lastPriceUpdate: new Date(),
        });

        // Show lot form for initial lot
        setCreatedHoldingId(created.id);
        setNeedsInitialLot(true);
      }
    } catch (err) {
      setError(`Error saving holding: ${err}`);
    } finally {
      setLoading(false);
    }
  };

  const handleLotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!createdHoldingId) return;

    // Validation
    if (!purchaseDate) {
      setError('Purchase date is required');
      return;
    }

    if (!shares.trim()) {
      setError('Shares is required');
      return;
    }

    if (!costPerShare.trim()) {
      setError('Cost per share is required');
      return;
    }

    const sharesValue = parseFloat(shares);
    if (isNaN(sharesValue) || sharesValue <= 0) {
      setError('Shares must be greater than 0');
      return;
    }

    const costValue = parseFloat(costPerShare);
    if (isNaN(costValue) || costValue < 0) {
      setError('Cost per share must be a valid number');
      return;
    }

    const date = new Date(purchaseDate);
    if (date > new Date()) {
      setError('Purchase date cannot be in the future');
      return;
    }

    try {
      setLoading(true);

      // Create initial lot
      await window.api.lots.create({
        holdingId: createdHoldingId,
        purchaseDate: date,
        shares: Math.round(sharesValue * 10000), // Convert to shares*10000
        costPerShare: Math.round(costValue * 100), // Convert to cents
        remainingShares: Math.round(sharesValue * 10000), // Initially all shares remain
      });

      // Fetch the updated holding to return
      const updated = await window.api.holdings.getById(createdHoldingId);
      if (updated) {
        onSave(updated);
      }
    } catch (err) {
      setError(`Error creating lot: ${err}`);
    } finally {
      setLoading(false);
    }
  };

  const calculateTotalCost = (): number => {
    const sharesValue = parseFloat(shares);
    const costValue = parseFloat(costPerShare);
    if (isNaN(sharesValue) || isNaN(costValue)) return 0;
    return sharesValue * costValue;
  };

  return (
    <div className="holding-form">
      {!needsInitialLot ? (
        <>
          <h4 className="form-title">{holding ? 'Edit Holding' : 'New Holding'}</h4>

          {error && (
            <div
              style={{
                padding: 'var(--space-3)',
                marginBottom: 'var(--space-4)',
                background: 'var(--color-danger-bg)',
                color: 'var(--color-danger)',
                borderRadius: 'var(--radius-md)',
              }}
            >
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="ticker">Ticker Symbol *</label>
                <input
                  id="ticker"
                  type="text"
                  value={ticker}
                  onChange={(e) => setTicker(e.target.value.toUpperCase())}
                  disabled={loading || !!holding}
                  placeholder="AAPL"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="name">Name *</label>
                <input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={loading}
                  placeholder="Apple Inc."
                  required
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="sector">Sector</label>
                <select
                  id="sector"
                  value={sector}
                  onChange={(e) => setSector(e.target.value)}
                  disabled={loading}
                >
                  <option value="">Select sector...</option>
                  {sectors.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="currentPrice">Current Price *</label>
                <input
                  id="currentPrice"
                  type="number"
                  step="0.01"
                  value={currentPrice}
                  onChange={(e) => setCurrentPrice(e.target.value)}
                  disabled={loading}
                  placeholder="175.50"
                  required
                />
              </div>
            </div>

            <div className="form-actions">
              <button type="button" onClick={onCancel} disabled={loading} className="btn btn-secondary">
                Cancel
              </button>
              <button type="submit" disabled={loading} className="btn btn-primary">
                {holding ? 'Save Changes' : 'Create Holding'}
              </button>
            </div>
          </form>
        </>
      ) : (
        <>
          <h4 className="form-title">Add Initial Lot</h4>
          <p style={{ marginBottom: 'var(--space-4)', color: 'var(--color-text-muted)' }}>
            Holdings require at least one lot. Add the initial purchase details below.
          </p>

          {error && (
            <div
              style={{
                padding: 'var(--space-3)',
                marginBottom: 'var(--space-4)',
                background: 'var(--color-danger-bg)',
                color: 'var(--color-danger)',
                borderRadius: 'var(--radius-md)',
              }}
            >
              {error}
            </div>
          )}

          <form onSubmit={handleLotSubmit}>
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="purchaseDate">Purchase Date *</label>
                <input
                  id="purchaseDate"
                  type="date"
                  value={purchaseDate}
                  onChange={(e) => setPurchaseDate(e.target.value)}
                  disabled={loading}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="shares">Shares *</label>
                <input
                  id="shares"
                  type="number"
                  step="0.0001"
                  value={shares}
                  onChange={(e) => setShares(e.target.value)}
                  disabled={loading}
                  placeholder="10"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="costPerShare">Cost Per Share *</label>
                <input
                  id="costPerShare"
                  type="number"
                  step="0.01"
                  value={costPerShare}
                  onChange={(e) => setCostPerShare(e.target.value)}
                  disabled={loading}
                  placeholder="165.00"
                  required
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Total Cost</label>
                <div className="calculated">
                  {new Intl.NumberFormat('en-US', {
                    style: 'currency',
                    currency: 'USD',
                  }).format(calculateTotalCost())}
                </div>
              </div>
            </div>

            <div className="form-actions">
              <button type="button" onClick={onCancel} disabled={loading} className="btn btn-secondary">
                Cancel
              </button>
              <button type="submit" disabled={loading} className="btn btn-primary">
                Add Lot
              </button>
            </div>
          </form>
        </>
      )}
    </div>
  );
}
