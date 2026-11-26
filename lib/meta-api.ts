import 'server-only';
import { SignJWT, jwtVerify } from 'jose';
import { randomUUID } from 'node:crypto';

export const META_OAUTH_COOKIE = 'viralzoom_meta_oauth_state';
const stateIssuer = 'viralzoom-social-meta';

export type MetaConfig = {
  appId: string;
  appSecret: string;
  configId: string;
  redirectUri: string;
  graphVersion: string;
};

export function getMetaConfig(): MetaConfig {
  const appId = process.env.META_APP_ID?.trim();
  const appSecret = process.env.META_APP_SECRET?.trim();
  const configId = process.env.META_CONFIG_ID?.trim();
  const redirectUri = process.env.META_REDIRECT_URI?.trim();
  const graphVersion = process.env.META_GRAPH_API_VERSION?.trim() || 'v27.0';
  if (!appId || !appSecret || !configId || !redirectUri) {
    throw new Error('META_NOT_CONFIGURED');
  }
  if (!/^v\d+\.\d+$/.test(graphVersion)) throw new Error('META_GRAPH_VERSION_INVALID');
  let redirect: URL;
  try { redirect = new URL(redirectUri); } catch { throw new Error('META_REDIRECT_URI_INVALID'); }
  if (!['https:', 'http:'].includes(redirect.protocol) || redirect.username || redirect.password) {
    throw new Error('META_REDIRECT_URI_INVALID');
  }
  if (redirect.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(redirect.hostname)) {
    throw new Error('META_REDIRECT_URI_REQUIRES_HTTPS');
  }
  return { appId, appSecret, configId, redirectUri: redirect.toString(), graphVersion };
}

function stateKey() {
  const secret = process.env.APP_SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error('APP_SESSION_SECRET_INVALID');
  return new TextEncoder().encode(secret);
}

export async function createMetaOAuthState(userId: string, clientId: string | null) {
  return new SignJWT({ purpose: 'social-media-meta-connect', clientId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuer(stateIssuer)
    .setSubject(userId)
    .setJti(randomUUID())
    .setIssuedAt()
    .setExpirationTime('10m')
    .sign(stateKey());
}

export async function verifyMetaOAuthState(value: string) {
  const { payload } = await jwtVerify(value, stateKey(), { algorithms: ['HS256'], issuer: stateIssuer });
  if (payload.purpose !== 'social-media-meta-connect' || typeof payload.sub !== 'string' ||
    !(payload.clientId === null || typeof payload.clientId === 'string')) {
    throw new Error('META_STATE_INVALID');
  }
  return { userId: payload.sub, clientId: payload.clientId as string | null };
}

export function metaAuthorizationUrl(config: MetaConfig, state: string) {
  const url = new URL(`https://www.facebook.com/${config.graphVersion}/dialog/oauth`);
  url.searchParams.set('client_id', config.appId);
  url.searchParams.set('redirect_uri', config.redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('config_id', config.configId);
  url.searchParams.set('state', state);
  url.searchParams.set('auth_type', 'rerequest');
  return url;
}

function graphUrl(path: string, version: string) {
  const cleanPath = path.replace(/^\/+/, '');
  if (!cleanPath || cleanPath.split('/').some(segment => !segment || segment === '.' || segment === '..')) {
    throw new Error('META_GRAPH_PATH_INVALID');
  }
  return new URL(`https://graph.facebook.com/${version}/${cleanPath}`);
}

async function readMetaResponse<T>(response: Response): Promise<T> {
  const data = await response.json().catch(() => null) as { error?: { message?: string; code?: number } } | null;
  if (!response.ok || data?.error) {
    const message = data?.error?.message?.slice(0, 400) || 'تعذر إكمال الطلب مع Meta';
    throw new Error(`META_API_ERROR:${message}`);
  }
  return data as T;
}

export async function metaGet<T>(path: string, version: string, accessToken: string, params: Record<string, string> = {}) {
  const url = graphUrl(path, version);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  const response = await fetch(url, {
    method: 'GET',
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
    redirect: 'error'
  });
  return readMetaResponse<T>(response);
}

export async function metaPost<T>(path: string, version: string, accessToken: string, body: URLSearchParams | FormData) {
  const url = graphUrl(path, version);
  const response = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
    body,
    cache: 'no-store',
    redirect: 'error'
  });
  return readMetaResponse<T>(response);
}

export function metaPublicOrigin() {
  const value = process.env.META_APP_URL?.trim();
  if (!value) throw new Error('META_PUBLIC_APP_URL_MISSING');
  let url: URL;
  try { url = new URL(value); } catch { throw new Error('META_PUBLIC_APP_URL_INVALID'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) {
    throw new Error('META_PUBLIC_APP_URL_INVALID');
  }
  return url.origin;
}

export function metaSocialMediaReturnUrl(requestUrl: string) {
  const configuredUrl = process.env.META_APP_URL?.trim();
  if (configuredUrl) {
    try {
      const configured = new URL(configuredUrl);
      if (configured.protocol === 'https:' && !configured.username && !configured.password && !configured.search && !configured.hash) {
        return new URL('/social-media', configured.origin);
      }
    } catch {
      // Fall back to the incoming request URL if the public origin is not usable.
    }
  }
  return new URL('/social-media', requestUrl);
}
