import { Router, Request, Response, NextFunction } from 'express';
import { getPlexClient, clearPlexClients } from '../services/plex/PlexClient';
import { AppError } from '../middleware/errorHandler';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';
import { createLogger } from '../utils/logger';
import { AppDataSource } from '../db/data-source';
import { UserSettings } from '../db/entities';

const router = Router();
const logger = createLogger('plex-api');

// All Plex routes require authentication
router.use(requireAuth);

/**
 * Get available Plex servers
 * GET /api/plex/servers
 */
router.get('/servers',
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const settingsRepo = AppDataSource.getRepository(UserSettings);
      const settings = await settingsRepo.findOne({ where: { userId } });

      if (!settings?.plexServers) {
        return res.json([]);
      }

      // Return servers without tokens
      const servers = settings.plexServers.map((server: any) => ({
        id: server.id,
        name: server.name,
        host: server.host,
        port: server.port,
        protocol: server.protocol,
        owned: server.owned,
        publicAddress: server.publicAddress,
        localAddresses: server.localAddresses,
        isActive: server.id === settings.currentServerId
      }));

      res.json(servers);
    } catch (error: any) {
      logger.error('Failed to get servers', error);
      next(new AppError(error.message || 'Failed to get servers', 500));
    }
  }
);

/**
 * Set current server
 * POST /api/plex/servers/current
 */
router.post('/servers/current',
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const { serverId } = req.body;

      if (!serverId) {
        throw new AppError('Server ID is required', 400);
      }

      const settingsRepo = AppDataSource.getRepository(UserSettings);
      const settings = await settingsRepo.findOne({ where: { userId } });

      if (!settings) {
        throw new AppError('Settings not found', 404);
      }

      const server = settings.plexServers?.find((s: any) => s.id === serverId);
      if (!server) {
        throw new AppError('Server not found', 404);
      }

      settings.currentServerId = serverId;
      await settingsRepo.save(settings);

      // Clear cached clients for this user
      clearPlexClients(userId);

      res.json({
        message: 'Current server updated',
        serverId
      });
    } catch (error: any) {
      logger.error('Failed to set current server', error);
      next(error instanceof AppError ? error : new AppError('Failed to set current server', 500));
    }
  }
);

/**
 * Get libraries
 * GET /api/plex/libraries
 */
router.get('/libraries',
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const client = await getPlexClient(req.user!.id);
      const libraries = await client.getLibraries();
      res.json(libraries);
    } catch (error: any) {
      logger.error('Failed to get libraries', error);
      next(new AppError(error.message || 'Failed to get libraries', 500));
    }
  }
);

/**
 * Get library contents
 * GET /api/plex/library/:id/all
 */
router.get('/library/:id/all',
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const offset = parseInt(req.query.offset as string) || 0;
      const limit = parseInt(req.query.limit as string) || 50;

      const client = await getPlexClient(req.user!.id);
      const contents = await client.getLibraryContents(id, offset, limit);

      res.json(contents);
    } catch (error: any) {
      logger.error('Failed to get library contents', error);
      next(new AppError(error.message || 'Failed to get library contents', 500));
    }
  }
);

/**
 * Get metadata for an item
 * GET /api/plex/metadata/:id
 */
router.get('/metadata/:id',
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      const client = await getPlexClient(req.user!.id);
      const metadata = await client.getMetadata(id);

      res.json(metadata);
    } catch (error: any) {
      logger.error('Failed to get metadata', error);
      next(new AppError(error.message || 'Failed to get metadata', 500));
    }
  }
);

/**
 * Search across all libraries
 * GET /api/plex/search
 */
router.get('/search',
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const query = req.query.query as string;

      if (!query) {
        throw new AppError('Query parameter is required', 400);
      }

      const client = await getPlexClient(req.user!.id);
      const results = await client.search(query);

      res.json(results);
    } catch (error: any) {
      logger.error('Search failed', error);
      next(error instanceof AppError ? error : new AppError('Search failed', 500));
    }
  }
);

/**
 * Get on deck items
 * GET /api/plex/ondeck
 */
router.get('/ondeck',
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const client = await getPlexClient(req.user!.id);
      const onDeck = await client.getOnDeck();

      res.json(onDeck);
    } catch (error: any) {
      logger.error('Failed to get on deck', error);
      next(new AppError(error.message || 'Failed to get on deck items', 500));
    }
  }
);

/**
 * Get continue watching
 * GET /api/plex/continue
 */
router.get('/continue',
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const client = await getPlexClient(req.user!.id);
      const continueWatching = await client.getContinueWatching();

      res.json(continueWatching);
    } catch (error: any) {
      logger.error('Failed to get continue watching', error);
      next(new AppError(error.message || 'Failed to get continue watching', 500));
    }
  }
);

/**
 * Get recently added
 * GET /api/plex/recent
 */
router.get('/recent',
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const libraryKey = req.query.library as string | undefined;

      const client = await getPlexClient(req.user!.id);
      const recent = await client.getRecentlyAdded(libraryKey);

      res.json(recent);
    } catch (error: any) {
      logger.error('Failed to get recently added', error);
      next(new AppError(error.message || 'Failed to get recently added', 500));
    }
  }
);

/**
 * Update playback progress
 * POST /api/plex/progress
 */
router.post('/progress',
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { ratingKey, time, duration } = req.body;

      if (!ratingKey || time === undefined || !duration) {
        throw new AppError('Missing required parameters', 400);
      }

      const client = await getPlexClient(req.user!.id);
      await client.updateProgress(ratingKey, time, duration);

      res.json({
        message: 'Progress updated',
        ratingKey,
        time,
        duration
      });
    } catch (error: any) {
      logger.error('Failed to update progress', error);
      next(error instanceof AppError ? error : new AppError('Failed to update progress', 500));
    }
  }
);

/**
 * Scrobble (mark as watched)
 * POST /api/plex/scrobble
 */
router.post('/scrobble',
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { ratingKey } = req.body;

      if (!ratingKey) {
        throw new AppError('Rating key is required', 400);
      }

      const client = await getPlexClient(req.user!.id);
      await client.scrobble(ratingKey);

      res.json({
        message: 'Item marked as watched',
        ratingKey
      });
    } catch (error: any) {
      logger.error('Failed to scrobble', error);
      next(error instanceof AppError ? error : new AppError('Failed to scrobble', 500));
    }
  }
);

/**
 * Rate an item
 * POST /api/plex/rate
 */
router.post('/rate',
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { ratingKey, rating } = req.body;

      if (!ratingKey || rating === undefined) {
        throw new AppError('Rating key and rating are required', 400);
      }

      if (rating < 0 || rating > 10) {
        throw new AppError('Rating must be between 0 and 10', 400);
      }

      const client = await getPlexClient(req.user!.id);
      await client.rate(ratingKey, rating);

      res.json({
        message: 'Rating updated',
        ratingKey,
        rating
      });
    } catch (error: any) {
      logger.error('Failed to rate item', error);
      next(error instanceof AppError ? error : new AppError('Failed to rate item', 500));
    }
  }
);

/**
 * Get transcode decision
 * POST /api/plex/transcode/decision
 */
router.post('/transcode/decision',
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { ratingKey, ...options } = req.body;

      if (!ratingKey) {
        throw new AppError('Rating key is required', 400);
      }

      const client = await getPlexClient(req.user!.id);
      const decision = await client.getTranscodeDecision(ratingKey, options);

      res.json(decision);
    } catch (error: any) {
      logger.error('Failed to get transcode decision', error);
      next(error instanceof AppError ? error : new AppError('Failed to get transcode decision', 500));
    }
  }
);

/**
 * Get streaming URL
 * GET /api/plex/stream/:ratingKey
 */
router.get('/stream/:ratingKey',
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { ratingKey } = req.params;
      const options = {
        quality: req.query.quality,
        resolution: req.query.resolution,
        mediaIndex: req.query.mediaIndex,
        partIndex: req.query.partIndex,
        audioStreamID: req.query.audioStreamID,
        subtitleStreamID: req.query.subtitleStreamID,
      };

      const client = await getPlexClient(req.user!.id);
      const streamUrl = await client.getStreamingUrl(ratingKey, options);

      res.json({
        url: streamUrl,
        ratingKey,
        options
      });
    } catch (error: any) {
      logger.error('Failed to get streaming URL', error);
      next(error instanceof AppError ? error : new AppError('Failed to get streaming URL', 500));
    }
  }
);

/**
 * Proxy media stream
 * GET /api/plex/proxy/:path*
 */
router.get('/proxy/*',
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const path = req.params[0];
      const client = await getPlexClient(req.user!.id);
      const serverInfo = client.getServerInfo();

      // Build the full URL
      const url = `${serverInfo.protocol}://${serverInfo.host}:${serverInfo.port}/${path}`;

      // Add token if not present
      const urlWithToken = url.includes('X-Plex-Token')
        ? url
        : `${url}${url.includes('?') ? '&' : '?'}X-Plex-Token=${serverInfo.accessToken}`;

      // Proxy the request
      const axios = require('axios');
      const response = await axios({
        method: 'GET',
        url: urlWithToken,
        responseType: 'stream',
        headers: {
          'Range': req.headers.range,
          'Accept': req.headers.accept,
        }
      });

      // Forward headers
      Object.keys(response.headers).forEach(key => {
        res.setHeader(key, response.headers[key]);
      });

      // Pipe the stream
      response.data.pipe(res);
    } catch (error: any) {
      logger.error('Failed to proxy media', error);
      next(new AppError('Failed to proxy media stream', 500));
    }
  }
);

/**
 * Test server connection
 * GET /api/plex/test
 */
router.get('/test',
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const serverId = req.query.serverId as string | undefined;
      const client = await getPlexClient(req.user!.id, serverId);

      const isConnected = await client.testConnection();
      const capabilities = isConnected ? await client.getServerCapabilities() : null;

      res.json({
        connected: isConnected,
        server: client.getServerInfo().name,
        capabilities
      });
    } catch (error: any) {
      logger.error('Connection test failed', error);
      next(new AppError(error.message || 'Connection test failed', 500));
    }
  }
);

export default router;