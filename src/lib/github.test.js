import { afterEach, describe, expect, it, vi } from 'vitest';

import { runGitHubGraphql } from './github';

describe('github helper', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('throws when the proxy request fails', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: false,
      json: async () => ({ error: 'Authentication is required.' }),
    })));

    await expect(runGitHubGraphql('query Viewer { viewer { login } }')).rejects.toThrow('Authentication is required.');
  });

  it('throws when GitHub returns GraphQL errors', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({ errors: [{ message: 'Mutation failed.' }] }),
    })));

    await expect(runGitHubGraphql('mutation Broken { broken }')).rejects.toThrow('Mutation failed.');
  });
});
