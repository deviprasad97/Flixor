import { Request, Response, NextFunction } from 'express';
import { cacheManager, CacheConfig } from '../services/cache/CacheManager';
import { createLogger } from '../utils/logger';

const logger = createLogger('cache-middleware');

interface CacheOptions {
  bucket: string;
  ttl?: number;
  keyGenerator?: (req: Request) => string;
  condition?: (req: Request) => boolean;
}

/**
 * Cache middleware for API responses
 */
export function cache(options: CacheOptions) {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Check if caching should be applied
    if (options.condition && !options.condition(req)) {
      return next();
    }

    // Skip caching for non-GET requests
    if (req.method !== 'GET') {
      return next();
    }

    // Generate cache key
    const key = options.keyGenerator
      ? options.keyGenerator(req)
      : `${req.path}:${JSON.stringify(req.query)}`;

    // Try to get from cache
    const cached = cacheManager.get(options.bucket, key);
    if (cached) {
      res.setHeader('X-Cache', 'HIT');
      res.setHeader('X-Cache-Bucket', options.bucket);
      return res.json(cached);
    }

    // Store original res.json
    const originalJson = res.json.bind(res);

    // Override res.json to cache the response
    res.json = function(data: any) {
      // Cache successful responses
      if (res.statusCode >= 200 && res.statusCode < 300) {
        cacheManager.set(options.bucket, key, data, options.ttl);
        res.setHeader('X-Cache', 'MISS');
        res.setHeader('X-Cache-Bucket', options.bucket);

        if (options.ttl) {
          res.setHeader('Cache-Control', `private, max-age=${options.ttl}`);
        }
      }

      return originalJson(data);
    };

    next();
  };
}

/**
 * Plex API cache middleware
 */
export function plexCache(type: keyof typeof CacheConfig.plex) {
  return cache({
    bucket: 'plex',
    ttl: CacheConfig.plex[type],
    keyGenerator: (req) => {
      const userId = (req as any).session?.user?.id || 'anonymous';
      const serverId = req.query.serverId || 'default';
      return `${userId}:${serverId}:${req.path}:${JSON.stringify(req.query)}`;
    },
    condition: (req) => !req.headers['cache-control']?.includes('no-cache'),
  });
}

/**
 * TMDB API cache middleware
 */
export function tmdbCache(type: keyof typeof CacheConfig.tmdb) {
  return cache({
    bucket: 'tmdb',
    ttl: CacheConfig.tmdb[type],
    keyGenerator: (req) => `${req.path}:${JSON.stringify(req.query)}`,
    condition: (req) => !req.headers['cache-control']?.includes('no-cache'),
  });
}

/**
 * Trakt API cache middleware
 */
export function traktCache(type: keyof typeof CacheConfig.trakt) {
  return cache({
    bucket: 'trakt',
    ttl: CacheConfig.trakt[type],
    keyGenerator: (req) => {
      const userId = (req as any).session?.user?.id || 'anonymous';
      return `${userId}:${req.path}:${JSON.stringify(req.query)}`;
    },
    condition: (req) => !req.headers['cache-control']?.includes('no-cache'),
  });
}

/**
 * Invalidate cache middleware
 */
export function invalidateCache(bucket: string, keyPattern?: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (keyPattern) {
      const keys = cacheManager.keys(bucket);
      const pattern = new RegExp(keyPattern);
      keys.forEach(key => {
        if (pattern.test(key)) {
          cacheManager.del(bucket, key);
        }
      });
      logger.info(`Invalidated cache keys matching pattern: ${keyPattern} in bucket: ${bucket}`);
    } else {
      cacheManager.flush(bucket);
      logger.info(`Flushed entire cache bucket: ${bucket}`);
    }
    next();
  };
}

/**
 * Stale-while-revalidate cache pattern
 */
export function staleWhileRevalidate(options: CacheOptions & { staleTime: number }) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (req.method !== 'GET') {
      return next();
    }

    const key = options.keyGenerator
      ? options.keyGenerator(req)
      : `${req.path}:${JSON.stringify(req.query)}`;

    // Try to get from cache
    const cached = cacheManager.get<{ data: any; timestamp: number }>(options.bucket, key);

    if (cached) {
      const age = Date.now() - cached.timestamp;
      const isStale = age > (options.staleTime * 1000);

      // Serve cached data immediately
      res.setHeader('X-Cache', isStale ? 'STALE' : 'HIT');
      res.setHeader('X-Cache-Age', String(Math.floor(age / 1000)));
      res.json(cached.data);

      // If stale, revalidate in background
      if (isStale) {
        logger.debug(`Serving stale cache for ${key}, revalidating in background`);
        // Note: In a real implementation, you'd trigger background revalidation here
      }
    } else {
      // Cache miss - proceed normally
      const originalJson = res.json.bind(res);
      res.json = function(data: any) {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          cacheManager.set(options.bucket, key, {
            data,
            timestamp: Date.now()
          }, options.ttl);
          res.setHeader('X-Cache', 'MISS');
        }
        return originalJson(data);
      };
      next();
    }
  };
}