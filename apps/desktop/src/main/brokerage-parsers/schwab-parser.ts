import type { ParsedHolding } from '../../shared/types';

/**
 * Charles Schwab CSV Format:
 * Symbol,Description,Quantity,Price,Price Change %,Price Change $,Market Value,
 * Day Change %,Day Change $,Cost Basis,Gain/Loss %,Gain/Loss $,Ratings,
 * Reinvest Dividends?,Capital Gains?,% of Account
 *
 * Example:
 * AAPL,APPLE INC,50,$171.21,0.26%,$0.45,"$8,560.50",0.26%,"$22.50","$7,000.00",22.29%,"$1,560.50",N/A,No,No,12.34%
 */

// Column indices for Schwab format
const SCHWAB_COLUMNS = {
  SYMBOL: 0,
  DESCRIPTION: 1,
  QUANTITY: 2,
  PRICE: 3,
  MARKET_VALUE: 6,
  COST_BASIS: 9,
};

/**
 * Detect if headers match Schwab format
 */
export function detectSchwab(headers: string[]): boolean {
  if (headers.length < 4) return false;

  return (
    headers[0] === 'symbol' &&
    headers[1] === 'description' &&
    headers[2] === 'quantity' &&
    headers[3]?.includes('price')
  );
}

/**
 * Parse Schwab CSV rows into holdings
 */
export function parseSchwab(rows: string[][], headers: string[]): ParsedHolding[] {
  const holdings: ParsedHolding[] = [];

  for (const row of rows) {
    if (row.length < SCHWAB_COLUMNS.COST_BASIS + 1) {
      continue;
    }

    const symbol = cleanValue(row[SCHWAB_COLUMNS.SYMBOL]);
    const quantityStr = cleanValue(row[SCHWAB_COLUMNS.QUANTITY]);
    const costBasisStr = cleanValue(row[SCHWAB_COLUMNS.COST_BASIS]);

    // Skip header rows or empty symbols
    if (symbol.toLowerCase() === 'symbol' || symbol === '') {
      continue;
    }

    // Skip cash entries
    if (symbol.toLowerCase().includes('cash') || symbol === 'Pending Activity') {
      continue;
    }

    const shares = parseShares(quantityStr);
    const costBasis = parseCurrency(costBasisStr);

    // Calculate cost per share from total cost basis
    const costPerShare = shares > 0 ? Math.round(costBasis / (shares / 10000)) : 0;

    if (symbol && shares > 0) {
      holdings.push({
        ticker: symbol.toUpperCase(),
        shares,
        costBasis,
        costPerShare,
        rawRow: createRawRow(row, headers),
      });
    }
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
