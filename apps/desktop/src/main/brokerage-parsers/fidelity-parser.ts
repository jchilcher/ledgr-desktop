import type { ParsedHolding } from '../../shared/types';

/**
 * Fidelity CSV Format:
 * Account Name/Number,Symbol,Description,Quantity,Last Price,Last Price Change,
 * Current Value,Today's Gain/Loss Dollar,Today's Gain/Loss Percent,
 * Total Gain/Loss Dollar,Total Gain/Loss Percent,Percent Of Account,
 * Cost Basis,Cost Basis Per Share,Type
 *
 * Example:
 * "Individual - TOD XXXX1234",AAPL,APPLE INC,50.0000,$171.21,$0.45,"$8,560.50",
 * "$22.50","+0.26%","$1,560.50","+22.29%",12.34%,"$7,000.00",$140.00,Cash
 */

// Column indices for Fidelity format
const FIDELITY_COLUMNS = {
  ACCOUNT: 0,
  SYMBOL: 1,
  DESCRIPTION: 2,
  QUANTITY: 3,
  LAST_PRICE: 4,
  CURRENT_VALUE: 6,
  COST_BASIS: 12,
  COST_BASIS_PER_SHARE: 13,
};

/**
 * Detect if headers match Fidelity format
 */
export function detectFidelity(headers: string[]): boolean {
  if (headers.length < 3) return false;

  // Fidelity starts with "account name/number" or similar
  const firstHeader = headers[0]?.toLowerCase() ?? '';
  const secondHeader = headers[1]?.toLowerCase() ?? '';

  return (
    (firstHeader.includes('account') && firstHeader.includes('name')) ||
    (firstHeader.includes('account') && firstHeader.includes('number'))
  ) && secondHeader === 'symbol';
}

/**
 * Parse Fidelity CSV rows into holdings
 */
export function parseFidelity(rows: string[][], headers: string[]): ParsedHolding[] {
  const holdings: ParsedHolding[] = [];

  for (const row of rows) {
    if (row.length < FIDELITY_COLUMNS.COST_BASIS_PER_SHARE + 1) {
      continue;
    }

    const symbol = cleanValue(row[FIDELITY_COLUMNS.SYMBOL]);
    const quantityStr = cleanValue(row[FIDELITY_COLUMNS.QUANTITY]);
    const costBasisStr = cleanValue(row[FIDELITY_COLUMNS.COST_BASIS]);
    const costPerShareStr = cleanValue(row[FIDELITY_COLUMNS.COST_BASIS_PER_SHARE]);

    // Skip header rows that might appear mid-file (multi-account exports)
    if (symbol.toLowerCase() === 'symbol' || symbol === '') {
      continue;
    }

    // Skip cash/money market entries
    if (symbol.toLowerCase().includes('cash') || symbol.toLowerCase().includes('spaxx')) {
      continue;
    }

    const shares = parseShares(quantityStr);
    const costBasis = parseCurrency(costBasisStr);
    let costPerShare = parseCurrency(costPerShareStr);

    // Calculate cost per share if not provided but cost basis is
    if (costPerShare === 0 && costBasis > 0 && shares > 0) {
      costPerShare = Math.round(costBasis / (shares / 10000));
    }

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

/**
 * Clean a CSV value (remove quotes, trim whitespace)
 */
function cleanValue(value: string | undefined): string {
  if (!value) return '';
  return value.replace(/"/g, '').trim();
}

/**
 * Parse shares string to integer (shares * 10000)
 */
function parseShares(value: string): number {
  const cleaned = value.replace(/,/g, '').replace(/"/g, '');
  const parsed = parseFloat(cleaned);
  if (isNaN(parsed)) return 0;
  return Math.round(parsed * 10000);
}

/**
 * Parse currency string to cents (integer)
 */
function parseCurrency(value: string): number {
  if (!value) return 0;
  const cleaned = value
    .replace(/[$€£¥]/g, '')
    .replace(/,/g, '')
    .replace(/"/g, '')
    .replace(/\s/g, '')
    .trim();

  // Handle parentheses for negative values
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

/**
 * Create raw row object for reference
 */
function createRawRow(row: string[], headers: string[]): Record<string, string> {
  const rawRow: Record<string, string> = {};
  headers.forEach((header, index) => {
    rawRow[header] = row[index] ?? '';
  });
  return rawRow;
}
