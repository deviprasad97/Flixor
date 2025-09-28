import { Request, Response, NextFunction } from 'express';
import { createLogger } from '../utils/logger';

const logger = createLogger('http');

export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();

  // Log request
  logger.debug(`${req.method} ${req.path}`, {
    query: req.query,
    ip: req.ip,
    userAgent: req.get('user-agent'),
  });

  // Log response
  res.on('finish', () => {
    const duration = Date.now() - start;
    const level = res.statusCode >= 400 ? 'warn' : 'debug';

    logger[level](`${req.method} ${req.path} ${res.statusCode} ${duration}ms`, {
      statusCode: res.statusCode,
      duration,
      ip: req.ip,
    });
  });

  next();
}