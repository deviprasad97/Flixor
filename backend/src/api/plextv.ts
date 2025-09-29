import { Router, Response, NextFunction } from 'express';
import axios from 'axios';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { createLogger } from '../utils/logger';
import { AppDataSource } from '../db/data-source';
import { User } from '../db/entities/User';
import { decryptForUser, isEncrypted } from '../utils/crypto';
import { cacheManager } from '../services/cache/CacheManager';

const router = Router();
const logger = createLogger('plextv');
const DISCOVER_BASE = 'https://discover.provider.plex.tv';

async function getAccountToken(userId: string): Promise<string> {
  const repo = AppDataSource.getRepository(User);
  const user = await repo.createQueryBuilder('u')
    .addSelect('u.plexToken')
    .where('u.id = :userId', { userId })
    .getOne();
  if (!user?.plexToken) throw new AppError('Plex account token not found', 400);
  return isEncrypted(user.plexToken) ? decryptForUser(userId, user.plexToken) : user.plexToken;
}

// GET /api/plextv/watchlist
router.get('/watchlist', requireAuth, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const token = await getAccountToken(req.user!.id);
    const start = req.query.start ? Number(req.query.start) : 0;
    const size = req.query.size ? Number(req.query.size) : 200;
    const key = `plextv:watchlist:${req.user!.id}:${start}:${size}`;
    const cached = cacheManager.get<any>('plex', key);
    if (cached) return res.json(cached);

    const params = new URLSearchParams({
      'X-Plex-Token': token,
      includeAdvanced: '1',
      includeMeta: '1',
      'X-Plex-Container-Start': String(start),
      'X-Plex-Container-Size': String(size),
    });
    const url = `${DISCOVER_BASE}/library/sections/watchlist/all?${params}`;
    const response = await axios.get(url, { headers: { Accept: 'application/json' } });
    cacheManager.set('plex', key, response.data, 60); // 60s TTL
    res.json(response.data);
  } catch (e: any) {
    const status = e?.response?.status;
    if (status === 429) {
      const retry = e?.response?.headers?.['retry-after'];
      logger.warn('Plex.tv rate limited', { retryAfter: retry });
      return res.status(429).json({ ok: false, error: 'rate_limited', retryAfter: retry });
    }
    logger.error('Watchlist fetch failed', e);
    next(new AppError('Failed to fetch Plex watchlist', 500));
  }
});

// PUT /api/plextv/watchlist/:id
router.put('/watchlist/:id', requireAuth, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const token = await getAccountToken(req.user!.id);
    const id = encodeURIComponent(req.params.id);
    const url = `${DISCOVER_BASE}/library/metadata/${id}/watchlist?X-Plex-Token=${encodeURIComponent(token)}`;
    const response = await axios.put(url);
    cacheManager.flush('plex');
    res.json({ ok: true, status: response.status });
  } catch (e: any) {
    logger.error('Add to Plex watchlist failed', e);
    next(new AppError('Failed to add to Plex watchlist', 500));
  }
});

// DELETE /api/plextv/watchlist/:id
router.delete('/watchlist/:id', requireAuth, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const token = await getAccountToken(req.user!.id);
    const id = encodeURIComponent(req.params.id);
    const url = `${DISCOVER_BASE}/library/metadata/${id}/watchlist?X-Plex-Token=${encodeURIComponent(token)}`;
    const response = await axios.delete(url);
    cacheManager.flush('plex');
    res.json({ ok: true, status: response.status });
  } catch (e: any) {
    logger.error('Remove from Plex watchlist failed', e);
    next(new AppError('Failed to remove from Plex watchlist', 500));
  }
});

export default router;

