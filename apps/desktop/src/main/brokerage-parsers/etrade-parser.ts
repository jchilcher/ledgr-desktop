import type { ParsedHolding } from '../../shared/types';

/**
 * E*TRADE CSV Format:
 * Symbol,Last Price,$ Change,% Change,Shares,Total Value,Gain/Loss
 *
 * Example:
 * AAPL,$171.21,$0.45,0.26%,50,"$8,560.50","$1,560.50"
 *
 * Note: E*TRADE often does NOT include cost basis in their standard export.
 * Cost basis may need to be entered manually or imported from a different report.
 */

/**
 * Detect if headers match E*TRADE format
 */
export function detectEtrade(headers: string[]): boolean {
  if (headers.length < 4) return false;

  return (
    headers[0] === 'symbol' &&
    headers[1]?.includes('last price') &&
    (headers[2]?.includes('change') || headers[2]?.includes('$ change'))
  );
}

/**
 * Parse E*TRADE CSV rows into holdings
 */
export function parseEtrade(rows: string[][], headers: string[]): ParsedHolding[] {
  const holdings: ParsedHolding[] = [];

  // Find column indices (E*TRADE format can vary)
  const symbolIdx = headers.findIndex(h => h.toLowerCase() === 'symbol');
  const sharesIdx = headers.findIndex(h => h.toLowerCase() === 'shares' || h.toLowerCase() === 'quantity');
  const totalValueIdx = headers.findIndex(h =>
    h.toLowerCase().includes('total value') || h.toLowerCase().includes('market value')
  );
  const costBasisIdx = headers.findIndex(h =>
    h.toLowerCase().includes('cost basis') || h.toLowerCase().includes('total cost')
  );
  const gainLossIdx = headers.findIndex(h =>
    h.toLowerCase().includes('gain') || h.toLowerCase().includes('loss')
  );
  const lastPriceIdx = headers.findIndex(h =>
    h.toLowerCase().includes('last price') || h.toLowerCase().includes('price')
  );

  for (const row of rows) {
    const symbol = symbolIdx >= 0 ? cleanValue(row[symbolIdx]) : '';
    const quantityStr = sharesIdx >= 0 ? cleanValue(row[sharesIdx]) : '';

    // Skip header rows or empty
    if (!symbol || symbol.toLowerCase() === 'symbol') {
      continue;
    }

    // Skip cash entries
    if (symbol.toLowerCase().includes('cash') || symbol.toLowerCase() === 'total') {
      continue;
    }

    const shares = parseShares(quantityStr);

    // E*TRADE may not include cost basis - try to calculate from other fields
    let costBasis = 0;
    let costPerShare = 0;

    if (costBasisIdx >= 0) {
      costBasis = parseCurrency(cleanValue(row[costBasisIdx]));
    } else if (totalValueIdx >= 0 && gainLossIdx >= 0) {
      // Calculate cost basis: Total Value - Gain/Loss = Cost Basis
      const totalValue = parseCurrency(cleanValue(row[totalValueIdx]));
      const gainLoss = parseCurrency(cleanValue(row[gainLossIdx]));
      costBasis = totalValue - gainLoss;
    }

    // Calculate cost per share
    if (costBasis > 0 && shares > 0) {
      costPerShare = Math.round(costBasis / (shares / 10000));
    } else if (lastPriceIdx >= 0) {
      // If no cost basis, use current price as placeholder (with warning)
      costPerShare = parseCurrency(cleanValue(row[lastPriceIdx]));
      costBasis = Math.round(costPerShare * (shares / 10000));
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
