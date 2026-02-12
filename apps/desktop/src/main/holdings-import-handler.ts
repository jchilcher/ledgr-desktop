import { dialog, BrowserWindow } from 'electron';
import { BudgetDatabase } from './database';
import {
  parseHoldingsCSV,
  parseHoldingsWithMapping,
  getColumnInfo,
  getFormatDisplayName,
  getHoldingsRawRows,
} from './brokerage-parsers';
import type {
  ParsedHolding,
  ImportPreviewRow,
  ImportPreviewResult,
  ImportCommitResult,
  ColumnMapping,
  DuplicateAction,
  Holding,
  CostBasisLot,
} from '../shared/types';

/**
 * Open file dialog for CSV selection
 */
export async function selectImportFile(
  win: BrowserWindow | null
): Promise<{ canceled: boolean; filePath?: string }> {
  const result = await dialog.showOpenDialog(win ?? BrowserWindow.getFocusedWindow()!, {
    title: 'Import Holdings from CSV',
    filters: [
      { name: 'CSV Files', extensions: ['csv'] },
      { name: 'All Files', extensions: ['*'] },
    ],
    properties: ['openFile'],
  });

  if (result.canceled || result.filePaths.length === 0) {
    return { canceled: true };
  }

  return { canceled: false, filePath: result.filePaths[0] };
}

/**
 * Generate import preview with duplicate detection
 */
export function generateImportPreview(
  db: BudgetDatabase,
  filePath: string,
  accountId: string,
  columnMapping?: ColumnMapping
): ImportPreviewResult {
  // Always get raw data for spreadsheet mapper
  const rawData = getHoldingsRawRows(filePath, 50);

  // Parse the CSV file
  const parseResult = columnMapping
    ? parseHoldingsWithMapping(filePath, columnMapping)
    : parseHoldingsCSV(filePath);

  if (!parseResult.success) {
    return {
      success: false,
      detectedFormat: null,
      formatDisplayName: 'Unknown',
      rows: [],
      availableColumns: [],
      suggestedMapping: null,
      rawData: rawData ?? undefined,
      stats: { total: 0, new: 0, duplicates: 0, errors: 0 },
      error: parseResult.error,
    };
  }

  // If no holdings parsed and no format detected, need manual mapping
  if (parseResult.holdings.length === 0 && !parseResult.detectedFormat) {
    const columnInfo = getColumnInfo(filePath);
    return {
      success: true,
      detectedFormat: null,
      formatDisplayName: 'Unknown Format',
      rows: [],
      availableColumns: columnInfo?.columns ?? [],
      suggestedMapping: columnInfo?.suggestedMapping ?? null,
      rawData: rawData ?? undefined,
      stats: { total: 0, new: 0, duplicates: 0, errors: 0 },
    };
  }

  // Get existing holdings and lots for duplicate detection
  const existingHoldings = db.getHoldingsByAccount(accountId);
  const existingLotsMap = new Map<string, CostBasisLot[]>();

  for (const holding of existingHoldings) {
    const lots = db.getLotsByHolding(holding.id);
    existingLotsMap.set(holding.id, lots);
  }

  // Detect duplicates and create preview rows
  const previewRows = detectDuplicates(
    parseResult.holdings,
    existingHoldings,
    existingLotsMap
  );

  // Calculate stats
  const stats = {
    total: previewRows.length,
    new: previewRows.filter(r => r.status === 'new').length,
    duplicates: previewRows.filter(r => r.status === 'duplicate').length,
    errors: previewRows.filter(r => r.status === 'error').length,
  };

  return {
    success: true,
    detectedFormat: parseResult.detectedFormat,
    formatDisplayName: getFormatDisplayName(parseResult.detectedFormat),
    rows: previewRows,
    availableColumns: [],
    suggestedMapping: null,
    rawData: rawData ?? undefined,
    stats,
  };
}

/**
 * Detect duplicates at lot level (same ticker + cost basis per context decision)
 */
function detectDuplicates(
  parsed: ParsedHolding[],
  existingHoldings: Holding[],
  existingLotsMap: Map<string, CostBasisLot[]>
): ImportPreviewRow[] {
  return parsed.map(holding => {
    // Validate required fields
    if (!holding.ticker) {
      return {
        ...holding,
        status: 'error' as const,
        errorMessage: 'Missing ticker symbol',
        selected: false,
      };
    }

    if (holding.shares <= 0) {
      return {
        ...holding,
        status: 'error' as const,
        errorMessage: 'Invalid share quantity',
        selected: false,
      };
    }

    // Find existing holding with same ticker
    const existingHolding = existingHoldings.find(
      h => h.ticker.toUpperCase() === holding.ticker.toUpperCase()
    );

    if (existingHolding) {
      // Check for lot-level duplicate (same cost basis)
      const existingLots = existingLotsMap.get(existingHolding.id) ?? [];
      const hasDuplicateLot = existingLots.some(
        lot => lot.costPerShare === holding.costPerShare
      );

      if (hasDuplicateLot) {
        return {
          ...holding,
          status: 'duplicate' as const,
          existingHoldingId: existingHolding.id,
          selected: false, // Duplicates deselected by default
        };
      }
    }

    return {
      ...holding,
      status: 'new' as const,
      selected: true,
    };
  });
}

/**
 * Commit selected holdings to database
 */
export function commitImport(
  db: BudgetDatabase,
  accountId: string,
  rows: ImportPreviewRow[],
  duplicateAction: DuplicateAction
): ImportCommitResult {
  const selectedRows = rows.filter(r => r.selected);

  if (selectedRows.length === 0) {
    return {
      success: true,
      imported: 0,
      skipped: 0,
      errors: 0,
    };
  }

  let imported = 0;
  let skipped = 0;
  let errors = 0;

  for (const row of selectedRows) {
    try {
      if (row.status === 'error') {
        errors++;
        continue;
      }

      if (row.status === 'duplicate') {
        if (duplicateAction === 'skip') {
          skipped++;
          continue;
        }

        if (duplicateAction === 'replace' && row.existingHoldingId) {
          // Delete existing holding (cascades to lots)
          db.deleteHolding(row.existingHoldingId);
        }

        // For 'add' action, we just add a new lot below
        if (duplicateAction === 'add' && row.existingHoldingId) {
          // Add as new lot to existing holding
          db.createLot({
            holdingId: row.existingHoldingId,
            purchaseDate: new Date(),
            shares: row.shares,
            costPerShare: row.costPerShare,
            remainingShares: row.shares,
          });

          // Update holding aggregate values
          updateHoldingAggregates(db, row.existingHoldingId);
          imported++;
          continue;
        }
      }

      // Create new holding
      const holding = db.createHolding({
        accountId,
        ticker: row.ticker.toUpperCase(),
        name: row.ticker.toUpperCase(), // Use ticker as name initially
        currentPrice: 0, // Will be updated by price service
        sector: null,
        lastPriceUpdate: new Date(),
      });

      // Create cost basis lot for the holding
      db.createLot({
        holdingId: holding.id,
        purchaseDate: new Date(), // Import date (original date unknown)
        shares: row.shares,
        costPerShare: row.costPerShare,
        remainingShares: row.shares,
      });

      // Recalculate aggregates
      db.recalculateHoldingAggregates(holding.id);

      imported++;
    } catch (error) {
      console.error('Error importing holding:', error);
      errors++;
    }
  }

  return {
    success: true,
    imported,
    skipped,
    errors,
  };
}

/**
 * Update holding aggregate values after adding a lot
 */
function updateHoldingAggregates(db: BudgetDatabase, holdingId: string): void {
  // Use database's built-in method to recalculate from lots
  db.recalculateHoldingAggregates(holdingId);
}

/**
 * Get available brokerage formats for display
 */
export function getAvailableFormats(): Array<{ name: string; displayName: string }> {
  return [
    { name: 'fidelity', displayName: 'Fidelity' },
    { name: 'schwab', displayName: 'Charles Schwab' },
    { name: 'vanguard', displayName: 'Vanguard' },
    { name: 'etrade', displayName: 'E*TRADE' },
    { name: 'generic', displayName: 'Generic CSV' },
  ];
}
