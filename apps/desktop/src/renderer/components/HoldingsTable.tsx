import React, { useState, useEffect } from 'react';
import { Holding, CostBasisLot, InvestmentTransaction } from '../../shared/types';
import { HoldingForm } from './HoldingForm';
import { LotForm } from './LotForm';
import { usePrices, usePricesStaleness } from '../hooks/usePrices';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { PriceDisplay } from './PriceDisplay';
import { StalenessIndicator, OfflineIndicator } from './StalenessIndicator';
import { RefreshPricesButton } from './RefreshPricesButton';
import { ManualPriceModal } from './ManualPriceModal';
import { HoldingsImport } from './HoldingsImport';
import { TransactionEntryModal } from './TransactionEntryModal';
import { TransactionHistory } from './TransactionHistory';

interface HoldingsTableProps {
  accountId: string;
  accountName?: string;
  onBack?: () => void;
}

type SortColumn =
  | 'ticker'
  | 'shares'
  | 'price'
  | 'value'
  | 'gain'
  | 'costBasis'
  | 'avgCost'
  | 'sector';

type SortDirection = 'asc' | 'desc';

export function HoldingsTable({ accountId, accountName, onBack }: HoldingsTableProps) {
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [lotsMap, setLotsMap] = useState<Map<string, CostBasisLot[]>>(new Map());
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [showHoldingForm, setShowHoldingForm] = useState(false);
  const [editingHolding, setEditingHolding] = useState<Holding | null>(null);
  const [showLotForm, setShowLotForm] = useState<string | null>(null); // holdingId
  const [editingLot, setEditingLot] = useState<CostBasisLot | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{
    type: 'holding' | 'lot';
    item: Holding | CostBasisLot;
  } | null>(null);
  const [sortColumn, setSortColumn] = useState<SortColumn>('value');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [loading, setLoading] = useState(false);
  const [undoTimer, setUndoTimer] = useState<NodeJS.Timeout | null>(null);
  const [deletedItem, setDeletedItem] = useState<{
    type: 'holding' | 'lot';
    item: Holding | CostBasisLot;
    lots?: CostBasisLot[];
  } | null>(null);
  const [manualPriceModal, setManualPriceModal] = useState<{
    symbol: string;
    currentPrice: number | null;
    isManual: boolean;
  } | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [showTransactionModal, setShowTransactionModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [selectedHoldingForTx, setSelectedHoldingForTx] = useState<Holding | null>(null);
  const [editingTransaction, setEditingTransaction] = useState<InvestmentTransaction | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);

  // Get unique ticker symbols from holdings
  const symbols = holdings.map(h => h.ticker);

  // Fetch prices for all holdings
  const { data: pricesMap } = usePrices(symbols);

  // Check staleness
  const { data: stalenessInfo } = usePricesStaleness(symbols);

  // Network status
  const isOnline = useNetworkStatus();

  useEffect(() => {
    loadHoldings();
  }, [accountId]);

  const loadHoldings = async () => {
    try {
      setLoading(true);
      const accountHoldings = await window.api.holdings.getByAccount(accountId);
      setHoldings(accountHoldings);
      setSelectedIds(new Set());

      // Load lots for each holding
      const newLotsMap = new Map<string, CostBasisLot[]>();
      for (const holding of accountHoldings) {
        const lots = await window.api.lots.getByHolding(holding.id);
        newLotsMap.set(holding.id, lots);
      }
      setLotsMap(newLotsMap);
    } catch (err) {
      console.error('Error loading holdings:', err);
    } finally {
      setLoading(false);
    }
  };

  // Conversion functions
  const intToShares = (int: number): number => int / 10000;
  const centsToDollars = (cents: number): number => cents / 100;

  // Calculations
  const calculateMarketValue = (holding: Holding): number => {
    return (holding.sharesOwned * holding.currentPrice) / 10000; // cents
  };

  const calculateCostBasis = (holding: Holding): number => {
    return (holding.sharesOwned * holding.avgCostPerShare) / 10000; // cents
  };

  const calculateGainLoss = (holding: Holding): number => {
    const marketValue = calculateMarketValue(holding);
    const costBasis = calculateCostBasis(holding);
    return marketValue - costBasis;
  };

  const getPortfolioTotal = (): number => {
    return holdings.reduce((sum, h) => sum + calculateMarketValue(h), 0);
  };

  const calculatePortfolioPercent = (holding: Holding): number => {
    const portfolioTotal = getPortfolioTotal();
    if (portfolioTotal === 0) return 0;
    const marketValue = calculateMarketValue(holding);
    return (marketValue / portfolioTotal) * 100;
  };

  // Sorting
  const sortHoldings = (holdingsToSort: Holding[]): Holding[] => {
    return [...holdingsToSort].sort((a, b) => {
      let aValue: number | string;
      let bValue: number | string;

      switch (sortColumn) {
        case 'ticker':
          aValue = a.ticker;
          bValue = b.ticker;
          break;
        case 'shares':
          aValue = a.sharesOwned;
          bValue = b.sharesOwned;
          break;
        case 'price':
          aValue = a.currentPrice;
          bValue = b.currentPrice;
          break;
        case 'value':
          aValue = calculateMarketValue(a);
          bValue = calculateMarketValue(b);
          break;
        case 'gain':
          aValue = calculateGainLoss(a);
          bValue = calculateGainLoss(b);
          break;
        case 'costBasis':
          aValue = calculateCostBasis(a);
          bValue = calculateCostBasis(b);
          break;
        case 'avgCost':
          aValue = a.avgCostPerShare;
          bValue = b.avgCostPerShare;
          break;
        case 'sector':
          aValue = a.sector || '';
          bValue = b.sector || '';
          break;
        default:
          aValue = calculateMarketValue(a);
          bValue = calculateMarketValue(b);
      }

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortDirection === 'asc'
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }

      return sortDirection === 'asc'
        ? (aValue as number) - (bValue as number)
        : (bValue as number) - (aValue as number);
    });
  };

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection(column === 'ticker' || column === 'sector' ? 'asc' : 'desc');
    }
  };

  const toggleRow = (holdingId: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(holdingId)) {
      newExpanded.delete(holdingId);
    } else {
      newExpanded.add(holdingId);
    }
    setExpandedRows(newExpanded);
  };

  // CRUD handlers
  const handleAddHolding = () => {
    setEditingHolding(null);
    setShowHoldingForm(true);
  };

  const handleEditHolding = (holding: Holding) => {
    setEditingHolding(holding);
    setShowHoldingForm(true);
  };

  const handleSaveHolding = async (_holding: Holding) => {
    setShowHoldingForm(false);
    setEditingHolding(null);
    await loadHoldings();
  };

  const handleCancelHoldingForm = () => {
    setShowHoldingForm(false);
    setEditingHolding(null);
  };

  const handleDeleteHolding = (holding: Holding) => {
    // Lots are checked in confirm dialog for count display
    setDeleteConfirm({ type: 'holding', item: holding });
  };

  const handleConfirmDelete = async () => {
    if (!deleteConfirm) return;

    if (deleteConfirm.type === 'holding') {
      const holding = deleteConfirm.item as Holding;
      const lots = lotsMap.get(holding.id) || [];

      try {
        setLoading(true);
        await window.api.holdings.delete(holding.id);

        // Store for undo
        setDeletedItem({ type: 'holding', item: holding, lots });

        // Set up undo timer
        const timer = setTimeout(() => {
          setDeletedItem(null);
        }, 5000);
        setUndoTimer(timer);

        setDeleteConfirm(null);
        await loadHoldings();
      } catch (err) {
        console.error('Error deleting holding:', err);
      } finally {
        setLoading(false);
      }
    } else if (deleteConfirm.type === 'lot') {
      const lot = deleteConfirm.item as CostBasisLot;

      try {
        setLoading(true);
        await window.api.lots.delete(lot.id);

        // Store for undo
        setDeletedItem({ type: 'lot', item: lot });

        // Set up undo timer
        const timer = setTimeout(() => {
          setDeletedItem(null);
        }, 5000);
        setUndoTimer(timer);

        setDeleteConfirm(null);
        await loadHoldings();
      } catch (err) {
        console.error('Error deleting lot:', err);
      } finally {
        setLoading(false);
      }
    }
  };

  const handleUndo = async () => {
    if (!deletedItem) return;

    if (undoTimer) {
      clearTimeout(undoTimer);
      setUndoTimer(null);
    }

    try {
      setLoading(true);

      if (deletedItem.type === 'holding') {
        const holding = deletedItem.item as Holding;
        // Recreate holding - Note: This won't restore the exact same ID
        await window.api.holdings.create({
          accountId: holding.accountId,
          ticker: holding.ticker,
          name: holding.name,
          currentPrice: holding.currentPrice,
          sector: holding.sector,
          lastPriceUpdate: holding.lastPriceUpdate,
        });
      } else if (deletedItem.type === 'lot') {
        const lot = deletedItem.item as CostBasisLot;
        await window.api.lots.create({
          holdingId: lot.holdingId,
          purchaseDate: lot.purchaseDate,
          shares: lot.shares,
          costPerShare: lot.costPerShare,
          remainingShares: lot.remainingShares,
        });
      }

      setDeletedItem(null);
      await loadHoldings();
    } catch (err) {
      console.error('Error restoring item:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddLot = (holdingId: string) => {
    setShowLotForm(holdingId);
    setEditingLot(null);
  };

  const handleEditLot = (lot: CostBasisLot) => {
    setEditingLot(lot);
    setShowLotForm(lot.holdingId);
  };

  const handleSaveLot = async () => {
    setShowLotForm(null);
    setEditingLot(null);
    await loadHoldings();
  };

  const handleCancelLotForm = () => {
    setShowLotForm(null);
    setEditingLot(null);
  };

  const handleDeleteLot = (lot: CostBasisLot) => {
    setDeleteConfirm({ type: 'lot', item: lot });
  };

  // Transaction handlers
  const handleAddTransaction = (holding: Holding) => {
    setSelectedHoldingForTx(holding);
    setEditingTransaction(null);
    setShowTransactionModal(true);
  };

  const handleViewHistory = (holding: Holding) => {
    setSelectedHoldingForTx(holding);
    setShowHistoryModal(true);
  };

  const handleEditTransaction = (tx: InvestmentTransaction) => {
    setEditingTransaction(tx);
    setShowHistoryModal(false);
    setShowTransactionModal(true);
  };

  const handleTransactionSaved = () => {
    loadHoldings();
  };

  const handleHistoryClose = () => {
    setShowHistoryModal(false);
    setSelectedHoldingForTx(null);
  };

  const handleTransactionModalClose = () => {
    setShowTransactionModal(false);
    setEditingTransaction(null);
    if (!showHistoryModal) {
      setSelectedHoldingForTx(null);
    }
  };

  // Bulk selection handlers
  const handleSelectHolding = (id: string, checked: boolean) => {
    const next = new Set(selectedIds);
    if (checked) {
      next.add(id);
    } else {
      next.delete(id);
    }
    setSelectedIds(next);
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(sortedHoldings.map(h => h.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    try {
      setLoading(true);
      await window.api.holdings.bulkDelete(Array.from(selectedIds));
      setBulkDeleteConfirm(false);
      await loadHoldings();
    } catch (err) {
      console.error('Error bulk deleting holdings:', err);
    } finally {
      setLoading(false);
    }
  };

  const getBulkDeleteLotCount = (): number => {
    let count = 0;
    for (const id of selectedIds) {
      count += (lotsMap.get(id) || []).length;
    }
    return count;
  };

  // Formatting
  const formatCurrency = (cents: number): string => {
    const dollars = centsToDollars(cents);
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(dollars);
  };

  const formatShares = (sharesInt: number): string => {
    const shares = intToShares(sharesInt);
    return shares.toLocaleString('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 4
    });
  };

  const formatPercent = (value: number): string => {
    return value.toFixed(2) + '%';
  };

  const formatDate = (date: Date): string => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  // Price helper functions
  const getHoldingPrice = (ticker: string): number | null => {
    if (!pricesMap) return null;
    const entry = pricesMap[ticker.toUpperCase()];
    return entry?.price ?? null;
  };

  const isPriceManual = (ticker: string): boolean => {
    if (!pricesMap) return false;
    return pricesMap[ticker.toUpperCase()]?.manual ?? false;
  };

  // Get the oldest price timestamp for staleness display
  const getOldestPriceTimestamp = (): number | null => {
    if (!pricesMap || Object.keys(pricesMap).length === 0) return null;
    const timestamps = Object.values(pricesMap)
      .map(p => p.timestamp)
      .filter((t): t is number => t !== null && t !== undefined);
    return timestamps.length > 0 ? Math.min(...timestamps) : null;
  };

  const sortedHoldings = sortHoldings(holdings);

  const allSelected = sortedHoldings.length > 0 && sortedHoldings.every(h => selectedIds.has(h.id));
  const someSelected = sortedHoldings.some(h => selectedIds.has(h.id));
  const isIndeterminate = someSelected && !allSelected;

  return (
    <div className="holdings-container">
      <div className="holdings-header">
        <div className="holdings-header-left">
          {onBack && (
            <button
              onClick={onBack}
              className="back-button"
              aria-label="Back to accounts"
            >
              ←
            </button>
          )}
          <h3>Holdings</h3>
          {!isOnline && <OfflineIndicator />}
        </div>
        <div className="holdings-header-right">
          {stalenessInfo?.hasStale && isOnline && (
            <StalenessIndicator timestamp={getOldestPriceTimestamp()} />
          )}
          <RefreshPricesButton
            symbols={symbols}
            onRefreshComplete={() => {
              // Prices will auto-update via TanStack Query invalidation
            }}
          />
          <button
            onClick={() => setShowImport(true)}
            disabled={loading}
            className="btn btn-secondary"
          >
            Import Holdings
          </button>
          <button
            onClick={handleAddHolding}
            disabled={loading}
            className="btn btn-primary"
          >
            Add Holding
          </button>
        </div>
      </div>

      {showHoldingForm && (
        <HoldingForm
          accountId={accountId}
          holding={editingHolding}
          onSave={handleSaveHolding}
          onCancel={handleCancelHoldingForm}
        />
      )}

      {selectedIds.size > 0 && (
        <div
          style={{
            backgroundColor: 'var(--color-primary-bg)',
            border: '1px solid var(--color-primary)',
            borderRadius: 'var(--radius-sm)',
            padding: '8px 16px',
            marginBottom: 'var(--space-3)',
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-3)',
          }}
          data-testid="bulk-action-bar"
        >
          <span style={{ fontWeight: 'bold', color: 'var(--color-primary)' }}>
            {selectedIds.size} selected
          </span>
          <button
            onClick={() => setSelectedIds(new Set())}
            className="btn btn-secondary"
            style={{ padding: '4px 12px', fontSize: '13px' }}
          >
            Clear Selection
          </button>
          <button
            onClick={() => setBulkDeleteConfirm(true)}
            className="btn btn-outline-danger"
            style={{ padding: '6px 14px', fontSize: '13px' }}
            data-testid="bulk-delete-btn"
          >
            Delete Selected
          </button>
        </div>
      )}

      {holdings.length === 0 && !showHoldingForm ? (
        <div className="empty-state">
          <div className="empty-state-icon">📈</div>
          <div className="empty-state-title">No Holdings</div>
          <div className="empty-state-description">
            Add your first holding to start tracking your portfolio
          </div>
        </div>
      ) : (
        <table className="holdings-table">
          <thead>
            <tr>
              <th style={{ width: '40px', textAlign: 'center' }}>
                <input
                  type="checkbox"
                  checked={allSelected}
                  ref={(el) => { if (el) el.indeterminate = isIndeterminate; }}
                  onChange={(e) => handleSelectAll(e.target.checked)}
                  aria-label="Select all holdings"
                />
              </th>
              <th onClick={() => handleSort('ticker')}>
                Ticker
                <span className={`sort-indicator ${sortColumn === 'ticker' ? 'active' : ''}`}>
                  {sortColumn === 'ticker' ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'}
                </span>
              </th>
              <th onClick={() => handleSort('shares')}>
                Shares
                <span className={`sort-indicator ${sortColumn === 'shares' ? 'active' : ''}`}>
                  {sortColumn === 'shares' ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'}
                </span>
              </th>
              <th onClick={() => handleSort('price')}>
                Current Price
                <span className={`sort-indicator ${sortColumn === 'price' ? 'active' : ''}`}>
                  {sortColumn === 'price' ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'}
                </span>
              </th>
              <th onClick={() => handleSort('value')}>
                Market Value
                <span className={`sort-indicator ${sortColumn === 'value' ? 'active' : ''}`}>
                  {sortColumn === 'value' ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'}
                </span>
              </th>
              <th onClick={() => handleSort('gain')}>
                Gain/Loss
                <span className={`sort-indicator ${sortColumn === 'gain' ? 'active' : ''}`}>
                  {sortColumn === 'gain' ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'}
                </span>
              </th>
              <th onClick={() => handleSort('costBasis')}>
                Cost Basis
                <span className={`sort-indicator ${sortColumn === 'costBasis' ? 'active' : ''}`}>
                  {sortColumn === 'costBasis' ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'}
                </span>
              </th>
              <th onClick={() => handleSort('avgCost')}>
                Avg Cost/Share
                <span className={`sort-indicator ${sortColumn === 'avgCost' ? 'active' : ''}`}>
                  {sortColumn === 'avgCost' ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'}
                </span>
              </th>
              <th>Day Change</th>
              <th>% of Portfolio</th>
              <th onClick={() => handleSort('sector')}>
                Sector
                <span className={`sort-indicator ${sortColumn === 'sector' ? 'active' : ''}`}>
                  {sortColumn === 'sector' ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'}
                </span>
              </th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {sortedHoldings.map((holding) => {
              const isExpanded = expandedRows.has(holding.id);
              const lots = lotsMap.get(holding.id) || [];
              const costBasis = calculateCostBasis(holding);
              const portfolioPercent = calculatePortfolioPercent(holding);

              return (
                <React.Fragment key={holding.id}>
                  <tr
                    className={`holding-row ${isExpanded ? 'expanded' : ''}${selectedIds.has(holding.id) ? ' selected-row' : ''}`}
                    onClick={() => toggleRow(holding.id)}
                  >
                    <td style={{ textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(holding.id)}
                        onChange={(e) => handleSelectHolding(holding.id, e.target.checked)}
                        aria-label={`Select ${holding.ticker}`}
                      />
                    </td>
                    <td>
                      <div className="holding-ticker">
                        <span className={`expand-icon ${isExpanded ? 'expanded' : ''}`}>▶</span>
                        <div>
                          <div>{holding.ticker}</div>
                          <div className="holding-name">{holding.name}</div>
                        </div>
                      </div>
                    </td>
                    <td>{formatShares(holding.sharesOwned)}</td>
                    <td>
                      <PriceDisplay
                        price={getHoldingPrice(holding.ticker) ?? holding.currentPrice}
                        compact={true}
                        isManual={isPriceManual(holding.ticker)}
                        onEditClick={() => setManualPriceModal({
                          symbol: holding.ticker,
                          currentPrice: getHoldingPrice(holding.ticker) ?? holding.currentPrice,
                          isManual: isPriceManual(holding.ticker),
                        })}
                      />
                    </td>
                    <td className="holding-value">
                      <PriceDisplay
                        price={getHoldingPrice(holding.ticker) ?? holding.currentPrice}
                        shares={intToShares(holding.sharesOwned)}
                      />
                    </td>
                    <td>
                      <PriceDisplay
                        price={getHoldingPrice(holding.ticker) ?? holding.currentPrice}
                        costBasis={holding.avgCostPerShare}
                        shares={intToShares(holding.sharesOwned)}
                      />
                    </td>
                    <td>{formatCurrency(costBasis)}</td>
                    <td>{formatCurrency(holding.avgCostPerShare)}</td>
                    <td>--</td>
                    <td>{formatPercent(portfolioPercent)}</td>
                    <td>{holding.sector || '--'}</td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <div className="holding-actions">
                        <button
                          onClick={() => handleAddTransaction(holding)}
                          className="btn btn-sm"
                          disabled={loading}
                          title="Add transaction"
                        >
                          + Tx
                        </button>
                        <button
                          onClick={() => handleViewHistory(holding)}
                          className="btn btn-sm"
                          disabled={loading}
                          title="View transaction history"
                        >
                          History
                        </button>
                        <button
                          onClick={() => handleEditHolding(holding)}
                          className="btn btn-secondary"
                          disabled={loading}
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteHolding(holding)}
                          className="btn btn-outline-danger"
                          disabled={loading}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>

                  {isExpanded && (
                    <>
                      <tr className="lot-header-row">
                        <td colSpan={12}>
                          <table className="holdings-table" style={{ marginTop: 0 }}>
                            <thead>
                              <tr>
                                <th>Purchase Date</th>
                                <th>Shares (Original)</th>
                                <th>Remaining Shares</th>
                                <th>Cost/Share</th>
                                <th>Total Cost</th>
                                <th>Actions</th>
                              </tr>
                            </thead>
                            <tbody>
                              {lots.map((lot) => (
                                <tr key={lot.id} className="lot-row">
                                  <td>{formatDate(lot.purchaseDate)}</td>
                                  <td>{formatShares(lot.shares)}</td>
                                  <td>{formatShares(lot.remainingShares)}</td>
                                  <td>{formatCurrency(lot.costPerShare)}</td>
                                  <td>{formatCurrency((lot.shares * lot.costPerShare) / 10000)}</td>
                                  <td>
                                    <div className="holding-actions">
                                      <button
                                        onClick={() => handleEditLot(lot)}
                                        className="btn btn-secondary"
                                        disabled={loading}
                                      >
                                        Edit
                                      </button>
                                      <button
                                        onClick={() => handleDeleteLot(lot)}
                                        className="btn btn-outline-danger"
                                        disabled={loading}
                                      >
                                        Delete
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              ))}
                              <tr className="add-lot-row">
                                <td colSpan={6}>
                                  <button
                                    onClick={() => handleAddLot(holding.id)}
                                    className="btn btn-secondary"
                                    disabled={loading}
                                  >
                                    Add Lot
                                  </button>
                                </td>
                              </tr>
                            </tbody>
                          </table>
                        </td>
                      </tr>
                    </>
                  )}

                  {showLotForm === holding.id && (
                    <tr>
                      <td colSpan={12}>
                        <LotForm
                          holdingId={holding.id}
                          lot={editingLot}
                          onSave={handleSaveLot}
                          onCancel={handleCancelLotForm}
                        />
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div
          className="delete-modal-overlay"
          onClick={() => setDeleteConfirm(null)}
        >
          <div className="delete-modal" onClick={(e) => e.stopPropagation()}>
            <h3>⚠ Delete {deleteConfirm.type === 'holding' ? 'Holding' : 'Lot'}?</h3>
            {deleteConfirm.type === 'holding' ? (
              <>
                <p>
                  Are you sure you want to delete{' '}
                  <strong>{(deleteConfirm.item as Holding).ticker}</strong>?
                </p>
                <p style={{ color: 'var(--color-danger)', fontSize: '14px' }}>
                  This will remove {lotsMap.get((deleteConfirm.item as Holding).id)?.length || 0} lot(s).
                </p>
              </>
            ) : (
              <p>
                Are you sure you want to delete lot purchased on{' '}
                <strong>{formatDate((deleteConfirm.item as CostBasisLot).purchaseDate)}</strong>?
              </p>
            )}
            <div className="delete-modal-actions">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="btn btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                className="btn btn-danger"
                disabled={loading}
              >
                Delete {deleteConfirm.type === 'holding' ? 'Holding' : 'Lot'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Delete Confirmation Modal */}
      {bulkDeleteConfirm && (
        <div
          className="delete-modal-overlay"
          onClick={() => setBulkDeleteConfirm(false)}
        >
          <div className="delete-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Delete {selectedIds.size} Holding{selectedIds.size !== 1 ? 's' : ''}?</h3>
            <p>
              Are you sure you want to delete <strong>{selectedIds.size}</strong> holding{selectedIds.size !== 1 ? 's' : ''}?
            </p>
            {getBulkDeleteLotCount() > 0 && (
              <p style={{ color: 'var(--color-danger)', fontSize: '14px' }}>
                This will also remove {getBulkDeleteLotCount()} associated lot{getBulkDeleteLotCount() !== 1 ? 's' : ''}.
              </p>
            )}
            <div className="delete-modal-actions">
              <button
                onClick={() => setBulkDeleteConfirm(false)}
                className="btn btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={handleBulkDelete}
                className="btn btn-danger"
                disabled={loading}
              >
                Delete {selectedIds.size} Holding{selectedIds.size !== 1 ? 's' : ''}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Undo Toast */}
      {deletedItem && (
        <div
          style={{
            position: 'fixed',
            bottom: 'var(--space-6)',
            right: 'var(--space-6)',
            zIndex: 1100,
            background: 'var(--color-surface)',
            padding: 'var(--space-4)',
            borderRadius: 'var(--radius-md)',
            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
            display: 'flex',
            gap: 'var(--space-3)',
            alignItems: 'center',
          }}
        >
          <span>{deletedItem.type === 'holding' ? 'Holding' : 'Lot'} deleted</span>
          <button onClick={handleUndo} className="btn btn-primary" style={{ padding: '4px 12px' }}>
            Undo
          </button>
        </div>
      )}

      {/* Manual Price Modal */}
      {manualPriceModal && (
        <ManualPriceModal
          symbol={manualPriceModal.symbol}
          currentPrice={manualPriceModal.currentPrice}
          isManual={manualPriceModal.isManual}
          onClose={() => setManualPriceModal(null)}
          onPriceSet={() => {
            // Price updates automatically via query invalidation
          }}
        />
      )}

      {/* Holdings Import Modal */}
      {showImport && (
        <HoldingsImport
          accountId={accountId}
          accountName={accountName || 'Investment Account'}
          onClose={() => setShowImport(false)}
          onImportComplete={() => {
            loadHoldings();
          }}
        />
      )}

      {/* Transaction Entry Modal */}
      <TransactionEntryModal
        isOpen={showTransactionModal}
        onClose={handleTransactionModalClose}
        onSave={handleTransactionSaved}
        holding={selectedHoldingForTx ? {
          id: selectedHoldingForTx.id,
          accountId: selectedHoldingForTx.accountId,
          name: selectedHoldingForTx.name,
          ticker: selectedHoldingForTx.ticker,
          type: 'stock',
          shares: intToShares(selectedHoldingForTx.sharesOwned),
          costBasis: centsToDollars(selectedHoldingForTx.avgCostPerShare),
          currentPrice: centsToDollars(selectedHoldingForTx.currentPrice),
          lastUpdated: selectedHoldingForTx.lastPriceUpdate,
          createdAt: selectedHoldingForTx.createdAt,
        } : null}
        editTransaction={editingTransaction}
      />

      {/* Transaction History Modal */}
      <TransactionHistory
        isOpen={showHistoryModal}
        onClose={handleHistoryClose}
        holding={selectedHoldingForTx ? {
          id: selectedHoldingForTx.id,
          accountId: selectedHoldingForTx.accountId,
          name: selectedHoldingForTx.name,
          ticker: selectedHoldingForTx.ticker,
          type: 'stock',
          shares: intToShares(selectedHoldingForTx.sharesOwned),
          costBasis: centsToDollars(selectedHoldingForTx.avgCostPerShare),
          currentPrice: centsToDollars(selectedHoldingForTx.currentPrice),
          lastUpdated: selectedHoldingForTx.lastPriceUpdate,
          createdAt: selectedHoldingForTx.createdAt,
        } : null}
        onEditTransaction={handleEditTransaction}
      />
    </div>
  );
}
