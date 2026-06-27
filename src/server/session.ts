import { getDbRepository, IDbRepository } from '../lib/dbRepository.js';
import crypto from 'crypto';

let _db: IDbRepository | null = null;
function db(): IDbRepository {
  if (!_db) _db = getDbRepository();
  return _db;
}

// Standard session duration (e.g. 7 days in milliseconds)
const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

export interface SessionData {
  sessionId: string;
  storeCode: string;
  userId: string;
  deviceName?: string;
  status: 'active' | 'logged_out';
  createdAt: number;
  expiresAt: number;
}

/**
 * Creates a new active session in the database for a user and returns session metadata.
 */
export async function loginSessionHandler(
  storeCode: string,
  userId: string,
  deviceName?: string
): Promise<SessionData | null> {
  const sessionId = crypto.randomUUID();
  const now = Date.now();
  const expiresAt = now + SESSION_DURATION_MS;

  const session: SessionData = {
    sessionId,
    storeCode: storeCode.toUpperCase().trim(),
    userId,
    deviceName: deviceName || 'Unknown Device',
    status: 'active',
    createdAt: now,
    expiresAt,
  };

  const success = await db().saveUserSession(session);
  if (success) {
    return session;
  }
  return null;
}

/**
 * Log out a session by marking its status as logged_out and setting expiresAt to now.
 */
export async function logoutSessionHandler(sessionId: string): Promise<boolean> {
  const session = await db().getUserSession(sessionId);
  if (!session) {
    return false;
  }

  const updatedSession: SessionData = {
    ...session,
    status: 'logged_out',
    expiresAt: Date.now(),
  };

  return await db().saveUserSession(updatedSession);
}

/**
 * Checks the validation status of a session across multiple devices.
 */
export async function checkSessionHandler(sessionId: string): Promise<{
  isValid: boolean;
  session: SessionData | null;
  message: string;
}> {
  const session = await db().getUserSession(sessionId);
  if (!session) {
    return { isValid: false, session: null, message: 'Session haipatikani.' };
  }

  if (session.status !== 'active') {
    return { isValid: false, session, message: 'Session imeshatoka (Logged out).' };
  }

  if (Date.now() > session.expiresAt) {
    return { isValid: false, session, message: 'Session imekwisha muda wake.' };
  }

  return { isValid: true, session, message: 'Session ipo hai na ni halali.' };
}

/**
 * Fetches all active sessions for a specific store or optionally a specific user inside that store.
 */
export async function getActiveSessionsHandler(storeCode: string, userId?: string): Promise<SessionData[]> {
  const sessions = await db().getUserSessions(storeCode, userId);
  const now = Date.now();
  // Filter active and non-expired sessions
  return sessions.filter((s) => s.status === 'active' && now <= s.expiresAt);
}
