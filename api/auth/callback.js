import {
  clearAuthStateCookie,
  clearSessionCookie,
  exchangeCodeForToken,
  getGitHubAuthConfigError,
  getRequestBaseUrl,
  isGitHubAuthConfigured,
  readAuthStateCookie,
  redirect,
  writeSessionCookie,
} from '../_lib/github-auth.js';

export default async function handler(req, res) {
  if (!isGitHubAuthConfigured()) {
    res.statusCode = 503;
    res.end(getGitHubAuthConfigError());
    return;
  }

  if (req.method !== 'GET') {
    res.statusCode = 404;
    res.end('Not found.');
    return;
  }

  const requestUrl = new URL(req.url || '/', getRequestBaseUrl(req));
  const stateCookie = readAuthStateCookie(req);
  const returnTo = stateCookie?.returnTo || `${getRequestBaseUrl(req)}/`;
  const state = requestUrl.searchParams.get('state');
  const code = requestUrl.searchParams.get('code');
  const error = requestUrl.searchParams.get('error');

  clearAuthStateCookie(res);

  if (!stateCookie || stateCookie.state !== state) {
    clearSessionCookie(res);
    redirect(res, withAuthError(returnTo, 'invalid_state'));
    return;
  }

  if (error) {
    clearSessionCookie(res);
    redirect(res, withAuthError(returnTo, error));
    return;
  }

  if (!code) {
    clearSessionCookie(res);
    redirect(res, withAuthError(returnTo, 'missing_code'));
    return;
  }

  try {
    const session = await exchangeCodeForToken({
      code,
      codeVerifier: stateCookie.codeVerifier,
      redirectUri: `${getRequestBaseUrl(req)}/api/auth/callback`,
    });

    writeSessionCookie(res, session);
    redirect(res, withAuthStatus(returnTo, 'connected'));
  } catch (exchangeError) {
    clearSessionCookie(res);
    redirect(res, withAuthError(returnTo, exchangeError instanceof Error ? exchangeError.message : 'exchange_failed'));
  }
}

function withAuthStatus(returnTo, status) {
  const url = new URL(returnTo);
  url.searchParams.set('auth', status);
  return url.toString();
}

function withAuthError(returnTo, error) {
  const url = new URL(returnTo);
  url.searchParams.set('authError', error);
  return url.toString();
}
