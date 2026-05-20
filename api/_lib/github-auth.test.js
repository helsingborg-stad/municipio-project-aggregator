// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';

import {
  createCodeChallenge,
  getGitHubAuthConfigError,
  getRequestBaseUrl,
  isGitHubAuthConfigured,
  resolveReturnTo,
} from './github-auth';

describe('github auth helpers', () => {
  it('creates a pkce challenge and resolves request URLs', () => {
    const codeChallenge = createCodeChallenge('verifier-value');
    expect(codeChallenge).toMatch(/^[A-Za-z0-9_-]+$/);

    const req = {
      headers: {
        host: 'localhost:3000',
      },
    };

    expect(getRequestBaseUrl(req)).toBe('https://localhost:3000');
    expect(resolveReturnTo(req, 'https://localhost:3000/backlog')).toBe('https://localhost:3000/backlog');
  });

  it('reports missing GitHub OAuth configuration', () => {
    vi.stubEnv('GITHUB_OAUTH_CLIENT_ID', '');
    vi.stubEnv('GITHUB_OAUTH_CLIENT_SECRET', '');
    vi.stubEnv('GITHUB_SESSION_SECRET', '');

    expect(isGitHubAuthConfigured()).toBe(false);
    expect(getGitHubAuthConfigError()).toContain('GitHub OAuth is not configured');
  });
});
