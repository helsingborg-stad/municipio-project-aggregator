import {
  readSessionCookie,
  runGitHubGraphql,
  sendJson,
} from '../_lib/github-auth.js';

async function readJson(req) {
  const chunks = [];

  for await (const chunk of req) {
    chunks.push(chunk);
  }

  if (chunks.length === 0) {
    return {};
  }

  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    sendJson(res, 404, { error: 'Not found.' });
    return;
  }

  const session = readSessionCookie(req);

  if (!session) {
    sendJson(res, 401, { error: 'Authentication is required.' });
    return;
  }

  try {
    const body = await readJson(req);
    const query = typeof body.query === 'string' ? body.query : '';
    const variables = body.variables && typeof body.variables === 'object' ? body.variables : {};

    if (!query) {
      sendJson(res, 400, { error: 'query is required.' });
      return;
    }

    const payload = await runGitHubGraphql(session, query, variables);
    sendJson(res, 200, payload);
  } catch (error) {
    sendJson(res, 500, { error: error instanceof Error ? error.message : 'GitHub proxy request failed.' });
  }
}
