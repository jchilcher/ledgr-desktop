import * as fs from 'fs';
import type {
  BrokerageFormatName,
  ParsedHolding,
  HoldingsParseResult,
  ColumnMapping,
} from '../../shared/types';

// Import individual parsers
import { parseFidelity, detectFidelity } from './fidelity-parser';
import { parseSchwab, detectSchwab } from './schwab-parser';
import { parseVanguard, detectVanguard } from './vanguard-parser';
import { parseEtrade, detectEtrade } from './etrade-parser';
import { parseGeneric, suggestColumnMapping } from './generic-parser';

export interface BrokerageFormat {
  name: BrokerageFormatName;
  displayName: string;
  detect: (headers: string[]) => boolean;
  parse: (rows: string[][], headers: string[]) => ParsedHolding[];
}

const BROKERAGE_FORMATS: BrokerageFormat[] = [
  {
    name: 'fidelity',
    displayName: 'Fidelity',
    detect: detectFidelity,
    parse: parseFidelity,
  },
  {
    name: 'schwab',
    displayName: 'Charles Schwab',
    detect: detectSchwab,
    parse: parseSchwab,
  },
  {
    name: 'vanguard',
    displayName: 'Vanguard',
    detect: detectVanguard,
    parse: parseVanguard,
  },
  {
    name: 'etrade',
    displayName: 'E*TRADE',
    detect: detectEtrade,
    parse: parseEtrade,
  },
];

/**
 * Parse a single CSV line handling quoted values and delimiters
 * (Matches existing pattern from src/main/csv-parser.ts)
 */
export function parseCSVLine(line: string, delimiter: string): string[] {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      values.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  values.push(current.trim());
  return values;
}

/**
 * Detect CSV delimiter from content
 * (Matches existing pattern from src/main/csv-parser.ts)
 */
export function detectDelimiter(content: string): string {
  const firstLine = content.split('\n')[0].replace(/\r/g, '');

  if (firstLine.includes('\t')) {
    return '\t';
  } else if (firstLine.includes(';')) {
    return ';';
  }
  return ',';
}

/**
 * Find the actual header row index, skipping metadata lines.
 * Brokerage exports (like E*Trade) often have metadata lines like
 * "For Account:,#####9714" before the actual CSV headers.
 * Detects this by finding the first line whose column count matches
 * the most common column count among all lines (the data rows).
 * (Ported from packages/core/src/parsers/csv-parser.ts)
 */
function findHeaderRow(lines: string[], delimiter: string): number {
  if (lines.length < 2) return 0;

  const columnCounts = lines.map(line => parseCSVLine(line, delimiter).length);

  // Find the most common column count among lines with >2 columns
  const countFrequency = new Map<number, number>();
  for (const count of columnCounts) {
    if (count > 2) {
      countFrequency.set(count, (countFrequency.get(count) || 0) + 1);
    }
  }

  if (countFrequency.size === 0) return 0;

  let modeCount = 0;
  let modeFrequency = 0;
  for (const [count, freq] of countFrequency) {
    if (freq > modeFrequency) {
      modeCount = count;
      modeFrequency = freq;
    }
  }

  // The header row is the first line with the mode column count
  for (let i = 0; i < lines.length; i++) {
    if (columnCounts[i] === modeCount) {
      return i;
    }
  }

  return 0;
}

/**
 * Detect brokerage format from CSV headers
 */
export function detectBrokerageFormat(headers: string[]): BrokerageFormat | null {
  const normalized = headers.map(h => h.trim().toLowerCase().replace(/"/g, ''));

  for (const format of BROKERAGE_FORMATS) {
    if (format.detect(normalized)) {
      return format;
    }
  }

  return null;
}

/**
 * Get display name for a format
 */
export function getFormatDisplayName(formatName: BrokerageFormatName | null): string {
  if (!formatName) return 'Unknown Format';
  const format = BROKERAGE_FORMATS.find(f => f.name === formatName);
  return format?.displayName ?? 'Generic CSV';
}

/**
 * Parse holdings CSV file with auto-detection
 */
export function parseHoldingsCSV(filePath: string): HoldingsParseResult {
  try {
    if (!fs.existsSync(filePath)) {
      return {
        success: false,
        holdings: [],
        detectedFormat: null,
        error: 'File does not exist',
      };
    }

    const content = fs.readFileSync(filePath, 'utf-8');

    if (!content || content.trim().length === 0) {
      return {
        success: false,
        holdings: [],
        detectedFormat: null,
        error: 'File is empty',
      };
    }

    const normalized = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const delimiter = detectDelimiter(normalized);
    const lines = normalized.split('\n').filter(line => line.trim().length > 0);

    if (lines.length < 2) {
      return {
        success: false,
        holdings: [],
        detectedFormat: null,
        error: 'File has no data rows',
      };
    }

    // Skip metadata lines (e.g. E*Trade's "For Account:,..." prefix)
    const headerRowIndex = findHeaderRow(lines, delimiter);

    if (headerRowIndex >= lines.length - 1) {
      return {
        success: false,
        holdings: [],
        detectedFormat: null,
        error: 'File has no data rows after header',
      };
    }

    const headers = parseCSVLine(lines[headerRowIndex], delimiter);
    const format = detectBrokerageFormat(headers);

    // Parse data rows (everything after the header row)
    const dataRows = lines.slice(headerRowIndex + 1).map(line => parseCSVLine(line, delimiter));

    if (format) {
      // Use brokerage-specific parser
      const holdings = format.parse(dataRows, headers);
      return {
        success: true,
        holdings,
        detectedFormat: format.name,
      };
    }

    // Return without parsing - will need manual column mapping
    return {
      success: true,
      holdings: [],
      detectedFormat: null,
      warnings: ['Could not detect brokerage format. Manual column mapping required.'],
    };
  } catch (error) {
    return {
      success: false,
      holdings: [],
      detectedFormat: null,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Parse holdings with manual column mapping (for generic format)
 */
export function parseHoldingsWithMapping(
  filePath: string,
  mapping: ColumnMapping
): HoldingsParseResult {
  try {
    if (!fs.existsSync(filePath)) {
      return {
        success: false,
        holdings: [],
        detectedFormat: 'generic',
        error: 'File does not exist',
      };
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    const normalized = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const delimiter = detectDelimiter(normalized);
    const lines = normalized.split('\n').filter(line => line.trim().length > 0);

    if (lines.length < 2) {
      return {
        success: false,
        holdings: [],
        detectedFormat: 'generic',
        error: 'File has no data rows',
      };
    }

    // Skip metadata lines (e.g. E*Trade's "For Account:,..." prefix)
    const headerRowIndex = findHeaderRow(lines, delimiter);

    if (headerRowIndex >= lines.length - 1) {
      return {
        success: false,
        holdings: [],
        detectedFormat: 'generic',
        error: 'File has no data rows after header',
      };
    }

    const headers = parseCSVLine(lines[headerRowIndex], delimiter);
    const dataRows = lines.slice(headerRowIndex + 1).map(line => parseCSVLine(line, delimiter));

    const holdings = parseGeneric(dataRows, headers, mapping);

    return {
      success: true,
      holdings,
      detectedFormat: 'generic',
    };
  } catch (error) {
    return {
      success: false,
      holdings: [],
      detectedFormat: 'generic',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Raw CSV data for spreadsheet-style visual mapping
 */
export interface HoldingsCSVRawData {
  rawRows: string[][];
  totalRows: number;
  detectedHeaderRow: number;
  detectedDelimiter: string;
  suggestedMapping: ColumnMapping | null;
}

/**
 * Get raw CSV rows for spreadsheet-style visual mapping of holdings
 */
export function getHoldingsRawRows(filePath: string, maxRows = 50): HoldingsCSVRawData | null {
  try {
    if (!fs.existsSync(filePath)) return null;

    const content = fs.readFileSync(filePath, 'utf-8');
    if (!content || content.trim().length === 0) return null;

    const normalized = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const delimiter = detectDelimiter(normalized);
    const allLines = normalized.split('\n').filter(line => line.trim().length > 0);

    if (allLines.length < 2) return null;

    const linesToParse = allLines.slice(0, maxRows);
    const rawRows = linesToParse.map(line => parseCSVLine(line, delimiter));
    const detectedHeaderRow = findHeaderRow(allLines, delimiter);

    let suggestedMapping: ColumnMapping | null = null;
    if (detectedHeaderRow < rawRows.length) {
      const headers = rawRows[detectedHeaderRow].map(h => h.replace(/"/g, '').trim());
      suggestedMapping = suggestColumnMapping(headers);
    }

    return {
      rawRows,
      totalRows: allLines.length,
      detectedHeaderRow,
      detectedDelimiter: delimiter,
      suggestedMapping,
    };
  } catch {
    return null;
  }
}

/**
 * Get available columns and suggested mapping for a CSV file
 */
export function getColumnInfo(filePath: string): {
  columns: string[];
  suggestedMapping: ColumnMapping;
} | null {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const normalized = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const delimiter = detectDelimiter(normalized);
    const lines = normalized.split('\n').filter(line => line.trim().length > 0);

    if (lines.length === 0) return null;

    // Skip metadata lines (e.g. E*Trade's "For Account:,..." prefix)
    const headerRowIndex = findHeaderRow(lines, delimiter);
    const headers = parseCSVLine(lines[headerRowIndex], delimiter).map(h => h.replace(/"/g, '').trim());

    return {
      columns: headers,
      suggestedMapping: suggestColumnMapping(headers),
    };
  } catch {
    return null;
  }
}

// Re-export utilities
export { suggestColumnMapping };
