import { afterEach, describe, expect, it, vi } from 'vitest';

import { createGitHubIssue, runGitHubGraphql } from './github';

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

  it('sends the issue body when creating a GitHub issue', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ data: { createIssue: { issue: { id: 'I_1', title: 'Demo issue', body: 'Issue body' } } } }),
    }));
    vi.stubGlobal('fetch', fetchMock);

    await createGitHubIssue({
      repositoryId: 'repo-1',
      title: 'Demo issue',
      body: 'Issue body',
      labelIds: ['label-1'],
      assigneeIds: ['user-1'],
    });

    const requestBody = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(requestBody.variables.input.body).toBe('Issue body');
  });
});
