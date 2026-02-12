import * as fs from 'fs';
import * as path from 'path';
import { BudgetDatabase } from '../database';
import { CategorizationEngine } from '../categorization-engine';

describe('CategorizationEngine', () => {
  let db: BudgetDatabase;
  let engine: CategorizationEngine;
  let testDbPath: string;

  beforeEach(() => {
    testDbPath = path.join(__dirname, 'test-categorization.db');
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
    db = new BudgetDatabase(testDbPath);
    engine = new CategorizationEngine(db);
  });

  afterEach(() => {
    db.close();
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });

  describe('categorize', () => {
    it('should return null when no rules exist', () => {
      const result = engine.categorize('STARBUCKS #12345');
      expect(result).toBeNull();
    });

    it('should match simple substring patterns (case-insensitive)', () => {
      const groceries = db.getCategories().find(c => c.name === 'Groceries')!;
      db.createCategoryRule({
        pattern: 'walmart',
        categoryId: groceries.id,
        priority: 50,
      });

      const result1 = engine.categorize('WALMART SUPERCENTER #1234');
      const result2 = engine.categorize('walmart store');
      const result3 = engine.categorize('Walmart Grocery');

      expect(result1).toBe(groceries.id);
      expect(result2).toBe(groceries.id);
      expect(result3).toBe(groceries.id);
    });

    it('should match regex patterns', () => {
      const dining = db.getCategories().find(c => c.name === 'Dining Out')!;
      db.createCategoryRule({
        pattern: '/starbucks.*#\\d+/',
        categoryId: dining.id,
        priority: 50,
      });

      const result1 = engine.categorize('STARBUCKS #12345');
      const result2 = engine.categorize('starbucks store #999');

      expect(result1).toBe(dining.id);
      expect(result2).toBe(dining.id);
    });

    it('should prioritize higher priority rules', () => {
      const groceries = db.getCategories().find(c => c.name === 'Groceries')!;
      const dining = db.getCategories().find(c => c.name === 'Dining Out')!;

      // Create low priority rule first
      db.createCategoryRule({
        pattern: 'target',
        categoryId: groceries.id,
        priority: 30,
      });

      // Create high priority rule
      db.createCategoryRule({
        pattern: 'target',
        categoryId: dining.id,
        priority: 70,
      });

      const result = engine.categorize('TARGET STORE #1234');
      // Should match the higher priority rule (dining)
      expect(result).toBe(dining.id);
    });

    it('should upsert when creating a rule with a duplicate pattern', () => {
      const groceries = db.getCategories().find(c => c.name === 'Groceries')!;
      const dining = db.getCategories().find(c => c.name === 'Dining Out')!;

      db.createCategoryRule({
        pattern: 'amazon',
        categoryId: groceries.id,
        priority: 50,
      });

      // Second create with same pattern should upsert, not duplicate
      const upserted = db.createCategoryRule({
        pattern: 'amazon',
        categoryId: dining.id,
        priority: 50,
      });

      const allRules = db.getCategoryRules().filter(r => r.pattern === 'amazon');
      expect(allRules.length).toBe(1);
      expect(upserted.categoryId).toBe(dining.id);
    });

    it('should handle invalid regex patterns gracefully', () => {
      const groceries = db.getCategories().find(c => c.name === 'Groceries')!;
      // Invalid regex (unmatched parenthesis)
      db.createCategoryRule({
        pattern: '/walmart(/',
        categoryId: groceries.id,
        priority: 50,
      });

      // Should fallback to substring match
      const result = engine.categorize('/walmart(/');
      expect(result).toBe(groceries.id);
    });
  });

  describe('createRuleFromTransaction', () => {
    it('should extract pattern from transaction description', () => {
      const groceries = db.getCategories().find(c => c.name === 'Groceries')!;

      const rule = engine.createRuleFromTransaction('WALMART SUPERCENTER #1234', groceries.id);

      expect(rule.pattern).toBe('walmart supercenter');
      expect(rule.categoryId).toBe(groceries.id);
      expect(rule.priority).toBe(50);
    });

    it('should remove trailing numbers and special chars', () => {
      const groceries = db.getCategories().find(c => c.name === 'Groceries')!;

      const rule1 = engine.createRuleFromTransaction('STARBUCKS #12345', groceries.id);
      const rule2 = engine.createRuleFromTransaction('TARGET *1234', groceries.id);
      const rule3 = engine.createRuleFromTransaction('AMAZON 5678', groceries.id);

      expect(rule1.pattern).toBe('starbucks');
      expect(rule2.pattern).toBe('target');
      expect(rule3.pattern).toBe('amazon');
    });

    it('should limit pattern to first 1-2 words', () => {
      const groceries = db.getCategories().find(c => c.name === 'Groceries')!;

      const rule = engine.createRuleFromTransaction('THE HOME DEPOT STORE LOCATION', groceries.id);

      // Should only take first 2 words
      expect(rule.pattern).toBe('the home');
    });
  });

  describe('getDefaultRules', () => {
    it('should return default categorization rules', () => {
      const defaultRules = engine.getDefaultRules();

      expect(defaultRules.length).toBeGreaterThan(0);

      // Should include common merchants
      const patterns = defaultRules.map(r => r.pattern);
      expect(patterns).toContain('walmart');
      expect(patterns).toContain('starbucks');
      expect(patterns).toContain('netflix');
    });

    it('should only include rules for existing categories', () => {
      const defaultRules = engine.getDefaultRules();
      const categoryIds = db.getCategories().map(c => c.id);

      for (const rule of defaultRules) {
        expect(categoryIds).toContain(rule.categoryId);
      }
    });
  });

  describe('installDefaultRules', () => {
    it('should install default categorization rules', () => {
      const rulesBefore = db.getCategoryRules();
      expect(rulesBefore.length).toBe(0);

      engine.installDefaultRules();

      const rulesAfter = db.getCategoryRules();
      expect(rulesAfter.length).toBeGreaterThan(0);
    });

    it('should make default rules work for categorization', () => {
      engine.installDefaultRules();

      const result1 = engine.categorize('WALMART SUPERCENTER #1234');
      const result2 = engine.categorize('STARBUCKS COFFEE #5678');
      const result3 = engine.categorize('NETFLIX.COM');

      expect(result1).toBeTruthy(); // Should match groceries
      expect(result2).toBeTruthy(); // Should match dining
      expect(result3).toBeTruthy(); // Should match entertainment
    });

    it('should be idempotent — calling twice produces same rule count', () => {
      engine.installDefaultRules();
      const countAfterFirst = db.getCategoryRules().length;

      engine.installDefaultRules();
      const countAfterSecond = db.getCategoryRules().length;

      expect(countAfterSecond).toBe(countAfterFirst);
    });
  });

  describe('duplicate rule prevention', () => {
    it('should prevent duplicate patterns case-insensitively', () => {
      const groceries = db.getCategories().find(c => c.name === 'Groceries')!;

      db.createCategoryRule({ pattern: 'walmart', categoryId: groceries.id, priority: 50 });
      db.createCategoryRule({ pattern: 'Walmart', categoryId: groceries.id, priority: 50 });
      db.createCategoryRule({ pattern: 'WALMART', categoryId: groceries.id, priority: 50 });

      const allRules = db.getCategoryRules().filter(r => r.pattern.toLowerCase() === 'walmart');
      expect(allRules.length).toBe(1);
    });

    it('should keep the higher priority on upsert', () => {
      const groceries = db.getCategories().find(c => c.name === 'Groceries')!;
      const dining = db.getCategories().find(c => c.name === 'Dining Out')!;

      db.createCategoryRule({ pattern: 'costco', categoryId: groceries.id, priority: 80 });
      const upserted = db.createCategoryRule({ pattern: 'costco', categoryId: dining.id, priority: 30 });

      // Priority should stay at 80 (the higher value), categoryId updated to dining
      expect(upserted.priority).toBe(80);
      expect(upserted.categoryId).toBe(dining.id);
    });

    it('should merge rules when updating pattern to an existing one', () => {
      const groceries = db.getCategories().find(c => c.name === 'Groceries')!;
      const dining = db.getCategories().find(c => c.name === 'Dining Out')!;

      const rule1 = db.createCategoryRule({ pattern: 'target', categoryId: groceries.id, priority: 50 });
      const rule2 = db.createCategoryRule({ pattern: 'tarjay', categoryId: dining.id, priority: 60 });

      // Update rule2's pattern to 'target' — should merge by deleting rule1
      db.updateCategoryRule(rule2.id, { pattern: 'target' });

      const allRules = db.getCategoryRules().filter(r => r.pattern.toLowerCase() === 'target');
      expect(allRules.length).toBe(1);
      expect(allRules[0].id).toBe(rule2.id);

      // Original rule1 should be gone
      expect(db.getCategoryRuleById(rule1.id)).toBeNull();
    });
  });
});
