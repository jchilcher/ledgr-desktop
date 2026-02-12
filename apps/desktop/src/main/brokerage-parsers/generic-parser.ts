import type { ParsedHolding, ColumnMapping } from '../../shared/types';

/**
 * Generic CSV parser that uses user-provided column mapping.
 * Handles CSV files where the brokerage format couldn't be auto-detected.
 */

// Common column name variations for auto-suggestion
const TICKER_COLUMN_NAMES = ['symbol', 'ticker', 'stock symbol', 'fund symbol', 'security'];
const SHARES_COLUMN_NAMES = ['shares', 'quantity', 'units', 'share count', 'qty'];

/**
 * Suggest column mapping based on header names
 */
export function suggestColumnMapping(headers: string[]): ColumnMapping {
  const normalized = headers.map(h => h.trim().toLowerCase());

  // Find ticker column
  const tickerIdx = normalized.findIndex(h =>
    TICKER_COLUMN_NAMES.some(name => h.includes(name))
  );

  // Find shares column
  const sharesIdx = normalized.findIndex(h =>
    SHARES_COLUMN_NAMES.some(name => h.includes(name))
  );

  // Find cost basis column (prefer total over per-share)
  let costBasisIdx = normalized.findIndex(h =>
    h.includes('cost basis') || h.includes('total cost')
  );
  let costBasisType: 'total' | 'per_share' = 'total';

  if (costBasisIdx === -1) {
    // Try per-share cost
    costBasisIdx = normalized.findIndex(h =>
      h.includes('cost per share') || h.includes('avg cost') || h.includes('average cost')
    );
    if (costBasisIdx >= 0) {
      costBasisType = 'per_share';
    }
  }

  return {
    ticker: tickerIdx >= 0 ? headers[tickerIdx] : null,
    shares: sharesIdx >= 0 ? headers[sharesIdx] : null,
    costBasis: costBasisIdx >= 0 ? headers[costBasisIdx] : null,
    costBasisType,
  };
}

/**
 * Parse CSV rows using provided column mapping
 */
export function parseGeneric(
  rows: string[][],
  headers: string[],
  mapping: ColumnMapping
): ParsedHolding[] {
  const holdings: ParsedHolding[] = [];

  // Validate mapping
  if (!mapping.ticker || !mapping.shares) {
    return holdings; // Cannot parse without ticker and shares
  }

  // Find column indices
  const normalizedHeaders = headers.map(h => h.trim());
  const tickerIdx = normalizedHeaders.indexOf(mapping.ticker);
  const sharesIdx = normalizedHeaders.indexOf(mapping.shares);
  const costBasisIdx = mapping.costBasis ? normalizedHeaders.indexOf(mapping.costBasis) : -1;

  if (tickerIdx === -1 || sharesIdx === -1) {
    return holdings;
  }

  for (const row of rows) {
    const symbol = cleanValue(row[tickerIdx]);
    const quantityStr = cleanValue(row[sharesIdx]);

    // Skip empty or header rows
    if (!symbol || normalizedHeaders.some(h => h.toLowerCase() === symbol.toLowerCase())) {
      continue;
    }

    const shares = parseShares(quantityStr);
    if (shares === 0) continue;

    let costBasis = 0;
    let costPerShare = 0;

    if (costBasisIdx >= 0) {
      const costValue = parseCurrency(cleanValue(row[costBasisIdx]));

      if (mapping.costBasisType === 'total') {
        costBasis = costValue;
        costPerShare = shares > 0 ? Math.round(costBasis / (shares / 10000)) : 0;
      } else {
        // per_share
        costPerShare = costValue;
        costBasis = Math.round(costPerShare * (shares / 10000));
      }
    }

    holdings.push({
      ticker: symbol.toUpperCase().trim(),
      shares,
      costBasis,
      costPerShare,
      rawRow: createRawRow(row, headers),
    });
  }

  return holdings;
}

function cleanValue(value: string | undefined): string {
  if (!value) return '';
  return value.replace(/"/g, '').trim();
}

function parseShares(value: string): number {
  const cleaned = value.replace(/,/g, '').replace(/"/g, '');
  const parsed = parseFloat(cleaned);
  if (isNaN(parsed)) return 0;
  return Math.round(parsed * 10000);
}

function parseCurrency(value: string): number {
  if (!value) return 0;
  const cleaned = value
    .replace(/[$€£¥]/g, '')
    .replace(/,/g, '')
    .replace(/"/g, '')
    .replace(/\s/g, '')
    .trim();

  let isNegative = false;
  let numStr = cleaned;
  if (cleaned.startsWith('(') && cleaned.endsWith(')')) {
    isNegative = true;
    numStr = cleaned.slice(1, -1);
  } else if (cleaned.startsWith('-')) {
    isNegative = true;
    numStr = cleaned.slice(1);
  }

  const parsed = parseFloat(numStr);
  if (isNaN(parsed)) return 0;

  const cents = Math.round(parsed * 100);
  return isNegative ? -cents : cents;
}

function createRawRow(row: string[], headers: string[]): Record<string, string> {
  const rawRow: Record<string, string> = {};
  headers.forEach((header, index) => {
    rawRow[header] = row[index] ?? '';
  });
  return rawRow;
}
