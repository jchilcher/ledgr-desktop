import { BudgetDatabase } from './database';
import { CategoryRule } from '../shared/types';
import {
  CategorizationEngine as CoreCategorizationEngine,
  getDefaultRules,
} from '@ledgr/core';

/**
 * Categorization engine that automatically assigns categories to transactions
 * based on pattern matching rules
 */
export class CategorizationEngine {
  private coreEngine: CoreCategorizationEngine;

  constructor(private db: BudgetDatabase) {
    this.coreEngine = new CoreCategorizationEngine({
      getCategoryRules: () => this.db.getCategoryRules(),
      getCategories: () => this.db.getCategories(),
      updateTransaction: (id, updates) => this.db.updateTransaction(id, updates),
      createCategoryRule: (rule) => this.db.createCategoryRule(rule),
      getTransactions: () => this.db.getTransactions(),
    });
  }

  /**
   * Find the best matching category for a transaction description
   * Returns the category ID or null if no match found
   */
  categorize(description: string): string | null {
    return this.coreEngine.categorize(description);
  }

  /**
   * Apply categorization rules to existing transactions
   * @param onlyUncategorized - If true, only categorize transactions without a category
   * @returns Object with count of updated transactions
   */
  applyRulesToTransactions(onlyUncategorized: boolean = false): { updated: number; total: number } {
    return this.coreEngine.applyRulesToTransactions(onlyUncategorized);
  }

  /**
   * Create a new categorization rule from a transaction
   * This is used when a user manually categorizes a transaction
   * and wants to apply the same category to similar transactions
   */
  createRuleFromTransaction(description: string, categoryId: string): CategoryRule {
    return this.coreEngine.createRuleFromTransaction(description, categoryId);
  }

  /**
   * Get default categorization rules for common merchants
   * These are suggested rules that users can optionally add
   */
  getDefaultRules(): Omit<CategoryRule, 'id' | 'createdAt'>[] {
    return getDefaultRules(this.db.getCategories());
  }

  /**
   * Install default categorization rules
   */
  installDefaultRules(): void {
    this.coreEngine.installDefaultRules();
  }
}
