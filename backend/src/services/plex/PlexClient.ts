import axios, { AxiosInstance, AxiosError } from 'axios';
import { cacheManager } from '../cache/CacheManager';
import { createLogger } from '../../utils/logger';
import { AppDataSource } from '../../db/data-source';
import { UserSettings } from '../../db/entities';
import crypto from 'crypto';

const logger = createLogger('plex');

interface PlexServer {
  id: string;
  name: string;
  host: string;
  port: number;
  protocol: 'http' | 'https';
  accessToken: string;
  owned: boolean;
  publicAddress?: string;
  localAddresses?: string[];
}

interface PlexLibrary {
  key: string;
  title: string;
  type: 'movie' | 'show' | 'music' | 'photo';
  agent?: string;
  scanner?: string;
  language?: string;
}

interface PlexMetadata {
  key: string;
  ratingKey: string;
  guid: string;
  type: string;
  title: string;
  summary?: string;
  year?: number;
  thumb?: string;
  art?: string;
  duration?: number;
  viewOffset?: number;
  viewCount?: number;
  lastViewedAt?: number;
}

export class PlexClient {
  private axiosClient: AxiosInstance;
  private server: PlexServer;
  private userId: string;
  private encryptionKey: Buffer;

  constructor(server: PlexServer, userId: string) {
    this.server = server;
    this.userId = userId;

    // Generate encryption key from server ID and user ID
    this.encryptionKey = crypto.scryptSync(
      process.env.SESSION_SECRET || 'default-secret',
      `${server.id}:${userId}`,
      32
    );

    const baseURL = `${server.protocol}://${server.host}:${server.port}`;

    this.axiosClient = axios.create({
      baseURL,
      timeout: 30000,
      headers: {
        'Accept': 'application/json',
        'X-Plex-Token': server.accessToken,
        'X-Plex-Client-Identifier': process.env.PLEX_CLIENT_ID || 'plex-media-backend',
        'X-Plex-Product': 'Plex Web',
        'X-Plex-Version': '4.128.1',
        'X-Plex-Platform': 'Web',
        'X-Plex-Platform-Version': '4.128.1',
        'X-Plex-Device': 'Web',
        'X-Plex-Device-Name': 'Plex Media Backend',
      }
    });

    // Add error handling
    this.axiosClient.interceptors.response.use(
      response => response,
      this.handleError.bind(this)
    );

    logger.info(`Plex client initialized for server ${server.name}`, {
      userId,
      serverId: server.id,
      host: server.host
    });
  }

  private handleError(error: AxiosError) {
    if (error.response) {
      const status = error.response.status;
      logger.error(`Plex API error: ${status}`, {
        url: error.config?.url,
        server: this.server.name,
        userId: this.userId
      });

      if (status === 401) {
        throw new Error('Invalid Plex token');
      } else if (status === 404) {
        throw new Error('Resource not found');
      } else if (status === 503) {
        throw new Error('Plex server is unavailable');
      }
    }
    throw error;
  }

  /**
   * Make cached request to Plex
   */
  private async cachedRequest<T>(
    path: string,
    cacheKey?: string,
    ttl?: number
  ): Promise<T> {
    const key = cacheKey || `${this.server.id}:${path}`;

    // Try cache first
    const cached = cacheManager.get<T>('plex', key);
    if (cached) {
      logger.debug(`Cache HIT: ${key}`);
      return cached;
    }

    logger.debug(`Plex API request: ${path}`);
    const response = await this.axiosClient.get<T>(path);
    const data = response.data;

    // Cache the response
    cacheManager.set('plex', key, data, ttl);

    return data;
  }

  /**
   * Get all libraries
   */
  async getLibraries(): Promise<PlexLibrary[]> {
    const data = await this.cachedRequest<any>(
      '/library/sections',
      `${this.server.id}:libraries`,
      3600 // 1 hour cache
    );

    return data.MediaContainer.Directory || [];
  }

  /**
   * Get library contents
   */
  async getLibraryContents(libraryKey: string, offset = 0, limit = 50): Promise<PlexMetadata[]> {
    const data = await this.cachedRequest<any>(
      `/library/sections/${libraryKey}/all?X-Plex-Container-Start=${offset}&X-Plex-Container-Size=${limit}`,
      `${this.server.id}:library:${libraryKey}:${offset}:${limit}`,
      300 // 5 minutes cache
    );

    return data.MediaContainer.Metadata || [];
  }

  /**
   * Get metadata for a specific item
   */
  async getMetadata(ratingKey: string): Promise<PlexMetadata> {
    const data = await this.cachedRequest<any>(
      `/library/metadata/${ratingKey}`,
      `${this.server.id}:metadata:${ratingKey}`,
      3600 // 1 hour cache
    );

    return data.MediaContainer.Metadata[0];
  }

  /**
   * Search across all libraries
   */
  async search(query: string): Promise<PlexMetadata[]> {
    const data = await this.cachedRequest<any>(
      `/search?query=${encodeURIComponent(query)}`,
      `${this.server.id}:search:${query}`,
      300 // 5 minutes cache
    );

    return data.MediaContainer.Metadata || [];
  }

  /**
   * Get on deck items
   */
  async getOnDeck(): Promise<PlexMetadata[]> {
    const data = await this.cachedRequest<any>(
      '/library/onDeck',
      `${this.server.id}:ondeck`,
      60 // 1 minute cache
    );

    return data.MediaContainer.Metadata || [];
  }

  /**
   * Get continue watching
   */
  async getContinueWatching(): Promise<PlexMetadata[]> {
    const data = await this.cachedRequest<any>(
      '/hubs/home/continueWatching',
      `${this.server.id}:continue`,
      60 // 1 minute cache
    );

    return data.MediaContainer.Metadata || [];
  }

  /**
   * Get recently added
   */
  async getRecentlyAdded(libraryKey?: string): Promise<PlexMetadata[]> {
    const path = libraryKey
      ? `/library/sections/${libraryKey}/recentlyAdded`
      : '/library/recentlyAdded';

    const data = await this.cachedRequest<any>(
      path,
      `${this.server.id}:recent:${libraryKey || 'all'}`,
      300 // 5 minutes cache
    );

    return data.MediaContainer.Metadata || [];
  }

  /**
   * Update playback progress
   */
  async updateProgress(ratingKey: string, time: number, duration: number) {
    const state = time >= duration * 0.9 ? 'stopped' : 'playing';

    await this.axiosClient.post('/:/timeline', null, {
      params: {
        ratingKey,
        key: `/library/metadata/${ratingKey}`,
        state,
        time,
        duration
      }
    });

    // Invalidate related caches
    cacheManager.delete('plex', `${this.server.id}:ondeck`);
    cacheManager.delete('plex', `${this.server.id}:continue`);
    cacheManager.delete('plex', `${this.server.id}:metadata:${ratingKey}`);
  }

  /**
   * Scrobble (mark as watched)
   */
  async scrobble(ratingKey: string) {
    await this.axiosClient.get(`/:/scrobble?key=${ratingKey}`);

    // Invalidate caches
    cacheManager.delete('plex', `${this.server.id}:metadata:${ratingKey}`);
    cacheManager.delete('plex', `${this.server.id}:ondeck`);
    cacheManager.delete('plex', `${this.server.id}:continue`);
  }

  /**
   * Rate an item
   */
  async rate(ratingKey: string, rating: number) {
    await this.axiosClient.put(`/:/rate?key=${ratingKey}&rating=${rating}`);

    // Invalidate cache
    cacheManager.delete('plex', `${this.server.id}:metadata:${ratingKey}`);
  }

  /**
   * Get transcode decision
   */
  async getTranscodeDecision(ratingKey: string, options: any = {}) {
    const params = {
      hasMDE: 1,
      path: `/library/metadata/${ratingKey}`,
      mediaIndex: options.mediaIndex || 0,
      partIndex: options.partIndex || 0,
      protocol: 'hls',
      fastSeek: 1,
      directPlay: 0,
      directStream: 1,
      videoQuality: options.quality || 100,
      videoResolution: options.resolution || '1920x1080',
      audioBoost: 100,
      ...options
    };

    const response = await this.axiosClient.post('/video/:/transcode/universal/decision', null, {
      params
    });

    return response.data;
  }

  /**
   * Get streaming URL
   */
  async getStreamingUrl(ratingKey: string, options: any = {}): Promise<string> {
    const decision = await this.getTranscodeDecision(ratingKey, options);

    if (decision.MediaContainer?.Metadata?.[0]?.Media?.[0]?.Part?.[0]?.key) {
      const streamPath = decision.MediaContainer.Metadata[0].Media[0].Part[0].key;
      return `${this.axiosClient.defaults.baseURL}${streamPath}?X-Plex-Token=${this.server.accessToken}`;
    }

    throw new Error('Unable to generate streaming URL');
  }

  /**
   * Get server capabilities
   */
  async getServerCapabilities() {
    const data = await this.cachedRequest<any>(
      '/',
      `${this.server.id}:capabilities`,
      3600 // 1 hour cache
    );

    return {
      version: data.MediaContainer.version,
      platform: data.MediaContainer.platform,
      platformVersion: data.MediaContainer.platformVersion,
      transcoderVideo: data.MediaContainer.transcoderVideo,
      transcoderAudio: data.MediaContainer.transcoderAudio,
      transcoderVideoBitrates: data.MediaContainer.transcoderVideoBitrates,
      transcoderVideoQualities: data.MediaContainer.transcoderVideoQualities,
      transcoderVideoResolutions: data.MediaContainer.transcoderVideoResolutions,
    };
  }

  /**
   * Test server connection
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.axiosClient.get('/');
      return true;
    } catch (error) {
      logger.error('Server connection test failed', {
        server: this.server.name,
        error
      });
      return false;
    }
  }

  /**
   * Get server info
   */
  getServerInfo(): PlexServer {
    return { ...this.server };
  }

  /**
   * Encrypt sensitive data
   */
  private encrypt(text: string): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.encryptionKey, iv);

    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
  }

  /**
   * Decrypt sensitive data
   */
  private decrypt(encryptedData: string): string {
    const parts = encryptedData.split(':');
    const iv = Buffer.from(parts[0], 'hex');
    const authTag = Buffer.from(parts[1], 'hex');
    const encrypted = parts[2];

    const decipher = crypto.createDecipheriv('aes-256-gcm', this.encryptionKey, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }
}

// Singleton management for Plex clients
const clientMap = new Map<string, PlexClient>();

/**
 * Get or create Plex client for a user and server
 */
export async function getPlexClient(userId: string, serverId?: string): Promise<PlexClient> {
  const settingsRepo = AppDataSource.getRepository(UserSettings);
  const settings = await settingsRepo.findOne({ where: { userId } });

  if (!settings?.plexServers || settings.plexServers.length === 0) {
    throw new Error('No Plex servers configured');
  }

  // Use specified server or current server
  const targetServerId = serverId || settings.currentServerId;
  const server = settings.plexServers.find((s: PlexServer) => s.id === targetServerId);

  if (!server) {
    throw new Error('Server not found');
  }

  const cacheKey = `${userId}:${server.id}`;

  if (!clientMap.has(cacheKey)) {
    clientMap.set(cacheKey, new PlexClient(server, userId));
  }

  return clientMap.get(cacheKey)!;
}

/**
 * Clear client cache for a user
 */
export function clearPlexClients(userId: string) {
  for (const [key, _] of clientMap) {
    if (key.startsWith(userId)) {
      clientMap.delete(key);
    }
  }
}