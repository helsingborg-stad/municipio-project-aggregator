import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import App from './App';
import { formatTimestamp } from '@/lib/dashboard';

const issuesPayload = {
  source: 'issues',
  sourceScope: 'GitHub',
  generatedAt: '2026-04-25T10:00:00Z',
  count: 2,
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
      milestone: { title: 'Q2', url: 'https://github.com/helsingborg-stad/plugin-alpha/milestone/1', dueOn: '2026-06-01T00:00:00Z' },
      type: null,
      subIssues: { total: 1, completed: 0, percentCompleted: 0 },
      subIssueUrls: ['https://github.com/helsingborg-stad/plugin-alpha/issues/2'],
      relationshipSummary: { blockedBy: 0, totalBlockedBy: 0, blocking: 0, totalBlocking: 0, linked: 0 },
      relationships: [],
    },
    {
      title: 'Issue alpha child',
      url: 'https://github.com/helsingborg-stad/plugin-alpha/issues/2',
      repository: 'helsingborg-stad/plugin-alpha',
      createdAt: '2026-04-25T08:00:00Z',
      number: 2,
      author: {
        login: 'octocat',
        avatarUrl: 'https://avatars.example.com/octocat.png',
        url: 'https://github.com/octocat',
      },
      assignees: [],
      milestone: { title: 'Q2', url: 'https://github.com/helsingborg-stad/plugin-alpha/milestone/1', dueOn: '2026-06-01T00:00:00Z' },
      type: null,
      subIssues: { total: 0, completed: 0, percentCompleted: 0 },
      subIssueUrls: [],
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
      subIssueUrls: [],
      relationshipSummary: { blockedBy: 0, totalBlockedBy: 0, blocking: 0, totalBlocking: 0, linked: 0 },
      relationships: [],
    },
  ],
};

describe('App', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
    window.history.replaceState({}, '', '/');
  });

  function mockDashboardFetch() {
    vi.stubGlobal('fetch', vi.fn(async (input) => {
      const url = String(input);

      return {
        ok: true,
        json: async () => (url.includes('issues.json') ? issuesPayload : pullRequestsPayload),
      };
    }));
  }

  it('renders repository and contributor tabs from aggregated payload metadata', async () => {
    mockDashboardFetch();

    render(<App />);

    await screen.findByText('2 of 2 open issues');

    expect(window.location.search).toBe('?tab=issues');

    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Repositories' }));

    expect(await screen.findByRole('heading', { name: 'Compatible plugins' })).toBeInTheDocument();
    expect(window.location.search).toBe('?tab=repositories');
    expect(screen.getByText('plugin-alpha')).toBeInTheDocument();
    expect(screen.getByText('plugin-beta')).toBeInTheDocument();
    expect(screen.getByText('Compatible plugin beta')).toBeInTheDocument();

    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Authors' }));

    expect(await screen.findByRole('heading', { name: 'Contributors' })).toBeInTheDocument();
    expect(window.location.search).toBe('?tab=authors');
    expect(screen.getByText('Score: 1.2')).toBeInTheDocument();
    expect(screen.getByText('Score is weighted by item type: each issue is worth 0.1 points and each pull request is worth 1.0 point.')).toBeInTheDocument();

    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Pull Requests' }));

    expect(await screen.findByText('Pull request beta')).toBeInTheDocument();
    expect(window.location.search).toBe('?tab=pull-requests');
  });

  it('filters all tabs with the shared free-text search', async () => {
    mockDashboardFetch();

    render(<App />);

    await screen.findByText('2 of 2 open issues');

    fireEvent.change(screen.getByRole('searchbox', { name: 'Search all tabs' }), { target: { value: 'beta' } });

    expect(screen.getByText('0 of 2 open issues')).toBeInTheDocument();

    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Pull Requests' }));
    expect(await screen.findByText('Pull request beta')).toBeInTheDocument();

    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Repositories' }));
    expect(await screen.findByText('plugin-beta')).toBeInTheDocument();
    expect(screen.queryByText('plugin-alpha')).not.toBeInTheDocument();

    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Authors' }));
    expect(await screen.findByText('No authors match the current search.')).toBeInTheDocument();
  });

  it('restores the selected main tab from the url', async () => {
    mockDashboardFetch();
    window.history.replaceState({}, '', '/?tab=authors');

    render(<App />);

    expect(await screen.findByRole('heading', { name: 'Contributors' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Authors' })).toHaveAttribute('aria-selected', 'true');
  });

  it('maps the legacy contributors url to authors', async () => {
    mockDashboardFetch();
    window.history.replaceState({}, '', '/?tab=contributors');

    render(<App />);

    expect(await screen.findByRole('heading', { name: 'Contributors' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Authors' })).toHaveAttribute('aria-selected', 'true');
    expect(window.location.search).toBe('?tab=authors');
  });

  it('remembers source filters and view mode and clears saved preferences', async () => {
    mockDashboardFetch();

    const storageKey = 'municipio-project-aggregator:source-panel:issues';
    const { unmount } = render(<App />);

    await screen.findByText('2 of 2 open issues');

    fireEvent.change(screen.getByLabelText('Author'), { target: { value: 'octocat' } });
    fireEvent.click(screen.getByRole('button', { name: 'List view' }));
    fireEvent.click(screen.getByRole('button', { name: 'Expand sub-items for Issue alpha' }));

    await waitFor(() => {
      expect(window.localStorage.getItem(storageKey)).toContain('"author":"octocat"');
      expect(window.localStorage.getItem(storageKey)).toContain('"viewMode":"list"');
      expect(window.localStorage.getItem(storageKey)).toContain('https://github.com/helsingborg-stad/plugin-alpha/issues/1');
    });

    unmount();

    render(<App />);

    await screen.findByText('2 of 2 open issues');

    expect(screen.getByLabelText('Author')).toHaveValue('octocat');
    expect(screen.getByRole('button', { name: 'List view' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Collapse sub-items for Issue alpha' })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Issue alpha child')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Q2' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Clear saved view' }));

    await waitFor(() => {
      expect(screen.getByLabelText('Author')).toHaveValue('');
      expect(screen.getByRole('button', { name: 'Card view' })).toHaveAttribute('aria-pressed', 'true');
      expect(window.localStorage.getItem(storageKey)).toBeNull();
    });
  });

  it('renders source items in stacked layouts with container-aware cards', async () => {
    mockDashboardFetch();

    render(<App />);

    const issueCard = (await screen.findByText('Issue alpha')).closest('li');
    expect(issueCard).toHaveClass('source-item-card');
    expect(issueCard.closest('ul')).toHaveClass('grid');
    expect(issueCard.closest('ul')).toHaveClass('md:grid-cols-2');
    expect(issueCard.closest('ul')).toHaveClass('xl:grid-cols-3');

    fireEvent.click(screen.getByRole('button', { name: 'List view' }));

    await waitFor(() => {
      const milestoneSection = screen.getByRole('heading', { name: 'Q2' }).closest('section');

      expect(milestoneSection.parentElement).toHaveClass('source-panel__stack');
      expect(milestoneSection.parentElement).not.toHaveClass('xl:grid-cols-2');
    });
  });

  it('renders the repository column as organization and repository name in list view', async () => {
    mockDashboardFetch();

    render(<App />);

    await screen.findByText('2 of 2 open issues');

    fireEvent.click(screen.getByRole('button', { name: 'List view' }));

    await waitFor(() => {
      expect(screen.getByText('helsingborg-stad')).toBeInTheDocument();
      expect(screen.getByText('plugin-alpha')).toBeInTheDocument();
      expect(screen.queryByText('/plugin-alpha')).not.toBeInTheDocument();
    });

    expect(screen.getByText(formatTimestamp(issuesPayload.items[0].createdAt)).closest('div')).toHaveClass('whitespace-nowrap');
  });

  it('shows people in the card corner and hides empty stats and cross-reference labels', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input) => {
      const url = String(input);

      if (url.includes('issues.json')) {
        return {
          ok: true,
          json: async () => ({
            ...issuesPayload,
            items: issuesPayload.items.map((item) => ({
              ...item,
              subIssues: { total: 0, completed: 0, percentCompleted: 0 },
              assignees: [{
                login: 'octocat-with-a-very-long-name-that-should-not-overflow-the-card-layout',
                avatarUrl: 'https://avatars.example.com/octocat-long.png',
                url: 'https://github.com/octocat-with-a-very-long-name-that-should-not-overflow-the-card-layout',
              }],
              relationshipSummary: { blockedBy: 0, totalBlockedBy: 0, blocking: 0, totalBlocking: 0, linked: 1 },
              relationships: [{
                event: 'cross referenced',
                title: 'Related issue gamma',
                url: 'https://github.com/helsingborg-stad/plugin-alpha/issues/99',
                repository: 'helsingborg-stad/plugin-alpha',
              }],
            })),
          }),
        };
      }

      return {
        ok: true,
        json: async () => pullRequestsPayload,
      };
    }));

    render(<App />);

    await screen.findByText('Issue alpha');
    const issueCard = screen.getByText('Issue alpha').closest('li');
    const authorAvatar = screen.getAllByTitle('Author: octocat')[0];
    const authorTooltip = authorAvatar.lastElementChild;

    expect(screen.getAllByTitle('Author: octocat').length).toBeGreaterThan(0);
    expect(screen.getAllByTitle('Assignee: octocat-with-a-very-long-name-that-should-not-overflow-the-card-layout').length).toBeGreaterThan(0);
    expect(authorAvatar).toHaveClass('group/avatar');
    expect(authorTooltip).toHaveClass('group-hover/avatar:opacity-100');
    expect(authorTooltip).not.toHaveClass('group-hover:opacity-100');
    expect(within(issueCard).queryByText('Assignees')).not.toBeInTheDocument();
    expect(within(issueCard).queryByText(/^Author:/)).not.toBeInTheDocument();
    expect(within(issueCard).queryByText('Sub-issues')).not.toBeInTheDocument();
    expect(within(issueCard).queryByText('Dependencies')).not.toBeInTheDocument();
    expect(within(issueCard).getByText('Related issue gamma')).toBeInTheDocument();
    expect(within(issueCard).queryByText('cross referenced')).not.toBeInTheDocument();
  });
});
