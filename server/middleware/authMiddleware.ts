// server/middleware/authMiddleware.ts
import { Response, NextFunction } from 'express';
import { createClient } from '@supabase/supabase-js';
import { env } from '../config/env.js';
import { AuthenticatedRequest, StoreRole } from '../types/index.js';
import { logger } from '../utils/logger.js';

// Admin Supabase Client initialized with Service Role Key (SERVER ONLY)
export const supabaseAdmin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

/**
 * Middleware: requireAuth
 * Extracts Bearer JWT from Authorization header and verifies with Supabase Auth.
 * Sets req.user = { id, email }.
 * NEVER trusts arbitrary user_id sent in body or headers.
 */
export async function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'UNAUTHORIZED', message: 'Missing or malformed Authorization header.' });
      return;
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      res.status(401).json({ error: 'UNAUTHORIZED', message: 'Invalid Bearer token.' });
      return;
    }

    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);

    if (error || !user) {
      logger.warn('Authentication failed for token', { error: error?.message });
      res.status(401).json({ error: 'UNAUTHORIZED', message: 'Invalid or expired authentication token.' });
      return;
    }

    req.user = {
      id: user.id,
      email: user.email,
    };

    next();
  } catch (err) {
    logger.error('Unexpected error in requireAuth middleware', err);
    res.status(500).json({ error: 'INTERNAL_SERVER_ERROR', message: 'Authentication verification failed.' });
  }
}

/**
 * Helper / Middleware: verifyStoreMembership
 * Validates if the authenticated user is a member of storeId with specific roles.
 */
export async function verifyStoreRole(userId: string, storeId: string, requiredRoles?: StoreRole[]): Promise<{ isMember: boolean; role?: StoreRole }> {
  try {
    const { data, error } = await supabaseAdmin
      .from('store_members')
      .select('role')
      .eq('store_id', storeId)
      .eq('user_id', userId)
      .maybeSingle();

    if (error || !data) {
      return { isMember: false };
    }

    const role = data.role as StoreRole;
    if (requiredRoles && requiredRoles.length > 0 && !requiredRoles.includes(role)) {
      return { isMember: true, role };
    }

    return { isMember: true, role };
  } catch (err) {
    logger.error('Error verifying store membership', err, { userId, storeId });
    return { isMember: false };
  }
}

/**
 * Middleware: requireStoreAdmin
 * Ensures authenticated user is owner or manager of the storeId specified in params, body, or query.
 */
export async function requireStoreAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  if (!req.user) {
    res.status(401).json({ error: 'UNAUTHORIZED', message: 'Authentication required.' });
    return;
  }

  const storeId = req.params.storeId || req.body?.storeId || req.query?.storeId;
  if (!storeId || typeof storeId !== 'string') {
    res.status(400).json({ error: 'BAD_REQUEST', message: 'storeId is required.' });
    return;
  }

  const { isMember, role } = await verifyStoreRole(req.user.id, storeId, ['owner', 'manager']);

  if (!isMember || !role) {
    res.status(403).json({ error: 'FORBIDDEN', message: 'User is not an authorized owner or manager for this store.' });
    return;
  }

  req.storeRole = role;
  next();
}

/**
 * Middleware: rateLimitMiddleware
 * Persistent database-backed rate limiting per user or IP address using PostgreSQL check_rate_limit.
 */
export async function rateLimitMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const key = req.user?.id ? `user:${req.user.id}` : `ip:${req.ip || 'unknown'}`;
    const maxLimit = 20; // 20 requests
    const windowSeconds = 60; // per minute

    const { data, error } = await supabaseAdmin.rpc('check_rate_limit', {
      p_key: key,
      p_max_limit: maxLimit,
      p_window_seconds: windowSeconds,
    });

    if (error) {
      logger.warn('Rate limit RPC error, allowing request', { error: error.message });
      next();
      return;
    }

    if (data === false) {
      res.status(429).json({ error: 'RATE_LIMIT_EXCEEDED', message: 'Too many requests. Please wait a minute before trying again.' });
      return;
    }

    next();
  } catch (err) {
    logger.error('Error in rateLimitMiddleware', err);
    next();
  }
}
