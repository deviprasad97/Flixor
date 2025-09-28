import { Router, Request, Response, NextFunction } from 'express';
import { cacheManager } from '../services/cache/CacheManager';
import { AppError } from '../middleware/errorHandler';
import { requireAuth } from '../middleware/auth';
import { createLogger } from '../utils/logger';

const router = Router();
const logger = createLogger('cache-api');

/**
 * Get cache statistics
 * GET /api/cache/stats
 */
router.get('/stats', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const bucket = req.query.bucket as string | undefined;
    const stats = cacheManager.getStats(bucket);

    const summary = {
      buckets: stats.length,
      totalKeys: stats.reduce((sum, s) => sum + s.keys, 0),
      totalHits: stats.reduce((sum, s) => sum + s.hits, 0),
      totalMisses: stats.reduce((sum, s) => sum + s.misses, 0),
      overallHitRate: 0,
      totalMemoryUsage: stats.reduce((sum, s) => sum + s.memoryUsage, 0),
      details: stats,
    };

    const totalRequests = summary.totalHits + summary.totalMisses;
    if (totalRequests > 0) {
      summary.overallHitRate = Math.round((summary.totalHits / totalRequests) * 10000) / 100;
    }

    res.json(summary);
  } catch (error) {
    logger.error('Failed to get cache stats:', error);
    next(new AppError('Failed to get cache statistics', 500));
  }
});

/**
 * List cache keys
 * GET /api/cache/keys?bucket=tmdb
 */
router.get('/keys', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const bucket = req.query.bucket as string;

    if (!bucket) {
      throw new AppError('Bucket name is required', 400);
    }

    const keys = cacheManager.keys(bucket);
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 100;
    const offset = req.query.offset ? parseInt(req.query.offset as string, 10) : 0;

    const paginatedKeys = keys.slice(offset, offset + limit);

    res.json({
      bucket,
      total: keys.length,
      limit,
      offset,
      keys: paginatedKeys,
    });
  } catch (error) {
    logger.error('Failed to list cache keys:', error);
    next(new AppError('Failed to list cache keys', 500));
  }
});

/**
 * Get cached value by key
 * GET /api/cache/get?bucket=tmdb&key=trending:tv:week
 */
router.get('/get', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { bucket, key } = req.query;

    if (!bucket || !key) {
      throw new AppError('Bucket and key are required', 400);
    }

    const value = cacheManager.get(bucket as string, key as string);

    if (value === undefined) {
      return res.status(404).json({
        error: 'Key not found in cache',
        bucket,
        key,
      });
    }

    res.json({
      bucket,
      key,
      value,
      size: JSON.stringify(value).length,
    });
  } catch (error) {
    logger.error('Failed to get cache value:', error);
    next(new AppError('Failed to get cache value', 500));
  }
});

/**
 * Delete cache key
 * DELETE /api/cache/key?bucket=tmdb&key=trending:tv:week
 */
router.delete('/key', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { bucket, key } = req.query;

    if (!bucket || !key) {
      throw new AppError('Bucket and key are required', 400);
    }

    const deleted = cacheManager.del(bucket as string, key as string);

    res.json({
      message: deleted ? 'Key deleted successfully' : 'Key not found',
      bucket,
      key,
      deleted,
    });
  } catch (error) {
    logger.error('Failed to delete cache key:', error);
    next(new AppError('Failed to delete cache key', 500));
  }
});

/**
 * Flush cache bucket or all buckets
 * POST /api/cache/flush?bucket=tmdb
 */
router.post('/flush', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const bucket = req.query.bucket as string | undefined;

    cacheManager.flush(bucket);

    res.json({
      message: bucket ? `Flushed bucket: ${bucket}` : 'Flushed all cache buckets',
      bucket: bucket || 'all',
      timestamp: new Date().toISOString(),
    });

    logger.info(`Cache flushed: ${bucket || 'all buckets'}`);
  } catch (error) {
    logger.error('Failed to flush cache:', error);
    next(new AppError('Failed to flush cache', 500));
  }
});

/**
 * Warm up cache with specific data
 * POST /api/cache/warm
 */
router.post('/warm', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { bucket, key, value, ttl } = req.body;

    if (!bucket || !key || value === undefined) {
      throw new AppError('Bucket, key, and value are required', 400);
    }

    const success = cacheManager.set(bucket, key, value, ttl);

    res.json({
      message: success ? 'Cache warmed successfully' : 'Failed to warm cache',
      bucket,
      key,
      ttl,
      success,
    });

    if (success) {
      logger.info(`Cache warmed: ${bucket}:${key}`);
    }
  } catch (error) {
    logger.error('Failed to warm cache:', error);
    next(new AppError('Failed to warm cache', 500));
  }
});

/**
 * Get cache configuration
 * GET /api/cache/config
 */
router.get('/config', (req: Request, res: Response) => {
  const { CacheConfig } = require('../services/cache/CacheManager');
  res.json(CacheConfig);
});

/**
 * Health check for cache system
 * GET /api/cache/health
 */
router.get('/health', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Test cache operations
    const testKey = '__health_check__';
    const testValue = { timestamp: Date.now() };

    // Test set
    const setSuccess = cacheManager.set('general', testKey, testValue, 10);

    // Test get
    const getValue = cacheManager.get('general', testKey);

    // Test delete
    const deleteSuccess = cacheManager.del('general', testKey);

    const healthy = setSuccess && getValue && deleteSuccess;

    res.status(healthy ? 200 : 503).json({
      status: healthy ? 'healthy' : 'unhealthy',
      checks: {
        set: setSuccess,
        get: !!getValue,
        delete: deleteSuccess,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Cache health check failed:', error);
    res.status(503).json({
      status: 'unhealthy',
      error: 'Health check failed',
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * Bulk operations
 * POST /api/cache/bulk
 */
router.post('/bulk', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { operations } = req.body;

    if (!Array.isArray(operations)) {
      throw new AppError('Operations must be an array', 400);
    }

    const results = [];

    for (const op of operations) {
      const { action, bucket, key, value, ttl } = op;

      switch (action) {
        case 'set':
          results.push({
            action,
            bucket,
            key,
            success: cacheManager.set(bucket, key, value, ttl),
          });
          break;

        case 'get':
          results.push({
            action,
            bucket,
            key,
            value: cacheManager.get(bucket, key),
          });
          break;

        case 'delete':
          results.push({
            action,
            bucket,
            key,
            success: cacheManager.del(bucket, key),
          });
          break;

        default:
          results.push({
            action,
            error: 'Unknown action',
          });
      }
    }

    res.json({
      total: operations.length,
      results,
    });
  } catch (error) {
    logger.error('Bulk cache operation failed:', error);
    next(new AppError('Bulk operation failed', 500));
  }
});

export default router;