import crypto from 'crypto';
import type { Request, Response, NextFunction } from 'express';
import { getDb } from './db';
import { UserProfile } from '../src/types/blockverse';

const SESSION_SECRET =
  process.env.SESSION_SECRET ||
  crypto
    .createHash('sha256')
    .update(process.cwd() + '_dunia_bahasa_blockverse_key')
    .digest('hex');

export const COOKIE_NAME = 'blockverse_session';

export interface SessionPayload {
  userId: string;
  role: 'guru' | 'murid';
  exp: number;
}

export function signToken(payload: SessionPayload): string {
  const data = Buffer.from(JSON.stringify(payload), 'utf-8').toString('base64url');
  const sig = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(data)
    .digest('base64url');
  return `${data}.${sig}`;
}

export function verifyToken(token: string | undefined | null): SessionPayload | null {
  if (!token || typeof token !== 'string' || !token.includes('.')) return null;
  const [data, sig] = token.split('.');
  if (!data || !sig) return null;
  const expectedSig = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(data)
    .digest('base64url');
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }
  try {
    const parsed = JSON.parse(Buffer.from(data, 'base64url').toString('utf-8')) as SessionPayload;
    if (Date.now() > parsed.exp) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function extractTokenFromRequest(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }
  const cookieHeader = req.headers.cookie;
  if (cookieHeader) {
    const cookies = cookieHeader.split(';');
    for (const part of cookies) {
      const [k, ...rest] = part.trim().split('=');
      if (k === COOKIE_NAME) {
        return decodeURIComponent(rest.join('='));
      }
    }
  }
  return null;
}

export function sanitizeUser(user: UserProfile & { passwordHash?: string }): UserProfile {
  const { passwordHash: _removed, ...safe } = user;
  return safe;
}

export interface AuthenticatedRequest extends Request {
  user?: UserProfile;
}

export function attachOptionalUser(req: AuthenticatedRequest, _res: Response, next: NextFunction) {
  const token = extractTokenFromRequest(req);
  const payload = verifyToken(token);
  if (payload) {
    const db = getDb();
    const found = db.users.find((u) => u.id === payload.userId);
    if (found) {
      req.user = sanitizeUser(found);
    }
  }
  next();
}

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const token = extractTokenFromRequest(req);
  const payload = verifyToken(token);
  if (!payload) {
    res.status(401).json({ error: 'Sila log masuk terlebih dahulu untuk meneruskan.' });
    return;
  }
  const db = getDb();
  const found = db.users.find((u) => u.id === payload.userId);
  if (!found) {
    res.status(401).json({ error: 'Akaun pengguna tidak dijumpai.' });
    return;
  }
  req.user = sanitizeUser(found);
  next();
}

export function requireTeacher(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  requireAuth(req, res, () => {
    if (req.user?.role !== 'guru') {
      res.status(403).json({
        error: 'Akses ditolak: Hanya akaun Guru dibenarkan menyunting dunia dan melihat analitik kelas.',
      });
      return;
    }
    next();
  });
}
