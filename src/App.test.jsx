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
  authors: [
    {
      login: 'octocat',
      avatarUrl: 'https://avatars.example.com/octocat.png',
      company: 'GitHub',
      url: 'https://github.com/octocat',
    },
    {
      login: 'hubot',
      avatarUrl: 'https://avatars.example.com/hubot.png',
      company: 'Acme',
      url: 'https://github.com/hubot',
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
        company: 'GitHub',
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
        company: 'GitHub',
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
  authors: [
    {
      login: 'octocat',
      avatarUrl: 'https://avatars.example.com/octocat.png',
      company: 'GitHub',
      url: 'https://github.com/octocat',
    },
    {
      login: 'monalisa',
      avatarUrl: 'https://avatars.example.com/monalisa.png',
      company: 'Octo Arts',
      url: 'https://github.com/monalisa',
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
        company: 'GitHub',
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

const releasePageIndexPayload = {
  source: 'releases',
  sourceScope: 'GitHub',
  generatedAt: '2026-04-26T11:00:00Z',
  count: 12,
  pageSize: 10,
  pageCount: 2,
  repository: {
    owner: 'municipio-se',
    name: 'municipio-deployment',
    fullName: 'municipio-se/municipio-deployment',
    description: 'Deployment tooling',
    url: 'https://github.com/municipio-se/municipio-deployment',
  },
  pages: [
    { pageNumber: 1, file: 'page-1.json', itemCount: 10 },
    { pageNumber: 2, file: 'page-2.json', itemCount: 2 },
  ],
};

const sprintPayload = {
  source: 'sprints',
  sourceScope: 'GitHub',
  generatedAt: '2026-04-28T11:00:00Z',
  count: 3,
  project: {
    owner: 'helsingborg-stad',
    number: 7,
    title: 'Roadmap',
    url: 'https://github.com/orgs/helsingborg-stad/projects/7',
  },
  view: {
    id: 'PVTV_1',
    name: 'Board',
    number: 1,
    layout: 'BOARD_LAYOUT',
    filter: 'status:Todo',
  },
  currentFilter: 'status:Todo',
  currentSprint: {
    label: 'Current Sprint',
    title: 'Sprint 14',
    startDate: '2026-04-28',
    endDate: '2026-05-11',
    itemCount: 1,
    items: [
      {
        title: 'Implement sprint tab',
        url: 'https://github.com/helsingborg-stad/municipio-project-aggregator/issues/1',
        number: 1,
        repository: 'helsingborg-stad/municipio-project-aggregator',
        type: 'Issue',
        state: 'Open',
        status: 'In progress',
      },
    ],
  },
  nextSprint: {
    label: 'Next Sprint',
    title: 'Sprint 15',
    startDate: '2026-05-12',
    endDate: '2026-05-25',
    itemCount: 2,
    items: [
      {
        title: 'Track project filter',
        url: 'https://github.com/helsingborg-stad/municipio-project-aggregator/issues/2',
        number: 2,
        repository: 'helsingborg-stad/municipio-project-aggregator',
        type: 'Issue',
        state: 'Open',
        status: 'Todo',
      },
      {
        title: 'Ship sprint view',
        url: 'https://github.com/helsingborg-stad/municipio-project-aggregator/pull/3',
        number: 3,
        repository: 'helsingborg-stad/municipio-project-aggregator',
        type: 'Pull Request',
        state: 'Merged',
        status: 'Done',
      },
    ],
  },
};

const releasePageOnePayload = {
  source: 'releases',
  sourceScope: 'GitHub',
  generatedAt: '2026-04-26T11:00:00Z',
  count: 12,
  pageSize: 10,
  pageNumber: 1,
  pageCount: 2,
  repository: releasePageIndexPayload.repository,
  items: [
    {
      title: 'Release 3.2.1',
      version: 'v3.2.1',
      body: '## Highlights\n\nUse `npm run build:data` before deployment.\n\n- Added rollout support\n- Improved logs',
      url: 'https://github.com/municipio-se/municipio-deployment/releases/tag/v3.2.1',
      publishedAt: '2026-04-26T08:00:00Z',
      isPrerelease: false,
      isDraft: false,
    },
    {
      title: 'Release 3.2.0-rc1',
      version: 'v3.2.0-rc1',
      body: 'Release candidate',
      url: 'https://github.com/municipio-se/municipio-deployment/releases/tag/v3.2.0-rc1',
      publishedAt: '2026-04-20T08:00:00Z',
      isPrerelease: true,
      isDraft: false,
    },
    ...Array.from({ length: 8 }, (_, index) => ({
      title: `Release filler ${index + 1}`,
      version: `v3.1.${index + 8}`,
      body: 'Filler release notes',
      url: `https://github.com/municipio-se/municipio-deployment/releases/tag/v3.1.${index + 8}`,
      publishedAt: `2026-04-${String(18 - index).padStart(2, '0')}T08:00:00Z`,
      isPrerelease: false,
      isDraft: false,
    })),
  ],
};

const releasePageTwoPayload = {
  source: 'releases',
  sourceScope: 'GitHub',
  generatedAt: '2026-04-26T11:00:00Z',
  count: 12,
  pageSize: 10,
  pageNumber: 2,
  pageCount: 2,
  repository: releasePageIndexPayload.repository,
  items: [
    {
      title: 'Release 3.0.1',
      version: 'v3.0.1',
      body: 'Maintenance release',
      url: 'https://github.com/municipio-se/municipio-deployment/releases/tag/v3.0.1',
      publishedAt: '2026-04-09T08:00:00Z',
      isPrerelease: false,
      isDraft: false,
    },
    {
      title: 'Release 3.0.0',
      version: 'v3.0.0',
      body: 'Major release',
      url: 'https://github.com/municipio-se/municipio-deployment/releases/tag/v3.0.0',
      publishedAt: '2026-04-08T08:00:00Z',
      isPrerelease: false,
      isDraft: false,
    },
  ],
};

describe('App', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
    window.history.replaceState({}, '', '/');
  });

  function jsonResponse(payload) {
    return {
      ok: true,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => payload,
    };
  }

  function mockDashboardFetch() {
    vi.stubGlobal('fetch', vi.fn(async (input) => {
      const url = String(input);

      if (url.includes('issues.json')) {
        return jsonResponse(issuesPayload);
      }

      if (url.includes('pull-requests.json')) {
        return jsonResponse(pullRequestsPayload);
      }

      if (url.includes('sprints.json')) {
        return jsonResponse(sprintPayload);
      }

      if (url.includes('releases/pageIndex.json')) {
        return jsonResponse(releasePageIndexPayload);
      }

      if (url.includes('releases/page-2.json')) {
        return jsonResponse(releasePageTwoPayload);
      }

      return jsonResponse(releasePageOnePayload);
    }));
  }

  function hasCombinedText(text) {
    return (_, element) => element?.textContent === text;
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
    expect(screen.getByText('GitHub')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Current activity' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Historic contributors' })).toBeInTheDocument();
    expect(screen.getByText('monalisa')).toBeInTheDocument();
    expect(screen.queryByText('Score: 1.2')).not.toBeInTheDocument();

    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Sprints' }));

    expect(await screen.findByRole('heading', { name: 'Sprints' })).toBeInTheDocument();
    expect(screen.getByText('Current filter:')).toBeInTheDocument();
    expect(screen.getByText('status:Todo')).toBeInTheDocument();
    expect(screen.getByText('Implement sprint tab')).toBeInTheDocument();
    expect(screen.getByText('Ship sprint view')).toBeInTheDocument();
    expect(screen.getByText('In progress')).toBeInTheDocument();
    expect(screen.getByText('Merged')).toBeInTheDocument();

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

    fireEvent.change(screen.getByRole('searchbox', { name: 'Search all tabs' }), { target: { value: 'merged' } });
    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Sprints' }));
    expect(await screen.findByText('Ship sprint view')).toBeInTheDocument();
    expect(screen.queryByText('Implement sprint tab')).not.toBeInTheDocument();
  });

  it('renders a release log tab with markdown content', async () => {
    mockDashboardFetch();

    render(<App />);

    await screen.findByText('2 of 2 open issues');

    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Release log' }));

    expect(await screen.findByRole('heading', { name: 'Release log' })).toBeInTheDocument();
    expect(screen.getByText('v3.2.1')).toBeInTheDocument();
    expect(screen.getByText('Highlights')).toBeInTheDocument();
    expect(screen.getByText('Added rollout support')).toBeInTheDocument();
    expect(screen.getByText('npm run build:data')).toBeInTheDocument();
    expect(screen.getByText('Pre-release')).toBeInTheDocument();
    expect(screen.getByText(hasCombinedText('Page 1 of 2'))).toBeInTheDocument();
    expect(window.location.search).toBe('?tab=releases');
  });

  it('filters release entries with the shared search input', async () => {
    mockDashboardFetch();

    render(<App />);

    await screen.findByText('2 of 2 open issues');

    fireEvent.change(screen.getByRole('searchbox', { name: 'Search all tabs' }), { target: { value: 'v3.2.0-rc1' } });
    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Release log' }));

    expect(await screen.findByText('Release 3.2.0-rc1')).toBeInTheDocument();
    expect(screen.getByText('12 releases')).toBeInTheDocument();
  });

  it('paginates release entries with page-backed JSON files', async () => {
    mockDashboardFetch();

    render(<App />);

    await screen.findByText('2 of 2 open issues');

    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Release log' }));

    expect(await screen.findByText('Release 3.2.1')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Release page 2' }));

    await screen.findByText('Release 3.0.1');
    expect(screen.queryByText('Release 3.2.1')).not.toBeInTheDocument();
    expect(screen.getByText(hasCombinedText('Page 2 of 2'))).toBeInTheDocument();
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
          headers: new Headers({ 'content-type': 'application/json' }),
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
        headers: new Headers({ 'content-type': 'application/json' }),
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

  it('renders when sprint data is missing from the preview build', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input) => {
      const url = String(input);

      if (url.includes('issues.json')) {
        return jsonResponse(issuesPayload);
      }

      if (url.includes('pull-requests.json')) {
        return jsonResponse(pullRequestsPayload);
      }

      if (url.includes('sprints.json')) {
        return {
          ok: true,
          headers: new Headers({ 'content-type': 'text/html; charset=utf-8' }),
          json: async () => {
            throw new SyntaxError('Unexpected token < in JSON at position 0');
          },
        };
      }

      if (url.includes('releases/pageIndex.json')) {
        return jsonResponse(releasePageIndexPayload);
      }

      if (url.includes('releases/page-2.json')) {
        return jsonResponse(releasePageTwoPayload);
      }

      return jsonResponse(releasePageOnePayload);
    }));

    render(<App />);

    await screen.findByText('2 of 2 open issues');

    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Sprints' }));

    expect(await screen.findByRole('heading', { name: 'Sprints' })).toBeInTheDocument();
    expect(screen.getAllByText('No sprint data is available for this section.')).toHaveLength(2);
  });

  it('hides the card detail panel when an item has no detail content', async () => {
    mockDashboardFetch();

    render(<App />);

    await screen.findByText('Issue alpha child');

    const issueChildCard = screen.getByText('Issue alpha child').closest('li');

    expect(issueChildCard.querySelector('.source-item-card__details')).toBeNull();
    expect(issueChildCard.querySelector('.source-item-card__content')).toHaveClass('source-item-card__content--summary-only');
  });
});
