import { Request, Response, NextFunction } from 'express';
import { AppError } from './errorHandler';

// Extend Express Request type to include user
declare module 'express-session' {
  interface SessionData {
    userId?: string;
    plexId?: number;
    username?: string;
  }
}

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    plexId: number;
    username: string;
  };
}

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.session.userId) {
    throw new AppError('Authentication required', 401);
  }

  // Attach user info to request
  req.user = {
    id: req.session.userId,
    plexId: req.session.plexId!,
    username: req.session.username!,
  };

  next();
}

export function optionalAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (req.session.userId) {
    req.user = {
      id: req.session.userId,
      plexId: req.session.plexId!,
      username: req.session.username!,
    };
  }
  next();
}