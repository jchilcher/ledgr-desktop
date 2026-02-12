import Store from 'electron-store';
import { differenceInMinutes, differenceInHours } from 'date-fns';
import { PriceCacheEntry } from '../../shared/types';

/**
 * PriceStorage - Persistent cache for stock/ETF prices using electron-store
 *
 * Features:
 * - TTL-aware staleness checking (15-minute fresh, 1-hour stale threshold)
 * - Manual price override support (locks until cleared)
 * - Batch operations for efficient multi-symbol updates
 * - Cache statistics tracking
 *
 * Storage structure:
 * {
 *   prices: {
 *     [symbol]: PriceCacheEntry
 *   }
 * }
 */

interface PriceStorageSchema {
  prices: Record<string, PriceCacheEntry>;
}

// TTL constants
const FRESH_THRESHOLD_MINUTES = 15;  // Price considered fresh for 15 minutes
const STALE_THRESHOLD_HOURS = 1;     // Price considered stale after 1 hour

class PriceStorageManager {
  private store: Store<PriceStorageSchema>;

  constructor() {
    // Initialize store synchronously - electron-store v8.2.0 is CJS-compatible
    this.store = new Store<PriceStorageSchema>({
      name: 'price-cache',
      defaults: {
        prices: {}
      }
    });
  }

  /**
   * Get cached price for a symbol
   *
   * @param symbol Ticker symbol (case-insensitive)
   * @returns PriceCacheEntry or null if not cached
   */
  get(symbol: string): PriceCacheEntry | null {
    const prices = this.store.get('prices', {});
    const entry = prices[symbol.toUpperCase()];
    return entry || null;
  }

  /**
   * Get multiple cached prices
   *
   * @param symbols Array of ticker symbols
   * @returns Map of symbol to PriceCacheEntry (only cached symbols)
   */
  getMany(symbols: string[]): Map<string, PriceCacheEntry> {
    const prices = this.store.get('prices', {});
    const result = new Map<string, PriceCacheEntry>();

    for (const symbol of symbols) {
      const upperSymbol = symbol.toUpperCase();
      const entry = prices[upperSymbol];
      if (entry) {
        result.set(upperSymbol, entry);
      }
    }

    return result;
  }

  /**
   * Get all cached prices
   *
   * @returns Map of all symbols to PriceCacheEntry
   */
  getAll(): Map<string, PriceCacheEntry> {
    const prices = this.store.get('prices', {});
    return new Map(Object.entries(prices));
  }

  /**
   * Set price for a symbol
   *
   * @param symbol Ticker symbol
   * @param price Price in cents
   * @param change Daily change in cents
   * @param changePercent Daily change percentage
   * @param currency Currency code
   * @param manual Whether this is a manual price (default: false)
   */
  set(
    symbol: string,
    price: number,
    change: number,
    changePercent: number,
    currency: string,
    manual: boolean = false
  ): void {
    const prices = this.store.get('prices', {});
    const upperSymbol = symbol.toUpperCase();

    prices[upperSymbol] = {
      symbol: upperSymbol,
      price,
      change,
      changePercent,
      timestamp: Date.now(),
      manual,
      currency
    };

    this.store.set('prices', prices);
  }

  /**
   * Set multiple prices (batch operation)
   *
   * @param entries Array of PriceCacheEntry objects
   */
  setMany(entries: PriceCacheEntry[]): void {
    const prices = this.store.get('prices', {});

    for (const entry of entries) {
      const upperSymbol = entry.symbol.toUpperCase();
      prices[upperSymbol] = {
        ...entry,
        symbol: upperSymbol
      };
    }

    this.store.set('prices', prices);
  }

  /**
   * Clear manual price override for a symbol
   *
   * @param symbol Ticker symbol
   * @returns true if manual price was cleared, false if no manual price existed
   */
  clearManualPrice(symbol: string): boolean {
    const upperSymbol = symbol.toUpperCase();
    const entry = this.get(upperSymbol);

    if (entry && entry.manual) {
      const prices = this.store.get('prices', {});
      delete prices[upperSymbol];
      this.store.set('prices', prices);
      return true;
    }

    return false;
  }

  /**
   * Delete cached price for a symbol
   *
   * @param symbol Ticker symbol
   * @returns true if price was deleted, false if not cached
   */
  delete(symbol: string): boolean {
    const upperSymbol = symbol.toUpperCase();
    const prices = this.store.get('prices', {});

    if (prices[upperSymbol]) {
      delete prices[upperSymbol];
      this.store.set('prices', prices);
      return true;
    }

    return false;
  }

  /**
   * Delete multiple cached prices
   *
   * @param symbols Array of ticker symbols
   * @returns Number of prices deleted
   */
  deleteMany(symbols: string[]): number {
    const prices = this.store.get('prices', {});
    let deletedCount = 0;

    for (const symbol of symbols) {
      const upperSymbol = symbol.toUpperCase();
      if (prices[upperSymbol]) {
        delete prices[upperSymbol];
        deletedCount++;
      }
    }

    if (deletedCount > 0) {
      this.store.set('prices', prices);
    }

    return deletedCount;
  }

  /**
   * Clear all cached prices
   */
  clear(): void {
    this.store.set('prices', {});
  }

  /**
   * Check if a price is fresh (within TTL threshold)
   *
   * @param symbol Ticker symbol
   * @returns true if fresh (< 15 minutes old), false otherwise
   */
  isFresh(symbol: string): boolean {
    const entry = this.get(symbol.toUpperCase());
    if (!entry) return false;

    // Manual prices never expire
    if (entry.manual) return true;

    const ageMinutes = differenceInMinutes(Date.now(), entry.timestamp);
    return ageMinutes < FRESH_THRESHOLD_MINUTES;
  }

  /**
   * Check if a price is stale (older than staleness threshold)
   *
   * @param symbol Ticker symbol
   * @returns true if stale (> 1 hour old), false otherwise
   */
  isStale(symbol: string): boolean {
    const entry = this.get(symbol.toUpperCase());
    if (!entry) return false;

    // Manual prices never become stale
    if (entry.manual) return false;

    const ageHours = differenceInHours(Date.now(), entry.timestamp);
    return ageHours >= STALE_THRESHOLD_HOURS;
  }

  /**
   * Get symbols that need refreshing (stale or not cached)
   *
   * @param symbols Array of ticker symbols to check
   * @returns Array of symbols that need refreshing
   */
  getNeedsRefresh(symbols: string[]): string[] {
    const needsRefresh: string[] = [];

    for (const symbol of symbols) {
      const upperSymbol = symbol.toUpperCase();
      const entry = this.get(upperSymbol);

      // Manual prices don't need refresh
      if (entry && entry.manual) continue;

      // Not cached or stale
      if (!entry || !this.isFresh(upperSymbol)) {
        needsRefresh.push(upperSymbol);
      }
    }

    return needsRefresh;
  }

  /**
   * Get cache statistics
   *
   * @returns Object with cache stats
   */
  getStatistics(): {
    totalEntries: number;
    manualEntries: number;
    freshEntries: number;
    staleEntries: number;
    expiredEntries: number;
  } {
    const prices = this.store.get('prices', {});
    const entries = Object.values(prices);

    let manualCount = 0;
    let freshCount = 0;
    let staleCount = 0;
    let expiredCount = 0;

    for (const entry of entries) {
      if (entry.manual) {
        manualCount++;
        freshCount++; // Manual prices count as fresh
        continue;
      }

      const ageMinutes = differenceInMinutes(Date.now(), entry.timestamp);
      const ageHours = differenceInHours(Date.now(), entry.timestamp);

      if (ageMinutes < FRESH_THRESHOLD_MINUTES) {
        freshCount++;
      } else if (ageHours < STALE_THRESHOLD_HOURS) {
        // Between fresh and stale (still usable)
        expiredCount++;
      } else {
        staleCount++;
      }
    }

    return {
      totalEntries: entries.length,
      manualEntries: manualCount,
      freshEntries: freshCount,
      staleEntries: staleCount,
      expiredEntries: expiredCount
    };
  }

  /**
   * Clean up stale entries (older than 24 hours)
   * Does not remove manual prices
   *
   * @returns Number of entries removed
   */
  cleanupStale(): number {
    const prices = this.store.get('prices', {});
    const entries = Object.entries(prices);
    let removedCount = 0;

    for (const [symbol, entry] of entries) {
      // Keep manual prices
      if (entry.manual) continue;

      // Remove if older than 24 hours
      const ageHours = differenceInHours(Date.now(), entry.timestamp);
      if (ageHours >= 24) {
        delete prices[symbol];
        removedCount++;
      }
    }

    if (removedCount > 0) {
      this.store.set('prices', prices);
    }

    return removedCount;
  }

  /**
   * Get the file path where prices are stored
   * Useful for debugging and backup
   *
   * @returns Absolute path to the storage file
   */
  getStorePath(): string {
    return this.store.path;
  }
}

// Export singleton instance
export const priceStorage = new PriceStorageManager();
