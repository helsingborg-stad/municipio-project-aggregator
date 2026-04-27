import { describe, expect, it, vi } from 'vitest';

import {
  filterAuthors,
  filterItems,
  filterRepositories,
  formatRelativeTime,
  formatTimestamp,
  getAuthorDirectory,
  getFilterOptions,
  getItemTree,
  getMilestoneGroups,
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

describe('getMilestoneGroups', () => {
  it('groups items by milestone and keeps no-milestone items last', () => {
    const groups = getMilestoneGroups([
      { title: 'No milestone', createdAt: '2026-04-22T10:00:00Z', milestone: null },
      { title: 'Q3 item', createdAt: '2026-04-24T10:00:00Z', milestone: { title: 'Q3' } },
      { title: 'Q2 older', createdAt: '2026-04-20T10:00:00Z', milestone: { title: 'Q2' } },
      { title: 'Q2 newer', createdAt: '2026-04-21T10:00:00Z', milestone: { title: 'Q2' } },
    ]);

    expect(groups.map((group) => group.milestone)).toEqual(['Q2', 'Q3', 'No milestone']);
    expect(groups[0].items.map((item) => item.title)).toEqual(['Q2 newer', 'Q2 older']);
  });
});

describe('formatRelativeTime', () => {
  it('formats past dates using the browser locale', () => {
    const format = vi.fn().mockReturnValue('2 days ago');
    const relativeTimeFormat = vi.spyOn(Intl, 'RelativeTimeFormat').mockImplementation((locale, options) => {
      expect(locale).toBeUndefined();
      expect(options).toEqual({ numeric: 'auto' });

      return { format };
    });

    const formatted = formatRelativeTime('2026-04-22T10:00:00Z', new Date('2026-04-24T10:00:00Z'));

    expect(formatted).toBe('2 days ago');
    expect(format).toHaveBeenCalledWith(-2, 'day');
    expect(relativeTimeFormat).toHaveBeenCalledOnce();
  });
});

describe('formatTimestamp', () => {
  it('formats timestamps using the browser locale and local timezone', () => {
    const format = vi.fn().mockReturnValue('Apr 22, 2026, 12:00');
    const dateTimeFormat = vi.spyOn(Intl, 'DateTimeFormat').mockImplementation((locale, options) => {
      expect(locale).toBeUndefined();
      expect(options).toEqual({
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });

      return { format };
    });

    const formatted = formatTimestamp('2026-04-22T10:00:00Z');

    expect(formatted).toBe('Apr 22, 2026, 12:00');
    expect(format).toHaveBeenCalledWith(expect.any(Date));
    expect(dateTimeFormat).toHaveBeenCalledOnce();
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
  it('collects unique authors with weighted scores', () => {
    const authors = getAuthorDirectory([
      { source: 'issues', author: { login: 'octocat', avatarUrl: 'https://example.com/octocat.png', url: 'https://github.com/octocat' } },
      { source: 'issues', author: { login: 'hubot', avatarUrl: 'https://example.com/hubot.png', url: 'https://github.com/hubot' } },
      { source: 'pull-requests', author: { login: 'octocat', avatarUrl: 'https://example.com/octocat.png', url: 'https://github.com/octocat' } },
    ]);

    expect(authors).toEqual([
      {
        login: 'octocat',
        avatarUrl: 'https://example.com/octocat.png',
        url: 'https://github.com/octocat',
        score: 1.1,
      },
      {
        login: 'hubot',
        avatarUrl: 'https://example.com/hubot.png',
        url: 'https://github.com/hubot',
        score: 0.1,
      },
    ]);
  });
});

describe('filterRepositories', () => {
  it('filters repositories by name, owner, and description', () => {
    const repositories = filterRepositories([
      { fullName: 'helsingborg-stad/plugin-a', name: 'plugin-a', owner: 'helsingborg-stad', description: 'Searchable alpha plugin' },
      { fullName: 'helsingborg-stad/plugin-b', name: 'plugin-b', owner: 'helsingborg-stad', description: 'Another repository' },
    ], 'alpha');

    expect(repositories).toHaveLength(1);
    expect(repositories[0].name).toBe('plugin-a');
  });
});

describe('filterAuthors', () => {
  it('filters authors by login', () => {
    const authors = filterAuthors([
      { login: 'octocat', url: 'https://github.com/octocat' },
      { login: 'hubot', url: 'https://github.com/hubot' },
    ], 'octo');

    expect(authors).toHaveLength(1);
    expect(authors[0].login).toBe('octocat');
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

  it('filters items by free-text search across item metadata', () => {
    const filtered = filterItems(items, {
      author: '',
      assignee: '',
      milestone: '',
      type: '',
      subIssues: 'all',
      relationships: 'all',
    }, 'hubot');

    expect(filtered).toHaveLength(1);
    expect(filtered[0].author.login).toBe('octocat');
  });
});

describe('getItemTree', () => {
  it('nests visible sub-issues under their parent items', () => {
    const tree = getItemTree([
      {
        title: 'Parent',
        url: 'https://github.com/helsingborg-stad/plugin-alpha/issues/1',
        createdAt: '2026-04-24T10:00:00Z',
        subIssueUrls: ['https://github.com/helsingborg-stad/plugin-alpha/issues/2'],
      },
      {
        title: 'Child',
        url: 'https://github.com/helsingborg-stad/plugin-alpha/issues/2',
        createdAt: '2026-04-24T09:00:00Z',
        subIssueUrls: [],
      },
      {
        title: 'Independent',
        url: 'https://github.com/helsingborg-stad/plugin-alpha/issues/3',
        createdAt: '2026-04-24T08:00:00Z',
        subIssueUrls: [],
      },
    ]);

    expect(tree).toHaveLength(2);
    expect(tree[0].title).toBe('Parent');
    expect(tree[0].children.map((item) => item.title)).toEqual(['Child']);
    expect(tree[1].title).toBe('Independent');
  });

  it('keeps child items at the root when the parent is not visible', () => {
    const tree = getItemTree([
      {
        title: 'Child',
        url: 'https://github.com/helsingborg-stad/plugin-alpha/issues/2',
        createdAt: '2026-04-24T09:00:00Z',
        subIssueUrls: [],
      },
    ]);

    expect(tree).toHaveLength(1);
    expect(tree[0].title).toBe('Child');
    expect(tree[0].children).toEqual([]);
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
