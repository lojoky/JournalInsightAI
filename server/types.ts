import 'express-session';
import type { User } from '@shared/schema';
import type { Request } from 'express';

declare module 'express-session' {
  interface SessionData {
    userId?: number;
    user?: User;
  }
}

export interface AuthenticatedRequest extends Request {
  session: {
    userId?: number;
    user?: User;
  } & Express.SessionData;
}