import { dialog, BrowserWindow } from 'electron';
import * as fs from 'fs';
import { BudgetDatabase } from './database';
import {
  parseCSVContent,
  parseCSVWithMapping,
  getCSVColumnInfo,
  getCSVRawRows,
  getTransactionFormatDisplayName,
  type TransactionColumnMapping,
} from '@ledgr/core';
import { CategorizationEngine } from './categorization-engine';
import { matchTransaction, type RecurringMatchingDependencies } from '@ledgr/core';
import type {
  TransactionImportPreviewRow,
  TransactionImportPreviewResult,
  TransactionImportCommitResult,
  DuplicateAction,
  Transaction,
} from '../shared/types';

/**
 * Open file dialog for CSV/OFX selection
 */
export async function selectTransactionImportFile(
  win: BrowserWindow | null
): Promise<{ canceled: boolean; filePath?: string }> {
  const result = await dialog.showOpenDialog(win ?? BrowserWindow.getFocusedWindow()!, {
    title: 'Import Transactions from CSV',
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
export function generateTransactionImportPreview(
  db: BudgetDatabase,
  filePath: string,
  accountId: string,
  columnMapping?: TransactionColumnMapping
): TransactionImportPreviewResult {
  try {
    // Read file content
    const content = fs.readFileSync(filePath, 'utf-8');

    // Always get raw data for spreadsheet mapper
    const rawData = getCSVRawRows(content, 50);

    // Parse the CSV file
    let parseResult;
    if (columnMapping) {
      parseResult = parseCSVWithMapping(content, columnMapping, columnMapping.headerRow);
    } else {
      parseResult = parseCSVContent(content);
    }

    if (!parseResult.success) {
      // If parsing failed, check if we can provide column info for manual mapping
      const columnInfo = getCSVColumnInfo(content);

      if (columnInfo && columnInfo.columns.length > 0) {
        return {
          success: true,
          detectedFormat: null,
          formatDisplayName: 'Unknown Format',
          rows: [],
          availableColumns: columnInfo.columns,
          suggestedMapping: columnInfo.suggestedMapping,
          sampleData: columnInfo.sampleData,
          rawData: rawData ?? undefined,
          stats: { total: 0, new: 0, duplicates: 0, errors: 0 },
        };
      }

      return {
        success: false,
        detectedFormat: null,
        formatDisplayName: 'Unknown',
        rows: [],
        availableColumns: [],
        suggestedMapping: null,
        sampleData: [],
        rawData: rawData ?? undefined,
        stats: { total: 0, new: 0, duplicates: 0, errors: 0 },
        error: parseResult.error,
      };
    }

    // If no transactions parsed but we have column info, need manual mapping
    if (parseResult.transactions.length === 0 && !parseResult.detectedFormat) {
      const columnInfo = getCSVColumnInfo(content);
      if (columnInfo && columnInfo.columns.length > 0) {
        return {
          success: true,
          detectedFormat: null,
          formatDisplayName: 'Unknown Format',
          rows: [],
          availableColumns: columnInfo.columns,
          suggestedMapping: columnInfo.suggestedMapping,
          sampleData: columnInfo.sampleData,
          rawData: rawData ?? undefined,
          stats: { total: 0, new: 0, duplicates: 0, errors: 0 },
        };
      }
    }

    // Get existing transactions for duplicate detection
    const existingTransactions = db.getTransactionsByAccount(accountId);

    // Create preview rows with duplicate detection
    const previewRows = detectDuplicates(
      parseResult.transactions,
      existingTransactions
    );

    // Calculate stats
    const stats = {
      total: previewRows.length,
      new: previewRows.filter(r => r.status === 'new').length,
      duplicates: previewRows.filter(r => r.status === 'duplicate').length,
      errors: previewRows.filter(r => r.status === 'error').length,
    };

    // Always provide column info so users can remap if needed
    const columnInfo = getCSVColumnInfo(content);

    return {
      success: true,
      detectedFormat: parseResult.detectedFormat ?? null,
      formatDisplayName: getTransactionFormatDisplayName(parseResult.detectedFormat ?? null),
      rows: previewRows,
      availableColumns: columnInfo?.columns ?? [],
      suggestedMapping: columnInfo?.suggestedMapping ?? null,
      sampleData: columnInfo?.sampleData ?? [],
      rawData: rawData ?? undefined,
      stats,
    };
  } catch (error) {
    return {
      success: false,
      detectedFormat: null,
      formatDisplayName: 'Unknown',
      rows: [],
      availableColumns: [],
      suggestedMapping: null,
      stats: { total: 0, new: 0, duplicates: 0, errors: 0 },
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Detect duplicates by matching (date, description, amount)
 */
function detectDuplicates(
  parsed: Array<{ date: Date; description: string; amount: number; category?: string; balance?: number }>,
  existingTransactions: Transaction[]
): TransactionImportPreviewRow[] {
  // Create a Set of existing transaction keys for fast lookup
  // Note: Amounts are stored in cents in the database
  const existingKeys = new Map<string, string>();
  for (const tx of existingTransactions) {
    const dateStr = normalizeDate(tx.date);
    const key = `${dateStr}|${tx.description.toLowerCase().trim()}|${tx.amount}`;
    existingKeys.set(key, tx.id);
  }

  return parsed.map((tx, index) => {
    // Validate required fields
    if (!tx.date || isNaN(tx.date.getTime())) {
      return {
        date: tx.date || new Date(),
        description: tx.description || '',
        amount: tx.amount || 0,
        category: tx.category ?? null,
        balance: tx.balance ?? null,
        status: 'error' as const,
        errorMessage: 'Invalid date',
        selected: false,
        rawRow: { row: String(index + 1) },
      };
    }

    if (!tx.description || !tx.description.trim()) {
      return {
        date: tx.date,
        description: '',
        amount: tx.amount || 0,
        category: tx.category ?? null,
        balance: tx.balance ?? null,
        status: 'error' as const,
        errorMessage: 'Missing description',
        selected: false,
        rawRow: { row: String(index + 1) },
      };
    }

    if (isNaN(tx.amount)) {
      return {
        date: tx.date,
        description: tx.description,
        amount: 0,
        category: tx.category ?? null,
        balance: tx.balance ?? null,
        status: 'error' as const,
        errorMessage: 'Invalid amount',
        selected: false,
        rawRow: { row: String(index + 1) },
      };
    }

    // Convert to cents only for duplicate key comparison (DB stores cents)
    const amountInCents = Math.round(tx.amount * 100);
    const dateStr = normalizeDate(tx.date);
    const key = `${dateStr}|${tx.description.toLowerCase().trim()}|${amountInCents}`;

    // Check for duplicate
    const existingId = existingKeys.get(key);
    if (existingId) {
      return {
        date: tx.date,
        description: tx.description,
        amount: tx.amount,
        category: tx.category ?? null,
        balance: tx.balance ?? null,
        status: 'duplicate' as const,
        existingTransactionId: existingId,
        selected: false, // Duplicates deselected by default
        rawRow: { row: String(index + 1) },
      };
    }

    return {
      date: tx.date,
      description: tx.description,
      amount: tx.amount,
      category: tx.category ?? null,
      balance: tx.balance ?? null,
      status: 'new' as const,
      selected: true,
      rawRow: { row: String(index + 1) },
    };
  });
}

/**
 * Normalize date to YYYY-MM-DD string for comparison
 */
function normalizeDate(date: Date | string): string {
  const d = date instanceof Date ? date : new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Commit selected transactions to database
 */
export function commitTransactionImport(
  db: BudgetDatabase,
  accountId: string,
  rows: TransactionImportPreviewRow[],
  duplicateAction: DuplicateAction,
  categorizationEngine: CategorizationEngine,
  recurringMatchingDeps?: RecurringMatchingDependencies
): TransactionImportCommitResult {
  const selectedRows = rows.filter(r => r.selected);

  if (selectedRows.length === 0) {
    return {
      success: true,
      imported: 0,
      skipped: 0,
      errors: 0,
    };
  }

  // Get or create the "Uncategorized" fallback category
  const categories = db.getCategories();
  let uncategorizedCategory = categories.find(c => c.name === 'Uncategorized');
  if (!uncategorizedCategory) {
    uncategorizedCategory = db.createCategory({
      name: 'Uncategorized',
      type: 'expense',
      icon: '❓',
      color: '#9E9E9E',
      isDefault: true,
    });
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

        if (duplicateAction === 'replace' && row.existingTransactionId) {
          // Delete existing transaction
          db.deleteTransaction(row.existingTransactionId);
        }

        // For 'add' action, we just add the transaction below
        // (user explicitly wants to add even though it's a duplicate)
      }

      // Auto-categorize using rules; fall back to "Uncategorized"
      const suggestedCategoryId = categorizationEngine.categorize(row.description);
      const categoryId = suggestedCategoryId || uncategorizedCategory.id;

      // Create the transaction (convert dollar amount to cents for storage)
      const amountInCents = Math.round(row.amount * 100);
      const newTx = db.createTransaction({
        accountId,
        date: row.date,
        description: row.description,
        amount: amountInCents,
        categoryId,
        isRecurring: false,
        importSource: 'file',
      });

      // Auto-match against recurring item rules
      if (recurringMatchingDeps && newTx) {
        try {
          const match = matchTransaction(
            { id: newTx.id, description: row.description, amount: amountInCents, accountId, date: row.date },
            recurringMatchingDeps
          );
          if (match && match.paymentId) {
            db.updateRecurringPayment(match.paymentId, {
              status: 'paid',
              paidDate: row.date,
              transactionId: newTx.id,
            });
          }
        } catch {
          // Silent — don't fail import if matching errors
        }
      }

      imported++;
    } catch (error) {
      console.error('Error importing transaction:', error);
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
