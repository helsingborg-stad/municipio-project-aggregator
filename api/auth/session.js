import {
  fetchViewer,
  getGitHubAuthConfigError,
  isGitHubAuthConfigured,
  readSessionCookie,
  sendJson,
} from '../_lib/github-auth.js';

export default async function handler(req, res) {
  if (!isGitHubAuthConfigured()) {
    sendJson(res, 200, {
      authenticated: false,
      available: false,
      error: getGitHubAuthConfigError(),
    });
    return;
  }

  if (req.method !== 'GET') {
    sendJson(res, 404, { error: 'Not found.' });
    return;
  }

  const session = readSessionCookie(req);

  if (!session) {
    sendJson(res, 200, {
      authenticated: false,
      available: true,
    });
    return;
  }

  try {
    const viewer = await fetchViewer(session);
    sendJson(res, 200, {
      authenticated: true,
      available: true,
      scope: session.scope,
      expiresAt: session.expiresAt,
      viewer,
    });
  } catch (error) {
    sendJson(res, 401, {
      authenticated: false,
      available: true,
      error: error instanceof Error ? error.message : 'Session validation failed.',
    });
  }
}
