import { Router, Request, Response, NextFunction } from 'express';
import axios from 'axios';
import { AppDataSource } from '../db/data-source';
import { User, UserSettings } from '../db/entities';
import { AppError } from '../middleware/errorHandler';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';
import { createLogger } from '../utils/logger';
import crypto from 'crypto';

const router = Router();
const logger = createLogger('auth');

// Plex.tv API endpoints
const PLEX_TV_URL = 'https://plex.tv';

// Helper to get Plex headers
function getPlexHeaders(clientId: string, token?: string) {
  const headers: any = {
    'X-Plex-Product': 'Plex Web',
    'X-Plex-Version': '4.128.1',
    'X-Plex-Client-Identifier': clientId,
    'X-Plex-Device': 'OSX',
    'X-Plex-Device-Name': 'Chrome',
    'X-Plex-Device-Screen-Resolution': '1920x1080',
    'X-Plex-Platform': 'Chrome',
    'X-Plex-Platform-Version': '140.0',
    'Accept': 'application/json',
  };
  if (token) {
    headers['X-Plex-Token'] = token;
  }
  return headers;
}

// Initialize Plex OAuth
router.post('/plex/pin', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const clientId = req.body.clientId || crypto.randomUUID();

    const response = await axios.post(
      `${PLEX_TV_URL}/api/v2/pins`,
      {},
      { headers: getPlexHeaders(clientId) }
    );

    const authUrl = `https://app.plex.tv/auth#?` +
      `clientID=${encodeURIComponent(clientId)}` +
      `&code=${response.data.code}` +
      `&context%5Bdevice%5D%5Bproduct%5D=Plex%20Web` +
      `&context%5Bdevice%5D%5Bplatform%5D=Chrome` +
      `&context%5Bdevice%5D%5Bdevice%5D=OSX` +
      `&context%5Bdevice%5D%5Bversion%5D=4.128.1`;

    res.json({
      id: response.data.id,
      code: response.data.code,
      clientId,
      authUrl,
    });
  } catch (error) {
    logger.error('Failed to create Plex PIN:', error);
    next(new AppError('Failed to initialize Plex authentication', 500));
  }
});

// Check Plex PIN status
router.get('/plex/pin/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { clientId } = req.query;

    if (!clientId) {
      throw new AppError('Client ID is required', 400);
    }

    const response = await axios.get(
      `${PLEX_TV_URL}/api/v2/pins/${id}`,
      { headers: getPlexHeaders(clientId as string) }
    );

    if (response.data.authToken) {
      // PIN has been authenticated
      const token = response.data.authToken;

      // Get user info
      const userResponse = await axios.get(
        `${PLEX_TV_URL}/api/v2/user`,
        { headers: getPlexHeaders(clientId as string, token) }
      );

      const plexUser = userResponse.data;

      // Save or update user in database
      const userRepository = AppDataSource.getRepository(User);
      const settingsRepository = AppDataSource.getRepository(UserSettings);

      let user = await userRepository.findOne({ where: { plexId: plexUser.id } });

      if (!user) {
        // Create new user
        user = userRepository.create({
          plexId: plexUser.id,
          username: plexUser.username || plexUser.title,
          email: plexUser.email,
          thumb: plexUser.thumb,
          title: plexUser.title,
          plexToken: token,
          hasPassword: plexUser.hasPassword || false,
          subscription: plexUser.subscription ? {
            active: plexUser.subscription.active,
            status: plexUser.subscription.status,
            plan: plexUser.subscription.plan,
          } : undefined,
        });
        user = await userRepository.save(user);

        // Create default settings
        const settings = settingsRepository.create({
          userId: user.id,
          preferences: {
            language: 'en',
            autoPlay: true,
            quality: 'auto',
            subtitles: false,
            theme: 'dark',
          },
        });
        await settingsRepository.save(settings);
      } else {
        // Update existing user
        user.username = plexUser.username || plexUser.title;
        user.email = plexUser.email;
        user.thumb = plexUser.thumb;
        user.plexToken = token;
        user.subscription = plexUser.subscription ? {
          active: plexUser.subscription.active,
          status: plexUser.subscription.status,
          plan: plexUser.subscription.plan,
        } : undefined;
        await userRepository.save(user);
      }

      // Create session
      req.session.userId = user.id;
      req.session.plexId = user.plexId;
      req.session.username = user.username;

      await new Promise((resolve, reject) => {
        req.session.save((err) => err ? reject(err) : resolve(undefined));
      });

      logger.info(`User authenticated: ${user.username} (${user.plexId})`);

      res.json({
        authenticated: true,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          thumb: user.thumb,
          subscription: user.subscription,
        },
      });
    } else {
      // PIN not yet authenticated
      res.json({ authenticated: false });
    }
  } catch (error) {
    logger.error('Failed to check Plex PIN:', error);
    next(new AppError('Failed to check authentication status', 500));
  }
});

// Get current session
router.get('/session', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.session.userId) {
      return res.json({ authenticated: false });
    }

    const userRepository = AppDataSource.getRepository(User);
    const user = await userRepository.findOne({
      where: { id: req.session.userId },
      select: ['id', 'username', 'email', 'thumb', 'subscription'],
    });

    if (!user) {
      req.session.destroy(() => {});
      return res.json({ authenticated: false });
    }

    res.json({
      authenticated: true,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        thumb: user.thumb,
        subscription: user.subscription,
      },
    });
  } catch (error) {
    logger.error('Failed to get session:', error);
    next(new AppError('Failed to get session', 500));
  }
});

// Validate session
router.get('/validate', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  res.json({
    valid: true,
    user: req.user,
  });
});

// Logout
router.post('/logout', (req: Request, res: Response, next: NextFunction) => {
  req.session.destroy((err) => {
    if (err) {
      logger.error('Failed to destroy session:', err);
      return next(new AppError('Failed to logout', 500));
    }

    res.clearCookie('plex.sid');
    res.json({ success: true });
  });
});

// Get Plex servers for authenticated user
router.get('/servers', requireAuth, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userRepository = AppDataSource.getRepository(User);
    const user = await userRepository.findOne({
      where: { id: req.user!.id },
      select: ['plexToken'],
    });

    if (!user) {
      throw new AppError('User not found', 404);
    }

    const response = await axios.get(
      `${PLEX_TV_URL}/api/v2/resources?includeHttps=1&includeRelay=1`,
      {
        headers: getPlexHeaders(req.body.clientId || 'web', user.plexToken),
      }
    );

    const servers = response.data
      .filter((r: any) => r.product === 'Plex Media Server')
      .map((server: any) => {
        // Find best connection
        const connections = server.connections || [];
        const local = connections.find((c: any) => c.local);
        const remote = connections.find((c: any) => !c.local && !c.relay);
        const relay = connections.find((c: any) => c.relay);

        const bestConnection = local || remote || relay;

        return {
          name: server.name,
          clientIdentifier: server.clientIdentifier,
          baseUrl: bestConnection?.uri,
          token: server.accessToken,
          connections: connections.map((c: any) => ({
            uri: c.uri,
            local: c.local,
            relay: c.relay,
            protocol: c.protocol,
          })),
        };
      });

    res.json(servers);
  } catch (error) {
    logger.error('Failed to get Plex servers:', error);
    next(new AppError('Failed to get servers', 500));
  }
});

export { router as authRouter };