import { describe, expect, it } from 'vitest';

import {
  filterItems,
  formatRelativeTime,
  getAuthorDirectory,
  getFilterOptions,
  getRepositoryCatalog,
  getRepositoryGroups,
  hasRelationships,
  hasSubIssues,
  truncateText,
} from './dashboard';

describe('getRepositoryGroups', () => {
  it('groups items by repository and sorts items newest first', () => {
    const groups = getRepositoryGroups([
      { repository: 'beta', createdAt: '2026-04-21T10:00:00Z' },
      { repository: 'alpha', createdAt: '2026-04-20T10:00:00Z' },
      { repository: 'beta', createdAt: '2026-04-22T10:00:00Z' },
    ]);

    expect(groups).toHaveLength(2);
    expect(groups[0].repository).toBe('alpha');
    expect(groups[1].items[0].createdAt).toBe('2026-04-22T10:00:00Z');
  });
});

describe('formatRelativeTime', () => {
  it('formats past dates relative to the supplied current time', () => {
    const formatted = formatRelativeTime('2026-04-22T10:00:00Z', new Date('2026-04-24T10:00:00Z'));

    expect(formatted).toBe('2 days ago');
  });
});

describe('getFilterOptions', () => {
  it('collects unique filter values from item metadata', () => {
    const options = getFilterOptions([
      {
        author: { login: 'octocat' },
        assignees: [{ login: 'hubot' }],
        milestone: { title: 'Q2' },
        type: 'Feature',
      },
      {
        author: { login: 'monalisa' },
        assignees: [{ login: 'hubot' }, { login: 'octocat' }],
        milestone: null,
        type: null,
      },
    ]);

    expect(options.authors).toEqual(['monalisa', 'octocat']);
    expect(options.assignees).toEqual(['hubot', 'octocat']);
    expect(options.milestones).toEqual(['Q2']);
    expect(options.types).toEqual(['Feature']);
  });
});

describe('getRepositoryCatalog', () => {
  it('collects unique repositories and counts tracked items', () => {
    const repositories = getRepositoryCatalog([
      {
        repositories: [
          {
            fullName: 'helsingborg-stad/plugin-a',
            name: 'plugin-a',
            owner: 'helsingborg-stad',
            description: 'Plugin A',
            url: 'https://github.com/helsingborg-stad/plugin-a',
          },
          {
            fullName: 'helsingborg-stad/plugin-b',
            name: 'plugin-b',
            owner: 'helsingborg-stad',
            description: 'Plugin B',
            url: 'https://github.com/helsingborg-stad/plugin-b',
          },
        ],
        items: [
          { repository: 'helsingborg-stad/plugin-a' },
          { repository: 'helsingborg-stad/plugin-a' },
        ],
      },
      {
        repositories: [
          {
            fullName: 'helsingborg-stad/plugin-b',
            name: 'plugin-b',
            owner: 'helsingborg-stad',
            description: 'Plugin B',
            url: 'https://github.com/helsingborg-stad/plugin-b',
          },
        ],
        items: [{ repository: 'helsingborg-stad/plugin-b' }],
      },
    ]);

    expect(repositories).toHaveLength(2);
    expect(repositories[0].fullName).toBe('helsingborg-stad/plugin-a');
    expect(repositories[0].itemCount).toBe(2);
    expect(repositories[1].itemCount).toBe(1);
  });
});

describe('getAuthorDirectory', () => {
  it('collects unique authors with contribution counts', () => {
    const authors = getAuthorDirectory([
      { author: { login: 'octocat', avatarUrl: 'https://example.com/octocat.png', url: 'https://github.com/octocat' } },
      { author: { login: 'hubot', avatarUrl: 'https://example.com/hubot.png', url: 'https://github.com/hubot' } },
      { author: { login: 'octocat', avatarUrl: 'https://example.com/octocat.png', url: 'https://github.com/octocat' } },
    ]);

    expect(authors).toEqual([
      {
        login: 'octocat',
        avatarUrl: 'https://example.com/octocat.png',
        url: 'https://github.com/octocat',
        contributionCount: 2,
      },
      {
        login: 'hubot',
        avatarUrl: 'https://example.com/hubot.png',
        url: 'https://github.com/hubot',
        contributionCount: 1,
      },
    ]);
  });
});

describe('filterItems', () => {
  const items = [
    {
      author: { login: 'octocat' },
      assignees: [{ login: 'hubot' }],
      milestone: { title: 'Q2' },
      type: 'Feature',
      subIssues: { total: 2 },
      relationshipSummary: { linked: 1, blockedBy: 0, totalBlockedBy: 0, blocking: 0, totalBlocking: 0 },
    },
    {
      author: { login: 'monalisa' },
      assignees: [],
      milestone: null,
      type: null,
      subIssues: { total: 0 },
      relationshipSummary: { linked: 0, blockedBy: 0, totalBlockedBy: 0, blocking: 0, totalBlocking: 0 },
    },
  ];

  it('filters by metadata and presence toggles', () => {
    const filtered = filterItems(items, {
      author: 'octocat',
      assignee: 'hubot',
      milestone: 'Q2',
      type: 'Feature',
      subIssues: 'with',
      relationships: 'with',
    });

    expect(filtered).toHaveLength(1);
    expect(filtered[0].author.login).toBe('octocat');
  });

  it('supports no-value filters for assignees, milestone, and type', () => {
    const filtered = filterItems(items, {
      author: '',
      assignee: '__unassigned__',
      milestone: '__none__',
      type: '__none__',
      subIssues: 'without',
      relationships: 'without',
    });

    expect(filtered).toHaveLength(1);
    expect(filtered[0].author.login).toBe('monalisa');
  });
});

describe('presence helpers', () => {
  it('detects sub-issues and relationships from summary data', () => {
    expect(hasSubIssues({ subIssues: { total: 1 } })).toBe(true);
    expect(hasSubIssues({ subIssues: { total: 0 } })).toBe(false);
    expect(hasRelationships({ relationshipSummary: { linked: 0, blockedBy: 0, totalBlockedBy: 1, blocking: 0, totalBlocking: 0 } })).toBe(true);
    expect(hasRelationships({ relationshipSummary: { linked: 0, blockedBy: 0, totalBlockedBy: 0, blocking: 0, totalBlocking: 0 } })).toBe(false);
  });
});

describe('truncateText', () => {
  it('truncates long text while preserving short text', () => {
    expect(truncateText('Short text', 20)).toBe('Short text');
    expect(truncateText('This description is definitely longer than twenty characters.', 20)).toBe('This description is…');
  });
});
