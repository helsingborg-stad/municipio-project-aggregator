import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import App from './App';

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
      login: 'hubot',
      avatarUrl: 'https://avatars.example.com/hubot.png',
      company: 'Acme',
      url: 'https://github.com/hubot',
    },
  ],
  items: [
    {
      id: 'I_issue_1',
      title: 'Issue alpha',
      url: 'https://github.com/helsingborg-stad/plugin-alpha/issues/1',
      repository: 'helsingborg-stad/plugin-alpha',
      createdAt: '2026-04-25T09:00:00Z',
      number: 1,
      state: 'OPEN',
      labels: [{ id: 'label-estimate-5', name: 'estimate:5', color: '7c3aed', description: 'Five points' }],
      author: {
        login: 'octocat',
        avatarUrl: 'https://avatars.example.com/octocat.png',
        company: 'GitHub',
        url: 'https://github.com/octocat',
      },
      assignees: [],
      milestone: { title: 'Q2', url: 'https://github.com/helsingborg-stad/plugin-alpha/milestone/1', dueOn: '2026-06-01T00:00:00Z' },
      type: 'Issue',
      subIssues: { total: 1, completed: 0, percentCompleted: 0 },
      subIssueUrls: ['https://github.com/helsingborg-stad/plugin-alpha/issues/2'],
      relationshipSummary: { blockedBy: 0, totalBlockedBy: 0, blocking: 0, totalBlocking: 0, linked: 0 },
      relationships: [],
    },
    {
      id: 'I_issue_2',
      title: 'Issue alpha child',
      url: 'https://github.com/helsingborg-stad/plugin-alpha/issues/2',
      repository: 'helsingborg-stad/plugin-alpha',
      createdAt: '2026-04-25T08:00:00Z',
      number: 2,
      state: 'OPEN',
      labels: [],
      author: {
        login: 'octocat',
        avatarUrl: 'https://avatars.example.com/octocat.png',
        company: 'GitHub',
        url: 'https://github.com/octocat',
      },
      assignees: [],
      milestone: { title: 'Q2', url: 'https://github.com/helsingborg-stad/plugin-alpha/milestone/1', dueOn: '2026-06-01T00:00:00Z' },
      type: 'Issue',
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
  repositories: issuesPayload.repositories,
  authors: [
    {
      login: 'monalisa',
      avatarUrl: 'https://avatars.example.com/monalisa.png',
      company: 'Octo Arts',
      url: 'https://github.com/monalisa',
    },
  ],
  items: [
    {
      id: 'PR_4',
      title: 'Pull request beta',
      url: 'https://github.com/helsingborg-stad/plugin-beta/pull/4',
      repository: 'helsingborg-stad/plugin-beta',
      createdAt: '2026-04-25T10:00:00Z',
      number: 4,
      state: 'MERGED',
      labels: [{ id: 'label-release', name: 'release', color: '16a34a', description: 'Release work' }],
      author: {
        login: 'monalisa',
        avatarUrl: 'https://avatars.example.com/monalisa.png',
        company: 'Octo Arts',
        url: 'https://github.com/monalisa',
      },
      assignees: [],
      milestone: null,
      type: 'Pull Request',
      subIssues: { total: 0, completed: 0, percentCompleted: 0 },
      subIssueUrls: [],
      relationshipSummary: { blockedBy: 0, totalBlockedBy: 0, blocking: 0, totalBlocking: 0, linked: 0 },
      relationships: [],
    },
  ],
};

const planningPayload = {
  source: 'sprints',
  sourceScope: 'GitHub',
  generatedAt: '2026-04-28T11:00:00Z',
  count: 4,
  project: {
    id: 'PVT_project_1',
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
  fields: {
    status: {
      id: 'status-field',
      name: 'Status',
      options: [
        { id: 'status-backlog', name: 'Backlog', color: 'ORANGE', description: '' },
        { id: 'status-in-progress', name: 'In progress', color: 'BLUE', description: '' },
        { id: 'status-done', name: 'Done', color: 'GREEN', description: '' },
      ],
    },
    iteration: {
      id: 'iteration-field',
      name: 'Iteration',
      currentIterationId: 'iteration-current',
      nextIterationId: 'iteration-next',
      completedIterationId: 'iteration-previous',
      iterations: [
        { id: 'iteration-previous', title: 'Sprint 13', startDate: '2026-04-14', endDate: '2026-04-27', duration: 14 },
        { id: 'iteration-current', title: 'Sprint 14', startDate: '2026-04-28', endDate: '2026-05-11', duration: 14 },
        { id: 'iteration-next', title: 'Sprint 15', startDate: '2026-05-12', endDate: '2026-05-25', duration: 14 },
      ],
    },
  },
  backlog: {
    label: 'Backlog',
    title: 'Backlog',
    iterationId: null,
    startDate: null,
    endDate: null,
    itemCount: 1,
    items: [
      {
        projectItemId: 'item-backlog',
        contentId: 'I_issue_1',
        title: 'Issue alpha',
        url: 'https://github.com/helsingborg-stad/plugin-alpha/issues/1',
        number: 1,
        repository: 'helsingborg-stad/plugin-alpha',
        type: 'Issue',
        state: 'OPEN',
        status: 'Backlog',
        statusOptionId: 'status-backlog',
        iterationId: null,
        iterationTitle: null,
        updatedAt: '2026-04-28T11:00:00Z',
        labels: [{ id: 'label-estimate-5', name: 'estimate:5', color: '7c3aed', description: 'Five points' }],
        assignees: [],
        milestone: null,
      },
    ],
  },
  completedSprint: {
    label: 'Completed Sprint',
    title: 'Sprint 13',
    iterationId: 'iteration-previous',
    startDate: '2026-04-14',
    endDate: '2026-04-27',
    itemCount: 1,
    items: [
      {
        projectItemId: 'item-completed',
        contentId: 'PR_4',
        title: 'Pull request beta',
        url: 'https://github.com/helsingborg-stad/plugin-beta/pull/4',
        number: 4,
        repository: 'helsingborg-stad/plugin-beta',
        type: 'Pull Request',
        state: 'MERGED',
        status: 'Done',
        statusOptionId: 'status-done',
        iterationId: 'iteration-previous',
        iterationTitle: 'Sprint 13',
        updatedAt: '2026-04-27T11:00:00Z',
        labels: [{ id: 'label-release', name: 'release', color: '16a34a', description: 'Release work' }],
        assignees: [],
        milestone: null,
      },
    ],
  },
  currentSprint: {
    label: 'Current Sprint',
    title: 'Sprint 14',
    iterationId: 'iteration-current',
    startDate: '2026-04-28',
    endDate: '2026-05-11',
    itemCount: 1,
    items: [
      {
        projectItemId: 'item-current',
        contentId: 'I_issue_2',
        title: 'Issue alpha child',
        url: 'https://github.com/helsingborg-stad/plugin-alpha/issues/2',
        number: 2,
        repository: 'helsingborg-stad/plugin-alpha',
        type: 'Issue',
        state: 'OPEN',
        status: 'In progress',
        statusOptionId: 'status-in-progress',
        iterationId: 'iteration-current',
        iterationTitle: 'Sprint 14',
        updatedAt: '2026-04-28T11:00:00Z',
        labels: [],
        assignees: [],
        milestone: null,
      },
    ],
  },
  nextSprint: {
    label: 'Next Sprint',
    title: 'Sprint 15',
    iterationId: 'iteration-next',
    startDate: '2026-05-12',
    endDate: '2026-05-25',
    itemCount: 1,
    items: [
      {
        projectItemId: 'item-next',
        contentId: 'PR_4',
        title: 'Pull request beta',
        url: 'https://github.com/helsingborg-stad/plugin-beta/pull/4',
        number: 4,
        repository: 'helsingborg-stad/plugin-beta',
        type: 'Pull Request',
        state: 'MERGED',
        status: 'Done',
        statusOptionId: 'status-done',
        iterationId: 'iteration-next',
        iterationTitle: 'Sprint 15',
        updatedAt: '2026-05-12T11:00:00Z',
        labels: [{ id: 'label-release', name: 'release', color: '16a34a', description: 'Release work' }],
        assignees: [],
        milestone: null,
      },
    ],
  },
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
      body: '## Highlights\n\nUse `npm run build:data` before deployment.\n\n- Added rollout support',
      url: 'https://github.com/municipio-se/municipio-deployment/releases/tag/v3.2.1',
      publishedAt: '2026-04-26T08:00:00Z',
      isPrerelease: false,
      isDraft: false,
    },
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

      if (url.includes('/api/auth/session')) {
        return jsonResponse({ authenticated: false, available: true });
      }

      if (url.includes('issues.json')) {
        return jsonResponse(issuesPayload);
      }

      if (url.includes('pull-requests.json')) {
        return jsonResponse(pullRequestsPayload);
      }

      if (url.includes('sprints.json')) {
        return jsonResponse(planningPayload);
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

  it('renders backlog, sprint, repository, and author views from GitHub payloads', async () => {
    mockDashboardFetch();

    render(<App />);

    await screen.findByRole('tab', { name: 'Backlog' });

    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Backlog' }));
    expect(await screen.findByRole('heading', { name: 'Backlog manager' })).toBeInTheDocument();
    expect(screen.getByText('Unplanned GitHub issues')).toBeInTheDocument();
    expect(screen.getByText('Issue alpha')).toBeInTheDocument();

    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Sprints' }));
    expect(await screen.findByRole('heading', { name: 'Sprint board' })).toBeInTheDocument();
    expect(screen.getByText('Sprint 14')).toBeInTheDocument();
    expect(screen.getByText('Issue alpha child')).toBeInTheDocument();

    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Repositories' }));
    expect(await screen.findByRole('heading', { name: 'Compatible plugins' })).toBeInTheDocument();
    expect(screen.getByText('plugin-alpha')).toBeInTheDocument();

    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Authors' }));
    expect(await screen.findByText('monalisa')).toBeInTheDocument();
  });

  it('keeps the quick add UI read-only for public users', async () => {
    mockDashboardFetch();

    render(<App />);

    fireEvent.mouseDown(await screen.findByRole('tab', { name: 'Backlog' }));

    expect(await screen.findByText('Public users can browse the workspace. Sign in with GitHub to create or move work.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create GitHub issue' })).toBeDisabled();
    expect(await screen.findByRole('button', { name: 'Sign in with GitHub to edit' })).toBeInTheDocument();
  });

  it('filters the shared backlog and sprint planning workspace with the global search input', async () => {
    mockDashboardFetch();

    render(<App />);

    await screen.findByRole('tab', { name: 'Backlog' });

    fireEvent.change(screen.getByRole('searchbox', { name: 'Search all tabs' }), { target: { value: 'release' } });
    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Backlog' }));
    expect(await screen.findByText('No unplanned issues match the current filters.')).toBeInTheDocument();

    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Sprints' }));
    expect((await screen.findAllByText('Pull request beta')).length).toBeGreaterThan(0);
    expect(screen.queryByText('Issue alpha child')).not.toBeInTheDocument();
  });

  it('renders the release log tab and paginates page-backed release files', async () => {
    mockDashboardFetch();

    render(<App />);

    await screen.findByRole('tab', { name: 'Release log' });

    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Release log' }));

    expect(await screen.findByRole('heading', { name: 'Release log' })).toBeInTheDocument();
    expect(screen.getByText('Release 3.2.1')).toBeInTheDocument();
    expect(screen.getByText('Highlights')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Next release page' }));

    await waitFor(() => {
      expect(screen.getByText('Release 3.0.1')).toBeInTheDocument();
    });
  });

  it('restores the selected main tab from the URL', async () => {
    mockDashboardFetch();
    window.history.replaceState({}, '', '/?tab=backlog');

    render(<App />);

    expect(await screen.findByRole('heading', { name: 'Backlog manager' })).toBeInTheDocument();
    expect(window.location.search).toBe('?tab=backlog');
  });

  it('maps the legacy contributors tab alias to authors', async () => {
    mockDashboardFetch();
    window.history.replaceState({}, '', '/?tab=contributors');

    render(<App />);

    expect(await screen.findByText('monalisa')).toBeInTheDocument();
    expect(window.location.search).toBe('?tab=authors');
  });
});
