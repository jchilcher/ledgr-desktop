import * as fs from 'fs';
import {
  parseOFXContent,
  ParsedTransaction,
  ParseResult,
} from '@ledgr/core';

// Re-export types from core
export { ParsedTransaction, ParseResult };

/**
 * Parse OFX file from file path (desktop-specific wrapper)
 * Uses the core parseOFXContent function after reading the file
 */
export function parseOFX(filePath: string): ParseResult {
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
    return parseOFXContent(content);

  } catch (error) {
    return {
      success: false,
      transactions: [],
      skipped: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
