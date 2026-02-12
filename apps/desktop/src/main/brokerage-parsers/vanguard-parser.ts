import type { ParsedHolding } from '../../shared/types';

/**
 * Vanguard CSV Format:
 * Fund Account Number,Fund Name,Shares,Share Price,Total Value,Cost Basis
 *
 * Example:
 * XXXX-1234,Vanguard Total Stock Mkt Idx Adm,100.123,$123.45,"$12,360.18","$10,000.00"
 *
 * Note: Vanguard often uses fund names instead of ticker symbols.
 * Common mappings:
 * - "Vanguard Total Stock Mkt Idx Adm" -> VTSAX
 * - "Vanguard 500 Index Admiral" -> VFIAX
 * - "Vanguard Total Bond Market Index Adm" -> VBTLX
 */

// Common Vanguard fund name to ticker mappings
const VANGUARD_FUND_TICKERS: Record<string, string> = {
  'vanguard total stock mkt idx adm': 'VTSAX',
  'vanguard total stock market index admiral': 'VTSAX',
  'vanguard 500 index admiral': 'VFIAX',
  'vanguard 500 index fund admiral': 'VFIAX',
  'vanguard total bond market index adm': 'VBTLX',
  'vanguard total bond market index admiral': 'VBTLX',
  'vanguard total international stock index admiral': 'VTIAX',
  'vanguard total intl stock idx adm': 'VTIAX',
  'vanguard growth index admiral': 'VIGAX',
  'vanguard value index admiral': 'VVIAX',
  'vanguard small cap index admiral': 'VSMAX',
  'vanguard mid cap index admiral': 'VIMAX',
  'vanguard reit index admiral': 'VGSLX',
  'vanguard federal money market': 'VMFXX',
};

/**
 * Detect if headers match Vanguard format
 */
export function detectVanguard(headers: string[]): boolean {
  // Check for Vanguard-specific headers
  const hasAccountNumber = headers.some(h =>
    h.includes('fund account') || h.includes('account number')
  );
  const hasFundName = headers.some(h =>
    h === 'fund name' || h.includes('fund name')
  );
  const hasShares = headers.some(h => h === 'shares');

  return (hasAccountNumber || hasFundName) && hasShares;
}

/**
 * Parse Vanguard CSV rows into holdings
 */
export function parseVanguard(rows: string[][], headers: string[]): ParsedHolding[] {
  const holdings: ParsedHolding[] = [];

  // Find column indices
  const fundNameIdx = headers.findIndex(h =>
    h.toLowerCase() === 'fund name' || h.toLowerCase().includes('fund name')
  );
  const symbolIdx = headers.findIndex(h =>
    h.toLowerCase() === 'symbol' || h.toLowerCase() === 'ticker'
  );
  const sharesIdx = headers.findIndex(h =>
    h.toLowerCase() === 'shares'
  );
  const costBasisIdx = headers.findIndex(h =>
    h.toLowerCase().includes('cost basis')
  );

  for (const row of rows) {
    // Try to get symbol directly first, fall back to fund name lookup
    let symbol = symbolIdx >= 0 ? cleanValue(row[symbolIdx]) : '';

    if (!symbol && fundNameIdx >= 0) {
      const fundName = cleanValue(row[fundNameIdx]).toLowerCase();
      symbol = VANGUARD_FUND_TICKERS[fundName] ?? '';

      // If not found in mapping, try to extract ticker from fund name
      // Some Vanguard exports include the ticker in parentheses
      if (!symbol) {
        const tickerMatch = fundName.match(/\(([A-Z]{2,5})\)/i);
        if (tickerMatch) {
          symbol = tickerMatch[1].toUpperCase();
        } else {
          // Use a shortened version of fund name as placeholder
          symbol = createTickerFromFundName(cleanValue(row[fundNameIdx]));
        }
      }
    }

    const quantityStr = sharesIdx >= 0 ? cleanValue(row[sharesIdx]) : '';
    const costBasisStr = costBasisIdx >= 0 ? cleanValue(row[costBasisIdx]) : '';

    // Skip header rows or empty
    if (!symbol || symbol.toLowerCase() === 'symbol' || symbol.toLowerCase().includes('fund name')) {
      continue;
    }

    const shares = parseShares(quantityStr);
    const costBasis = parseCurrency(costBasisStr);
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

/**
 * Create a placeholder ticker from fund name (for unmapped funds)
 */
function createTickerFromFundName(fundName: string): string {
  // Take first letter of each word, up to 5 characters
  const words = fundName.split(/\s+/);
  const ticker = words
    .filter(w => w.length > 2) // Skip short words like "The", "of"
    .map(w => w[0].toUpperCase())
    .join('')
    .slice(0, 5);

  return ticker || 'VGRD'; // Fallback
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
