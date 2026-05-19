import {
  buildAuthorizationUrl,
  createCodeChallenge,
  createRandomToken,
  getGitHubAuthConfigError,
  isGitHubAuthConfigured,
  redirect,
  resolveReturnTo,
  sendJson,
  writeAuthStateCookie,
} from '../_lib/github-auth.js';

export default function handler(req, res) {
  if (!isGitHubAuthConfigured()) {
    sendJson(res, 503, { error: getGitHubAuthConfigError() });
    return;
  }

  if (req.method !== 'GET') {
    sendJson(res, 404, { error: 'Not found.' });
    return;
  }

  const url = new URL(req.url || '/', 'https://municipio.local');
  const returnTo = resolveReturnTo(req, url.searchParams.get('returnTo'));
  const state = createRandomToken();
  const codeVerifier = createRandomToken(48);
  const codeChallenge = createCodeChallenge(codeVerifier);

  writeAuthStateCookie(res, {
    state,
    codeVerifier,
    returnTo,
  });

  redirect(res, buildAuthorizationUrl(req, { state, codeChallenge }));
}
