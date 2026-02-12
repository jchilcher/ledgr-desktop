import { BudgetDatabase } from './database';
import { parseCSV } from './csv-parser';
import { parseOFX } from './ofx-parser';
import { ImportResult } from '../shared/window';
import { CategorizationEngine } from './categorization-engine';
import * as path from 'path';

/**
 * Import transactions from a file (CSV, OFX, or QFX) into a specific account
 */
export async function importTransactionsFromFile(
  db: BudgetDatabase,
  accountId: string,
  filePath: string
): Promise<ImportResult> {
  try {
    // Detect file type by extension
    const extension = path.extname(filePath).toLowerCase();

    let parseResult;
    if (extension === '.csv') {
      parseResult = parseCSV(filePath);
    } else if (extension === '.ofx' || extension === '.qfx') {
      parseResult = parseOFX(filePath);
    } else {
      return {
        success: false,
        imported: 0,
        duplicates: 0,
        errors: 0,
        error: `Unsupported file format: ${extension}. Supported formats: .csv, .ofx, .qfx`,
      };
    }

    if (!parseResult.success) {
      return {
        success: false,
        imported: 0,
        duplicates: 0,
        errors: 0,
        error: parseResult.error,
      };
    }

    // Get the uncategorized category (for transactions without a category)
    // Create it if it doesn't exist
    const categories = db.getCategories();
    let uncategorizedCategory = categories.find(c => c.name === 'Uncategorized');

    if (!uncategorizedCategory) {
      // Create the Uncategorized category
      uncategorizedCategory = db.createCategory({
        name: 'Uncategorized',
        type: 'expense',
        icon: '❓',
        color: '#9E9E9E',
        isDefault: true,
      });
    }

    // Initialize categorization engine
    const categorizationEngine = new CategorizationEngine(db);

    // Get existing transactions for duplicate detection
    const existingTransactions = db.getTransactionsByAccount(accountId);

    let imported = 0;
    let duplicates = 0;
    let errors = parseResult.skipped;

    for (const parsedTx of parseResult.transactions) {
      // Check for duplicate (same date, description, and amount)
      // Note: existing amounts are in cents, parsedTx.amount is in dollars
      const parsedAmountInCents = Math.round(parsedTx.amount * 100);
      const isDuplicate = existingTransactions.some(
        existing =>
          existing.date.getTime() === parsedTx.date.getTime() &&
          existing.description === parsedTx.description &&
          existing.amount === parsedAmountInCents
      );

      if (isDuplicate) {
        duplicates++;
        continue;
      }

      try {
        // Try to auto-categorize the transaction
        const suggestedCategoryId = categorizationEngine.categorize(parsedTx.description);
        const categoryId = suggestedCategoryId || uncategorizedCategory.id;

        // Create the transaction (convert parsed dollar amount to cents)
        db.createTransaction({
          accountId,
          date: parsedTx.date,
          description: parsedTx.description,
          amount: Math.round(parsedTx.amount * 100),
          categoryId,
          isRecurring: false,
          importSource: 'file',
        });
        imported++;
      } catch (error) {
        errors++;
      }
    }

    return {
      success: true,
      imported,
      duplicates,
      errors,
    };
  } catch (error) {
    return {
      success: false,
      imported: 0,
      duplicates: 0,
      errors: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Legacy function for backwards compatibility
 * @deprecated Use importTransactionsFromFile instead
 */
export async function importTransactionsFromCSV(
  db: BudgetDatabase,
  accountId: string,
  filePath: string
): Promise<ImportResult> {
  return importTransactionsFromFile(db, accountId, filePath);
}
