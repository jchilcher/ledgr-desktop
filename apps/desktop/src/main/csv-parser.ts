import * as fs from 'fs';
import {
  parseCSVContent,
  ParsedTransaction,
  ParseResult,
} from '@ledgr/core';

// Re-export types from core
export { ParsedTransaction, ParseResult };

/**
 * Parse CSV file from file path (desktop-specific wrapper)
 * Uses the core parseCSVContent function after reading the file
 */
export function parseCSV(filePath: string): ParseResult {
  try {
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return {
        success: false,
        transactions: [],
        skipped: 0,
        error: 'File does not exist',
      };
    }

    // Read file content
    const content = fs.readFileSync(filePath, 'utf-8');

    // Use core parser
    return parseCSVContent(content);

  } catch (error) {
    return {
      success: false,
      transactions: [],
      skipped: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
