// src/lib/authenticatedFetch.ts
import { supabase } from './supabase';
import { notifySessionExpired } from '../context/AuthContext';

export type AuthErrorCode =
  | 'AUTH_MISSING'
  | 'AUTH_EXPIRED'
  | 'FORBIDDEN'
  | 'NETWORK_ERROR'
  | 'SERVER_ERROR'
  | 'INVALID_CREDENTIAL';

export class AppAuthError extends Error {
  code: AuthErrorCode;
  status: number;

  constructor(message: string, code: AuthErrorCode = 'AUTH_MISSING', status = 401) {
    super(message);
    this.name = 'AppAuthError';
    this.code = code;
    this.status = status;
  }
}

export interface AuthenticatedFetchOptions extends RequestInit {
  skipAuth?: boolean;
}

/**
 * Central authenticated fetch helper.
 * 1. Obtains the current Supabase session
 * 2. Checks session.access_token
 * 3. Throws friendly Portuguese error if session is missing (AUTH_MISSING)
 * 4. Adds 'Authorization: Bearer <token>' header
 * 5. Transmits API keys exclusively in the HTTPS body
 * 6. Handles 401 by notifying AuthContext and throwing AUTH_EXPIRED ("Sua sessão expirou. Faça login novamente.")
 */
export async function authenticatedFetch(
  url: string,
  options: AuthenticatedFetchOptions = {}
): Promise<Response> {
  // 1. Obtain current Supabase session
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  const token = session?.access_token;

  // Safe debug log (Requirement 9: never logs tokens, JWTs, or API keys)
  console.log(
    `[AUTH_CHECK] sessionExists=${Boolean(session)} hasAccessToken=${Boolean(token)} userIdExists=${Boolean(session?.user?.id)}`
  );

  // 2. If no session exists: distinct AUTH_MISSING error (NOT session expired!)
  if (sessionError || !session || !token || token.trim().length === 0) {
    throw new AppAuthError('Faça login para gerenciar este recurso.', 'AUTH_MISSING', 401);
  }

  // 3. Prepare headers with Bearer JWT
  const headers = new Headers(options.headers || {});
  headers.set('Authorization', `Bearer ${token}`);
  if (!headers.has('Content-Type') && options.body && typeof options.body === 'string') {
    headers.set('Content-Type', 'application/json');
  }

  let res: Response;
  try {
    res = await fetch(url, {
      ...options,
      headers,
    });
  } catch (netErr: any) {
    throw new AppAuthError('Erro de conexão com o servidor. Verifique sua rede.', 'NETWORK_ERROR', 0);
  }

  // 4. Standardized friendly error mapping
  if (!res.ok) {
    if (res.status === 401) {
      // Real session expiration caught by 401
      notifySessionExpired();
      throw new AppAuthError('Sua sessão expirou. Faça login novamente.', 'AUTH_EXPIRED', 401);
    }
    if (res.status === 403) {
      throw new AppAuthError('Você não tem permissão para gerenciar esta loja.', 'FORBIDDEN', 403);
    }
    if (res.status >= 500) {
      throw new AppAuthError('Motor de IA indisponível no momento.', 'SERVER_ERROR', res.status);
    }

    let parsedError: any = null;
    try {
      parsedError = await res.json();
    } catch {
      // Non-JSON response
    }

    if (
      res.status === 400 &&
      (parsedError?.error === 'INVALID_CREDENTIAL' ||
        parsedError?.error === 'CREDENTIAL_MISSING' ||
        parsedError?.message?.toLowerCase().includes('chave') ||
        parsedError?.message?.toLowerCase().includes('validar') ||
        parsedError?.message?.toLowerCase().includes('credential'))
    ) {
      throw new AppAuthError('Não foi possível validar essa chave.', 'INVALID_CREDENTIAL', 400);
    }

    const friendlyMessage =
      parsedError?.message &&
      !parsedError.message.includes('Authorization header') &&
      !parsedError.message.includes('Bearer token')
        ? parsedError.message
        : 'Não foi possível validar essa chave.';

    throw new Error(friendlyMessage);
  }

  return res;
}
