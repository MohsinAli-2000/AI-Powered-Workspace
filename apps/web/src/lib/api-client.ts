import { AuthSession, User } from '@/types/api.types';
import { normalizeDeep, shapeResponse } from './normalize';

const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1').replace(/\/+$/, '');
const SESSION_STORAGE_KEY = 'auth_session';
const ORG_STORAGE_KEY = 'active_organization_id';

export class ApiError extends Error {
  public readonly status: number;
  public readonly details?: unknown;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
    Object.setPrototypeOf(this, ApiError.prototype);
  }

  public get code(): string | undefined {
    return (this.details as { code?: string } | undefined)?.code;
  }
}

// ---------------------------------------------------------------------------
// Session persistence
// ---------------------------------------------------------------------------
export function getStoredSession(): AuthSession | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(SESSION_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as AuthSession) : null;
  } catch {
    return null;
  }
}

export function setStoredSession(session: AuthSession | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (session) {
      window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
    } else {
      window.localStorage.removeItem(SESSION_STORAGE_KEY);
    }
  } catch {
    // Storage unavailable (private mode / quota); session stays in memory only.
  }
}

export function getActiveOrganizationId(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(ORG_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setActiveOrganizationId(orgId: string | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (orgId) {
      window.localStorage.setItem(ORG_STORAGE_KEY, orgId);
    } else {
      window.localStorage.removeItem(ORG_STORAGE_KEY);
    }
  } catch {
    // Storage unavailable; the selection just won't survive a reload.
  }
}

// ---------------------------------------------------------------------------
// Response shaping
// ---------------------------------------------------------------------------
interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

interface ApiEnvelope {
  success?: boolean;
  message?: string;
  data?: unknown;
  pagination?: unknown;
  error?: { message?: string; statusCode?: number; details?: unknown };
}

/** The API returns `{ user, tokens: { accessToken, refreshToken } }`; the UI uses `AuthSession`. */
function toAuthSession(data: { user: User; tokens: TokenPair }): AuthSession {
  return {
    access_token: data.tokens.accessToken,
    refresh_token: data.tokens.refreshToken,
    user: normalizeDeep(data.user),
  };
}

function isAuthPayload(data: unknown): data is { user: User; tokens: TokenPair } {
  if (typeof data !== 'object' || data === null) return false;
  const candidate = data as { user?: unknown; tokens?: { accessToken?: unknown } };
  return !!candidate.user && typeof candidate.tokens?.accessToken === 'string';
}

async function parseBody(response: Response): Promise<ApiEnvelope | null> {
  if (response.status === 204) return null;
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as ApiEnvelope;
  } catch {
    return { message: text };
  }
}

// ---------------------------------------------------------------------------
// Token refresh (single in-flight request shared by concurrent 401s)
// ---------------------------------------------------------------------------
let refreshInFlight: Promise<boolean> | null = null;

async function refreshSession(): Promise<boolean> {
  const session = getStoredSession();
  if (!session?.refresh_token) return false;

  try {
    const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: session.refresh_token }),
    });
    if (!response.ok) return false;

    const body = await parseBody(response);
    const tokens = (body?.data as { tokens?: TokenPair } | undefined)?.tokens;
    if (!tokens?.accessToken) return false;

    setStoredSession({
      ...session,
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken,
    });
    return true;
  } catch {
    return false;
  }
}

function refreshSessionOnce(): Promise<boolean> {
  if (!refreshInFlight) {
    refreshInFlight = refreshSession().finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

function handleSessionExpired(): void {
  setStoredSession(null);
  if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
    const target = `${window.location.pathname}${window.location.search}`;
    window.location.assign(`/login?expired=true&redirect=${encodeURIComponent(target)}`);
  }
}

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------
function buildHeaders(init: RequestInit): Headers {
  const headers = new Headers(init.headers);

  // Let the browser set the multipart boundary for FormData bodies.
  if (init.body && !(init.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const token = getStoredSession()?.access_token;
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const orgId = getActiveOrganizationId();
  if (orgId && !headers.has('X-Organization-Id')) headers.set('X-Organization-Id', orgId);

  return headers;
}

/**
 * Endpoints that handle credentials themselves: a 401 there is a real answer, not an expired token.
 * (`/auth/me` and `/auth/logout` are NOT in this list, so they refresh an expired access token like any other call.)
 */
function isCredentialRoute(path: string): boolean {
  return /^\/(auth\/(login|register|refresh|verify-email|resend-verification|forgot-password|reset-password)|invitations\/(details|accept-and-register))(\/|\?|$)/.test(path);
}

/** True when `fetch` failed to reach the server at all (offline, refused, reset, blocked), not for other TypeErrors. */
function isNetworkFailure(err: unknown): boolean {
  if (!(err instanceof TypeError)) return false;
  const message = err.message.toLowerCase();
  if (message.includes('failed to execute')) return false; // a malformed request, not a connectivity problem
  return /fetch|load failed|network/.test(message);
}

/**
 * `fetch` that retries once, after a short pause, when a request cannot reach the server at all (no response).
 * Only methods that are safe to repeat are retried: reads, plus PATCH/PUT, which in this API set a value
 * (access mode, rename, role...) so applying one twice is harmless. POST (create, upload, chat) and DELETE
 * are never retried automatically.
 */
async function fetchWithRetry(url: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(url, { ...init, headers: buildHeaders(init) });
  } catch (err) {
    const method = (init.method || 'GET').toUpperCase();
    if (!isNetworkFailure(err) || !['GET', 'HEAD', 'PATCH', 'PUT'].includes(method)) throw err;
    await new Promise((resolve) => setTimeout(resolve, 1500));
    return fetch(url, { ...init, headers: buildHeaders(init) });
  }
}

/** Performs the request, retrying once with a refreshed token on a 401. */
async function authorizedFetch(path: string, init: RequestInit): Promise<Response> {
  const url = `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
  const isAuthRoute = isCredentialRoute(path);

  let response = await fetchWithRetry(url, init);

  if (response.status === 401 && !isAuthRoute && (await refreshSessionOnce())) {
    response = await fetch(url, { ...init, headers: buildHeaders(init) });
  }
  return response;
}

/**
 * Typed fetch wrapper for the backend API. Resolves with the unwrapped `data`
 * of the response envelope (or `{ data, pagination }` for paginated endpoints)
 * and throws `ApiError` on non-2xx responses. Payloads are reshaped to the UI
 * types via `shapeResponse` (see `normalize.ts`).
 */
export async function apiClient<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
  const isAuthRoute = isCredentialRoute(path);
  let response: Response;
  try {
    response = await authorizedFetch(path, init);
  } catch (err) {
    if (isNetworkFailure(err)) {
      throw new ApiError(
        'Unable to connect to the backend server. Please verify network connectivity or that the API service is reachable.',
        503
      );
    }
    throw err;
  }
  const body = await parseBody(response);

  if (!response.ok) {
    if (response.status === 401 && !isAuthRoute) handleSessionExpired();
    throw new ApiError(
      body?.error?.message || body?.message || `Request failed with status ${response.status}`,
      response.status,
      body?.error?.details
    );
  }

  if (!body) return undefined as T;

  if (isAuthPayload(body.data)) return toAuthSession(body.data) as T;
  if (body.pagination !== undefined) {
    return { data: shapeResponse(body.data), pagination: body.pagination } as T;
  }
  if (body.data !== undefined && body.data !== null) return shapeResponse<T>(body.data);
  return body as T;
}

/**
 * Downloads a file from an authenticated endpoint and hands it to the browser
 * as a save-as download (the endpoint streams bytes, so it can't go through `apiClient`).
 */
export async function downloadFile(path: string, fallbackName = 'download'): Promise<void> {
  const response = await authorizedFetch(path, {});

  if (!response.ok) {
    const body = await parseBody(response);
    if (response.status === 401) handleSessionExpired();
    throw new ApiError(
      body?.error?.message || body?.message || `Download failed with status ${response.status}`,
      response.status,
      body?.error?.details
    );
  }

  let filename = fallbackName;
  const disposition = response.headers.get('Content-Disposition');
  // Prefer the RFC 5987 UTF-8 name (filename*=UTF-8''...) over the ASCII fallback.
  const utf8Match = disposition?.match(/filename\*=UTF-8''([^;]+)/i);
  const plainMatch = disposition?.match(/filename="?([^";]+)"?/i);
  const rawName = utf8Match?.[1] ?? plainMatch?.[1];
  if (rawName) {
    try {
      filename = decodeURIComponent(rawName);
    } catch {
      filename = rawName;
    }
  }

  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}
