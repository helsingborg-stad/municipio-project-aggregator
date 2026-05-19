import { createHash, createHmac, randomBytes } from 'node:crypto';

const authStateCookieName = 'municipio_github_auth_state';
const sessionCookieName = 'municipio_github_session';
const defaultSessionMaxAgeSeconds = 60 * 60 * 24 * 7;

/**
 * Returns the configured GitHub OAuth settings.
 *
 * @returns {{clientId: string, clientSecret: string, sessionSecret: string, scopes: string, appUrl: string | null}}
 */
export function getGitHubAuthConfig() {
  return {
    clientId: process.env.GITHUB_OAUTH_CLIENT_ID?.trim() ?? '',
    clientSecret: process.env.GITHUB_OAUTH_CLIENT_SECRET?.trim() ?? '',
    sessionSecret: process.env.GITHUB_SESSION_SECRET?.trim() ?? '',
    scopes: process.env.GITHUB_OAUTH_SCOPES?.trim() || 'read:user repo project',
    appUrl: process.env.GITHUB_APP_URL?.trim() || null,
  };
}

/**
 * Returns whether GitHub OAuth is fully configured.
 *
 * @returns {boolean}
 */
export function isGitHubAuthConfigured() {
  const config = getGitHubAuthConfig();
  return Boolean(config.clientId && config.clientSecret && config.sessionSecret);
}

/**
 * Returns a missing configuration message.
 *
 * @returns {string}
 */
export function getGitHubAuthConfigError() {
  return 'GitHub OAuth is not configured. Set GITHUB_OAUTH_CLIENT_ID, GITHUB_OAUTH_CLIENT_SECRET, and GITHUB_SESSION_SECRET.';
}

/**
 * Sends a JSON response.
 *
 * @param {import('node:http').ServerResponse} res
 * @param {number} statusCode
 * @param {unknown} payload
 * @returns {void}
 */
export function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

/**
 * Redirects the current request.
 *
 * @param {import('node:http').ServerResponse} res
 * @param {string} url
 * @param {number} [statusCode]
 * @returns {void}
 */
export function redirect(res, url, statusCode = 302) {
  res.statusCode = statusCode;
  res.setHeader('Location', url);
  res.end('');
}

/**
 * Returns the external request base URL.
 *
 * @param {import('node:http').IncomingMessage} req
 * @returns {string}
 */
export function getRequestBaseUrl(req) {
  const forwardedProtocol = req.headers['x-forwarded-proto'];
  let protocol = process.env.NODE_ENV === 'development' ? 'http' : 'https';

  if (Array.isArray(forwardedProtocol) && forwardedProtocol[0]) {
    protocol = forwardedProtocol[0];
  } else if (typeof forwardedProtocol === 'string' && forwardedProtocol !== '') {
    protocol = forwardedProtocol;
  }

  const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost:3000';

  return `${protocol}://${host}`;
}

/**
 * Returns the frontend return URL.
 *
 * @param {import('node:http').IncomingMessage} req
 * @param {string | null | undefined} returnTo
 * @returns {string}
 */
export function resolveReturnTo(req, returnTo) {
  const config = getGitHubAuthConfig();
  const defaultUrl = config.appUrl || getRequestBaseUrl(req);

  if (!returnTo) {
    return defaultUrl;
  }

  try {
    const requestedUrl = new URL(returnTo, defaultUrl);
    const allowedOrigin = new URL(defaultUrl).origin;

    if (requestedUrl.origin !== allowedOrigin) {
      return defaultUrl;
    }

    return requestedUrl.toString();
  } catch {
    return defaultUrl;
  }
}

/**
 * Creates a random base64url string.
 *
 * @param {number} size
 * @returns {string}
 */
export function createRandomToken(size = 32) {
  if (size < 32) {
    throw new Error('GitHub auth tokens must use at least 32 bytes of entropy.');
  }

  return toBase64Url(randomBytes(size));
}

/**
 * Returns a PKCE code challenge.
 *
 * @param {string} verifier
 * @returns {string}
 */
export function createCodeChallenge(verifier) {
  return toBase64Url(createHash('sha256').update(verifier).digest());
}

/**
 * Writes the temporary OAuth state cookie.
 *
 * @param {import('node:http').ServerResponse} res
 * @param {{state: string, codeVerifier: string, returnTo: string}} payload
 * @returns {void}
 */
export function writeAuthStateCookie(res, payload) {
  const value = signPayload(payload);
  appendCookie(
    res,
    `${authStateCookieName}=${value}; HttpOnly; Path=/api/auth; Max-Age=600; SameSite=Lax${getSecureCookieSuffix()}`,
  );
}

/**
 * Clears the temporary OAuth state cookie.
 *
 * @param {import('node:http').ServerResponse} res
 * @returns {void}
 */
export function clearAuthStateCookie(res) {
  appendCookie(
    res,
    `${authStateCookieName}=; HttpOnly; Path=/api/auth; Max-Age=0; SameSite=Lax${getSecureCookieSuffix()}`,
  );
}

/**
 * Reads the temporary OAuth state cookie.
 *
 * @param {import('node:http').IncomingMessage} req
 * @returns {{state: string, codeVerifier: string, returnTo: string} | null}
 */
export function readAuthStateCookie(req) {
  return readSignedCookie(req, authStateCookieName);
}

/**
 * Writes the authenticated session cookie.
 *
 * @param {import('node:http').ServerResponse} res
 * @param {{accessToken: string, tokenType: string, scope: string, expiresAt: string | null, refreshToken?: string, refreshTokenExpiresAt?: string | null}} payload
 * @returns {void}
 */
export function writeSessionCookie(res, payload) {
  const value = signPayload(payload);
  const expiresAt = payload.expiresAt ? new Date(payload.expiresAt) : null;
  const maxAge = expiresAt instanceof Date && !Number.isNaN(expiresAt.getTime())
    ? Math.max(60, Math.floor((expiresAt.getTime() - Date.now()) / 1000))
    : defaultSessionMaxAgeSeconds;

  appendCookie(
    res,
    `${sessionCookieName}=${value}; HttpOnly; Path=/; Max-Age=${maxAge}; SameSite=Lax${getSecureCookieSuffix()}`,
  );
}

/**
 * Clears the authenticated session cookie.
 *
 * @param {import('node:http').ServerResponse} res
 * @returns {void}
 */
export function clearSessionCookie(res) {
  appendCookie(
    res,
    `${sessionCookieName}=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax${getSecureCookieSuffix()}`,
  );
}

/**
 * Reads the authenticated session cookie.
 *
 * @param {import('node:http').IncomingMessage} req
 * @returns {{accessToken: string, tokenType: string, scope: string, expiresAt: string | null, refreshToken?: string, refreshTokenExpiresAt?: string | null} | null}
 */
export function readSessionCookie(req) {
  const session = readSignedCookie(req, sessionCookieName);

  if (!session?.accessToken || !session?.tokenType) {
    return null;
  }

  return session;
}

/**
 * Exchanges a GitHub OAuth code for an access token.
 *
 * @param {{code: string, codeVerifier: string, redirectUri: string}} input
 * @returns {Promise<{accessToken: string, tokenType: string, scope: string, expiresAt: string | null, refreshToken?: string, refreshTokenExpiresAt?: string | null}>}
 */
export async function exchangeCodeForToken(input) {
  const config = getGitHubAuthConfig();
  const response = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'User-Agent': 'municipio-project-aggregator',
    },
    body: JSON.stringify({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code: input.code,
      redirect_uri: input.redirectUri,
      code_verifier: input.codeVerifier,
    }),
  });

  const payload = await response.json();

  if (!response.ok || payload.error) {
    throw new Error(payload.error_description || payload.error || 'GitHub OAuth exchange failed.');
  }

  return {
    accessToken: payload.access_token,
    tokenType: payload.token_type || 'bearer',
    scope: payload.scope || '',
    expiresAt: resolveExpirationDate(payload.expires_in),
    refreshToken: payload.refresh_token || undefined,
    refreshTokenExpiresAt: resolveExpirationDate(payload.refresh_token_expires_in),
  };
}

/**
 * Executes a GitHub GraphQL request with the stored session token.
 *
 * @param {{accessToken: string}} session
 * @param {string} query
 * @param {Record<string, unknown>} [variables]
 * @returns {Promise<Record<string, unknown>>}
 */
export async function runGitHubGraphql(session, query, variables = {}) {
  const response = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${session.accessToken}`,
      'Content-Type': 'application/json',
      'User-Agent': 'municipio-project-aggregator',
    },
    body: JSON.stringify({ query, variables }),
  });

  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload.message || 'GitHub GraphQL request failed.');
  }

  return payload;
}

/**
 * Resolves the current authenticated GitHub user.
 *
 * @param {{accessToken: string}} session
 * @returns {Promise<Record<string, unknown>>}
 */
export async function fetchViewer(session) {
  const payload = await runGitHubGraphql(
    session,
    'query Viewer { viewer { id login name avatarUrl url } }',
  );

  return payload.data?.viewer || {};
}

/**
 * Returns the authorization URL.
 *
 * @param {import('node:http').IncomingMessage} req
 * @param {{state: string, codeChallenge: string}} input
 * @returns {string}
 */
export function buildAuthorizationUrl(req, input) {
  const config = getGitHubAuthConfig();
  const url = new URL('https://github.com/login/oauth/authorize');
  url.searchParams.set('client_id', config.clientId);
  url.searchParams.set('redirect_uri', `${getRequestBaseUrl(req)}/api/auth/callback`);
  url.searchParams.set('scope', config.scopes);
  url.searchParams.set('state', input.state);
  url.searchParams.set('code_challenge', input.codeChallenge);
  url.searchParams.set('code_challenge_method', 'S256');
  url.searchParams.set('allow_signup', 'false');
  return url.toString();
}

/**
 * Signs a payload for cookie storage.
 *
 * @param {Record<string, unknown>} payload
 * @returns {string}
 */
function signPayload(payload) {
  const config = getGitHubAuthConfig();
  const encodedPayload = toBase64Url(Buffer.from(JSON.stringify(payload), 'utf8'));
  const signature = toBase64Url(createHmac('sha256', config.sessionSecret).update(encodedPayload).digest());
  return `${encodedPayload}.${signature}`;
}

/**
 * Reads and verifies a signed cookie.
 *
 * @param {import('node:http').IncomingMessage} req
 * @param {string} name
 * @returns {Record<string, any> | null}
 */
function readSignedCookie(req, name) {
  const config = getGitHubAuthConfig();
  const cookies = parseCookies(req.headers.cookie || '');
  const value = cookies[name];

  if (!value) {
    return null;
  }

  const [encodedPayload, signature] = value.split('.');

  if (!encodedPayload || !signature) {
    return null;
  }

  const expectedSignature = toBase64Url(createHmac('sha256', config.sessionSecret).update(encodedPayload).digest());

  if (signature !== expectedSignature) {
    return null;
  }

  try {
    return JSON.parse(fromBase64Url(encodedPayload).toString('utf8'));
  } catch {
    return null;
  }
}

/**
 * Appends a Set-Cookie header.
 *
 * @param {import('node:http').ServerResponse} res
 * @param {string} value
 * @returns {void}
 */
function appendCookie(res, value) {
  const previousValue = res.getHeader('Set-Cookie');
  const nextValues = Array.isArray(previousValue)
    ? [...previousValue, value]
    : previousValue
      ? [String(previousValue), value]
      : [value];

  res.setHeader('Set-Cookie', nextValues);
}

/**
 * Returns the Secure cookie suffix when appropriate.
 *
 * @returns {string}
 */
function getSecureCookieSuffix() {
  return process.env.NODE_ENV === 'development' ? '' : '; Secure';
}

/**
 * Resolves an ISO expiration date from a seconds-until-expiry value.
 *
 * @param {unknown} value
 * @returns {string | null}
 */
function resolveExpirationDate(value) {
  if (typeof value !== 'number' && typeof value !== 'string') {
    return null;
  }

  return new Date(Date.now() + Number(value) * 1000).toISOString();
}

/**
 * Parses a cookie header into a dictionary.
 *
 * @param {string} value
 * @returns {Record<string, string>}
 */
function parseCookies(value) {
  return value.split(';').reduce((result, part) => {
    const [name, ...rest] = part.trim().split('=');
    if (!name) {
      return result;
    }

    result[name] = decodeURIComponent(rest.join('='));
    return result;
  }, {});
}

/**
 * Encodes a buffer as base64url.
 *
 * @param {Buffer} value
 * @returns {string}
 */
function toBase64Url(value) {
  return value
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

/**
 * Decodes a base64url string.
 *
 * @param {string} value
 * @returns {Buffer}
 */
function fromBase64Url(value) {
  const normalizedValue = value.replace(/-/g, '+').replace(/_/g, '/');
  const padding = normalizedValue.length % 4 === 0 ? '' : '='.repeat(4 - (normalizedValue.length % 4));
  return Buffer.from(`${normalizedValue}${padding}`, 'base64');
}
