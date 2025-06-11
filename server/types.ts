import 'express-session';
import type { User } from '@shared/schema';
import type { Request } from 'express';
import type { Session } from 'express-session';

declare module 'express-session' {
  interface SessionData {
    userId?: number;
    user?: User;
    googleAuthCode?: string;
  }
}

export interface AuthenticatedRequest extends Request {
  session: Session & {
    userId?: number;
    user?: User;
    googleAuthCode?: string;
  };
}