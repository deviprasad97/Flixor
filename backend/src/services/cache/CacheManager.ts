import NodeCache from 'node-cache';
import { createLogger } from '../../utils/logger';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const logger = createLogger('cache');

// Cache configuration per service
export const CacheConfig = {
  plex: {
    metadata: 3600,      // 1 hour
    search: 300,         // 5 minutes
    libraries: 86400,    // 24 hours
    ondeck: 60,          // 1 minute
    watchlist: 300,      // 5 minutes
  },
  tmdb: {
    trending: 3600,      // 1 hour
    details: 86400,      // 24 hours
    search: 1800,        // 30 minutes
    images: 604800,      // 7 days
    credits: 86400,      // 24 hours
  },
  trakt: {
    watchlist: 300,      // 5 minutes
    history: 60,         // 1 minute
    popular: 3600,       // 1 hour
    trending: 1800,      // 30 minutes
  },
  image: {
    thumbnail: 604800,   // 7 days
    poster: 604800,      // 7 days
    backdrop: 604800,    // 7 days
  }
};

interface CacheBucket {
  name: string;
  cache: NodeCache;
  hits: number;
  misses: number;
  sets: number;
  deletes: number;
}

interface CacheStats {
  bucket: string;
  keys: number;
  hits: number;
  misses: number;
  hitRate: number;
  memoryUsage: number;
}

class CacheManager {
  private buckets: Map<string, CacheBucket>;
  private imageCacheDir: string;

  constructor() {
    this.buckets = new Map();
    this.imageCacheDir = process.env.IMAGE_CACHE_DIR || path.join(process.cwd(), 'cache', 'images');

    // Ensure image cache directory exists
    if (!fs.existsSync(this.imageCacheDir)) {
      fs.mkdirSync(this.imageCacheDir, { recursive: true });
      logger.info(`Created image cache directory: ${this.imageCacheDir}`);
    }

    // Initialize default buckets
    this.createBucket('plex', 3600);    // Default 1 hour TTL
    this.createBucket('tmdb', 3600);
    this.createBucket('trakt', 1800);   // Default 30 minutes TTL
    this.createBucket('image', 86400);  // Default 24 hours TTL
    this.createBucket('general', 600);  // Default 10 minutes TTL
  }

  /**
   * Create or get a cache bucket
   */
  createBucket(name: string, defaultTtl: number = 600): CacheBucket {
    if (this.buckets.has(name)) {
      return this.buckets.get(name)!;
    }

    const cache = new NodeCache({
      stdTTL: defaultTtl,
      checkperiod: 120,
      useClones: false,
      deleteOnExpire: true,
    });

    const bucket: CacheBucket = {
      name,
      cache,
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
    };

    // Track statistics
    cache.on('hit', () => bucket.hits++);
    cache.on('miss', () => bucket.misses++);
    cache.on('set', () => bucket.sets++);
    cache.on('del', () => bucket.deletes++);

    this.buckets.set(name, bucket);
    logger.info(`Created cache bucket: ${name} with default TTL: ${defaultTtl}s`);

    return bucket;
  }

  /**
   * Get a value from cache
   */
  get<T = any>(bucket: string, key: string): T | undefined {
    const b = this.buckets.get(bucket);
    if (!b) {
      logger.warn(`Cache bucket '${bucket}' not found`);
      return undefined;
    }

    const value = b.cache.get<T>(key);
    if (value !== undefined) {
      logger.debug(`Cache HIT: ${bucket}:${key}`);
    } else {
      logger.debug(`Cache MISS: ${bucket}:${key}`);
    }

    return value;
  }

  /**
   * Set a value in cache
   */
  set(bucket: string, key: string, value: any, ttl?: number): boolean {
    const b = this.buckets.get(bucket);
    if (!b) {
      logger.warn(`Cache bucket '${bucket}' not found`);
      return false;
    }

    const success = ttl ? b.cache.set(key, value, ttl) : b.cache.set(key, value);
    if (success) {
      logger.debug(`Cache SET: ${bucket}:${key} (TTL: ${ttl || b.cache.options.stdTTL}s)`);
    }

    return success;
  }

  /**
   * Delete a key from cache
   */
  del(bucket: string, key: string): boolean {
    const b = this.buckets.get(bucket);
    if (!b) {
      return false;
    }

    const deleted = b.cache.del(key);
    if (deleted > 0) {
      logger.debug(`Cache DELETE: ${bucket}:${key}`);
      return true;
    }

    return false;
  }

  /**
   * Flush a specific bucket or all buckets
   */
  flush(bucket?: string): void {
    if (bucket) {
      const b = this.buckets.get(bucket);
      if (b) {
        b.cache.flushAll();
        logger.info(`Flushed cache bucket: ${bucket}`);
      }
    } else {
      this.buckets.forEach((b) => {
        b.cache.flushAll();
      });
      logger.info('Flushed all cache buckets');
    }
  }

  /**
   * Get cache statistics
   */
  getStats(bucket?: string): CacheStats[] {
    const stats: CacheStats[] = [];

    const bucketsToCheck = bucket
      ? [this.buckets.get(bucket)].filter(Boolean) as CacheBucket[]
      : Array.from(this.buckets.values());

    for (const b of bucketsToCheck) {
      const keys = b.cache.keys();
      const hitRate = b.hits + b.misses > 0
        ? (b.hits / (b.hits + b.misses)) * 100
        : 0;

      // Estimate memory usage
      let memoryUsage = 0;
      keys.forEach(key => {
        const value = b.cache.get(key);
        if (value) {
          memoryUsage += JSON.stringify(value).length;
        }
      });

      stats.push({
        bucket: b.name,
        keys: keys.length,
        hits: b.hits,
        misses: b.misses,
        hitRate: Math.round(hitRate * 100) / 100,
        memoryUsage,
      });
    }

    return stats;
  }

  /**
   * List all keys in a bucket
   */
  keys(bucket: string): string[] {
    const b = this.buckets.get(bucket);
    return b ? b.cache.keys() : [];
  }

  /**
   * Generate a cache key from multiple parts
   */
  static generateKey(...parts: any[]): string {
    return parts.map(p => String(p)).join(':');
  }

  /**
   * Generate a hash-based cache key for long inputs
   */
  static generateHashKey(input: string): string {
    return crypto.createHash('sha256').update(input).digest('hex').substring(0, 16);
  }

  /**
   * Get or set with callback (cache-aside pattern)
   */
  async getOrSet<T>(
    bucket: string,
    key: string,
    callback: () => Promise<T>,
    ttl?: number
  ): Promise<T> {
    // Try to get from cache
    const cached = this.get<T>(bucket, key);
    if (cached !== undefined) {
      return cached;
    }

    // Execute callback and cache result
    try {
      const result = await callback();
      this.set(bucket, key, result, ttl);
      return result;
    } catch (error) {
      logger.error(`Failed to execute cache callback for ${bucket}:${key}`, error);
      throw error;
    }
  }

  /**
   * Get image cache path
   */
  getImageCachePath(url: string): string {
    const hash = CacheManager.generateHashKey(url);
    const ext = path.extname(new URL(url).pathname) || '.jpg';
    return path.join(this.imageCacheDir, `${hash}${ext}`);
  }

  /**
   * Check if image is cached on disk
   */
  isImageCached(url: string): boolean {
    const cachePath = this.getImageCachePath(url);
    return fs.existsSync(cachePath);
  }

  /**
   * Clean up old image cache files
   */
  async cleanupImageCache(maxAgeMs: number = 7 * 24 * 60 * 60 * 1000): Promise<number> {
    const now = Date.now();
    let deleted = 0;

    try {
      const files = fs.readdirSync(this.imageCacheDir);

      for (const file of files) {
        const filePath = path.join(this.imageCacheDir, file);
        const stats = fs.statSync(filePath);

        if (now - stats.mtimeMs > maxAgeMs) {
          fs.unlinkSync(filePath);
          deleted++;
        }
      }

      if (deleted > 0) {
        logger.info(`Cleaned up ${deleted} old image cache files`);
      }
    } catch (error) {
      logger.error('Failed to cleanup image cache', error);
    }

    return deleted;
  }
}

// Export singleton instance
export const cacheManager = new CacheManager();

// Export for testing
export { CacheManager };