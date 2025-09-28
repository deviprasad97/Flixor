import 'express-session';

declare module 'express-session' {
  interface SessionData {
    userId?: string;
    plexId?: number;
    username?: string;
  }
}

declare module 'express' {
  interface Request {
    user?: {
      id: string;
      plexId: number;
      username: string;
    };
  }
}