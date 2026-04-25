import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import App from './App';

const issuesPayload = {
  source: 'issues',
  sourceScope: 'GitHub',
  generatedAt: '2026-04-25T10:00:00Z',
  count: 1,
  topics: ['municipio-se', 'getmunicipio'],
  repositories: [
    {
      owner: 'helsingborg-stad',
      name: 'plugin-alpha',
      fullName: 'helsingborg-stad/plugin-alpha',
      description: 'Compatible plugin alpha',
      url: 'https://github.com/helsingborg-stad/plugin-alpha',
    },
  ],
  items: [
    {
      title: 'Issue alpha',
      url: 'https://github.com/helsingborg-stad/plugin-alpha/issues/1',
      repository: 'helsingborg-stad/plugin-alpha',
      createdAt: '2026-04-25T09:00:00Z',
      number: 1,
      author: {
        login: 'octocat',
        avatarUrl: 'https://avatars.example.com/octocat.png',
        url: 'https://github.com/octocat',
      },
      assignees: [],
      milestone: null,
      type: null,
      subIssues: { total: 0, completed: 0, percentCompleted: 0 },
      relationshipSummary: { blockedBy: 0, totalBlockedBy: 0, blocking: 0, totalBlocking: 0, linked: 0 },
      relationships: [],
    },
  ],
};

const pullRequestsPayload = {
  source: 'pull-requests',
  sourceScope: 'GitHub',
  generatedAt: '2026-04-25T11:00:00Z',
  count: 1,
  topics: ['municipio-se', 'getmunicipio'],
  repositories: [
    {
      owner: 'helsingborg-stad',
      name: 'plugin-alpha',
      fullName: 'helsingborg-stad/plugin-alpha',
      description: 'Compatible plugin alpha',
      url: 'https://github.com/helsingborg-stad/plugin-alpha',
    },
    {
      owner: 'helsingborg-stad',
      name: 'plugin-beta',
      fullName: 'helsingborg-stad/plugin-beta',
      description: 'Compatible plugin beta',
      url: 'https://github.com/helsingborg-stad/plugin-beta',
    },
  ],
  items: [
    {
      title: 'Pull request beta',
      url: 'https://github.com/helsingborg-stad/plugin-beta/pull/4',
      repository: 'helsingborg-stad/plugin-beta',
      createdAt: '2026-04-25T10:00:00Z',
      number: 4,
      author: {
        login: 'octocat',
        avatarUrl: 'https://avatars.example.com/octocat.png',
        url: 'https://github.com/octocat',
      },
      assignees: [],
      milestone: null,
      type: 'Feature',
      subIssues: { total: 0, completed: 0, percentCompleted: 0 },
      relationshipSummary: { blockedBy: 0, totalBlockedBy: 0, blocking: 0, totalBlocking: 0, linked: 0 },
      relationships: [],
    },
  ],
};

describe('App', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders repository and author tabs from aggregated payload metadata', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input) => {
      const url = String(input);

      return {
        ok: true,
        json: async () => (url.includes('issues.json') ? issuesPayload : pullRequestsPayload),
      };
    }));

    render(<App />);

    await screen.findByText('1 of 1 open issues');

    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Repositories' }));

    expect(await screen.findByRole('heading', { name: 'Compatible plugins' })).toBeInTheDocument();
    expect(screen.getByText('plugin-alpha')).toBeInTheDocument();
    expect(screen.getByText('plugin-beta')).toBeInTheDocument();
    expect(screen.getByText('Compatible plugin beta')).toBeInTheDocument();

    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Authors' }));

    expect(await screen.findByRole('heading', { name: 'Contributors' })).toBeInTheDocument();
    expect(screen.getByText('2 tracked contributions')).toBeInTheDocument();
  });
});
