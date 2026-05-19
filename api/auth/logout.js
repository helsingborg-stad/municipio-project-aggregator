import {
  clearAuthStateCookie,
  clearSessionCookie,
  getRequestBaseUrl,
  redirect,
  resolveReturnTo,
  sendJson,
} from '../_lib/github-auth.js';

export default function handler(req, res) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    sendJson(res, 404, { error: 'Not found.' });
    return;
  }

  clearAuthStateCookie(res);
  clearSessionCookie(res);

  const requestUrl = new URL(req.url || '/', getRequestBaseUrl(req));
  redirect(res, resolveReturnTo(req, requestUrl.searchParams.get('returnTo')));
}
