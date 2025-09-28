import { Router, Request, Response, NextFunction } from 'express';
import axios from 'axios';
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { cacheManager } from '../services/cache/CacheManager';
import { createLogger } from '../utils/logger';
import { AppError } from '../middleware/errorHandler';

const router = Router();
const logger = createLogger('image-proxy');

interface ImageOptions {
  width?: number;
  height?: number;
  quality?: number;
  format?: 'jpeg' | 'png' | 'webp';
  fit?: 'cover' | 'contain' | 'fill' | 'inside' | 'outside';
}

/**
 * Parse image options from query parameters
 */
function parseImageOptions(query: any): ImageOptions {
  return {
    width: query.w ? parseInt(query.w, 10) : undefined,
    height: query.h ? parseInt(query.h, 10) : undefined,
    quality: query.q ? parseInt(query.q, 10) : 85,
    format: query.f || 'jpeg',
    fit: query.fit || 'cover',
  };
}

/**
 * Proxy and cache external images
 * GET /api/image/proxy?url=https://example.com/image.jpg&w=500&h=300&q=85
 */
router.get('/proxy', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const imageUrl = req.query.url as string;

    if (!imageUrl) {
      throw new AppError('Image URL is required', 400);
    }

    // Validate URL
    try {
      new URL(imageUrl);
    } catch {
      throw new AppError('Invalid image URL', 400);
    }

    const options = parseImageOptions(req.query);

    // Generate cache key based on URL and options
    const cacheKey = cacheManager.constructor.generateHashKey(
      JSON.stringify({ url: imageUrl, ...options })
    );
    const cacheDir = path.join(process.cwd(), 'cache', 'images');
    const cachePath = path.join(cacheDir, `${cacheKey}.${options.format}`);

    // Check if image exists in disk cache
    if (fs.existsSync(cachePath)) {
      const stats = fs.statSync(cachePath);
      const maxAge = 7 * 24 * 60 * 60; // 7 days

      // Check if cache is still valid
      if (Date.now() - stats.mtimeMs < maxAge * 1000) {
        logger.debug(`Serving cached image: ${cacheKey}`);
        res.setHeader('X-Cache', 'HIT');
        res.setHeader('Cache-Control', `public, max-age=${maxAge}`);
        res.setHeader('Content-Type', `image/${options.format}`);
        return fs.createReadStream(cachePath).pipe(res);
      }
    }

    logger.debug(`Fetching image: ${imageUrl}`);

    // Fetch image from remote URL
    const response = await axios.get(imageUrl, {
      responseType: 'arraybuffer',
      timeout: 10000,
      headers: {
        'User-Agent': 'PlexMediaPlayer/1.0',
      },
      validateStatus: (status) => status === 200,
    });

    // Process image with sharp
    let sharpInstance = sharp(response.data);

    // Apply resizing if specified
    if (options.width || options.height) {
      sharpInstance = sharpInstance.resize(options.width, options.height, {
        fit: options.fit as any,
        withoutEnlargement: true,
      });
    }

    // Apply format and quality
    switch (options.format) {
      case 'jpeg':
        sharpInstance = sharpInstance.jpeg({ quality: options.quality });
        break;
      case 'png':
        sharpInstance = sharpInstance.png({ quality: options.quality });
        break;
      case 'webp':
        sharpInstance = sharpInstance.webp({ quality: options.quality });
        break;
    }

    // Process the image
    const processedImage = await sharpInstance.toBuffer();

    // Ensure cache directory exists
    if (!fs.existsSync(cacheDir)) {
      fs.mkdirSync(cacheDir, { recursive: true });
    }

    // Save to disk cache
    fs.writeFileSync(cachePath, processedImage);
    logger.debug(`Cached image: ${cacheKey}`);

    // Send response
    res.setHeader('X-Cache', 'MISS');
    res.setHeader('Cache-Control', 'public, max-age=604800'); // 7 days
    res.setHeader('Content-Type', `image/${options.format}`);
    res.send(processedImage);

  } catch (error: any) {
    if (axios.isAxiosError(error)) {
      if (error.response?.status === 404) {
        next(new AppError('Image not found', 404));
      } else {
        logger.error('Failed to fetch image:', error.message);
        next(new AppError('Failed to fetch image', 500));
      }
    } else {
      next(error);
    }
  }
});

/**
 * Proxy Plex images with authentication
 * GET /api/image/plex?url=/library/metadata/123/thumb&token=xxx&w=500
 */
router.get('/plex', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { url, token, server } = req.query;

    if (!url || !token) {
      throw new AppError('URL and token are required', 400);
    }

    const serverUrl = server || process.env.PLEX_SERVER_URL;
    if (!serverUrl) {
      throw new AppError('Plex server URL not configured', 500);
    }

    const options = parseImageOptions(req.query);

    // Build full Plex URL
    const fullUrl = `${serverUrl}${url}${url.includes('?') ? '&' : '?'}X-Plex-Token=${token}`;

    // Generate cache key
    const cacheKey = cacheManager.constructor.generateHashKey(
      JSON.stringify({ url: fullUrl, ...options })
    );
    const cacheDir = path.join(process.cwd(), 'cache', 'images', 'plex');
    const cachePath = path.join(cacheDir, `${cacheKey}.${options.format}`);

    // Check disk cache
    if (fs.existsSync(cachePath)) {
      const stats = fs.statSync(cachePath);
      const maxAge = 24 * 60 * 60; // 24 hours for Plex images

      if (Date.now() - stats.mtimeMs < maxAge * 1000) {
        logger.debug(`Serving cached Plex image: ${cacheKey}`);
        res.setHeader('X-Cache', 'HIT');
        res.setHeader('Cache-Control', `private, max-age=${maxAge}`);
        res.setHeader('Content-Type', `image/${options.format}`);
        return fs.createReadStream(cachePath).pipe(res);
      }
    }

    // Fetch from Plex
    const response = await axios.get(fullUrl, {
      responseType: 'arraybuffer',
      timeout: 10000,
      headers: {
        'Accept': 'image/*',
      },
    });

    // Process with sharp
    let sharpInstance = sharp(response.data);

    if (options.width || options.height) {
      sharpInstance = sharpInstance.resize(options.width, options.height, {
        fit: options.fit as any,
        withoutEnlargement: true,
      });
    }

    // Apply format and quality
    switch (options.format) {
      case 'jpeg':
        sharpInstance = sharpInstance.jpeg({ quality: options.quality });
        break;
      case 'png':
        sharpInstance = sharpInstance.png({ quality: options.quality });
        break;
      case 'webp':
        sharpInstance = sharpInstance.webp({ quality: options.quality });
        break;
    }

    const processedImage = await sharpInstance.toBuffer();

    // Ensure cache directory exists
    if (!fs.existsSync(cacheDir)) {
      fs.mkdirSync(cacheDir, { recursive: true });
    }

    // Save to cache
    fs.writeFileSync(cachePath, processedImage);

    res.setHeader('X-Cache', 'MISS');
    res.setHeader('Cache-Control', 'private, max-age=86400');
    res.setHeader('Content-Type', `image/${options.format}`);
    res.send(processedImage);

  } catch (error: any) {
    logger.error('Failed to proxy Plex image:', error);
    next(new AppError('Failed to fetch Plex image', 500));
  }
});

/**
 * Clear image cache
 * DELETE /api/image/cache
 */
router.delete('/cache', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const maxAge = req.query.maxAge ? parseInt(req.query.maxAge as string, 10) : 7 * 24 * 60 * 60 * 1000;
    const deleted = await cacheManager.cleanupImageCache(maxAge);

    res.json({
      message: 'Image cache cleaned',
      filesDeleted: deleted,
    });
  } catch (error) {
    next(new AppError('Failed to clean image cache', 500));
  }
});

/**
 * Get image cache statistics
 * GET /api/image/cache/stats
 */
router.get('/cache/stats', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const cacheDir = path.join(process.cwd(), 'cache', 'images');

    if (!fs.existsSync(cacheDir)) {
      return res.json({
        files: 0,
        totalSize: 0,
        oldestFile: null,
        newestFile: null,
      });
    }

    const files = fs.readdirSync(cacheDir, { withFileTypes: true })
      .filter(dirent => dirent.isFile())
      .map(dirent => {
        const filePath = path.join(cacheDir, dirent.name);
        const stats = fs.statSync(filePath);
        return {
          name: dirent.name,
          size: stats.size,
          modified: stats.mtime,
        };
      });

    const totalSize = files.reduce((sum, file) => sum + file.size, 0);
    const sorted = files.sort((a, b) => a.modified.getTime() - b.modified.getTime());

    res.json({
      files: files.length,
      totalSize,
      totalSizeMB: Math.round(totalSize / 1024 / 1024 * 100) / 100,
      oldestFile: sorted[0] || null,
      newestFile: sorted[sorted.length - 1] || null,
    });
  } catch (error) {
    next(new AppError('Failed to get cache statistics', 500));
  }
});

export default router;