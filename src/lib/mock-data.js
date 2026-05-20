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

const mockAuthSession = {
  loading: false,
  authenticated: false,
  available: false,
  viewer: null,
  error: '',
  notice: 'Mock demo mode uses local GitHub data and disables authenticated editing.',
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function isMockModeEnabled(search = '') {
  return new URLSearchParams(search).get('mock') === '1';
}

export function getMockDashboardData() {
  return {
    payloads: {
      issues: clone(issuesPayload),
      'pull-requests': clone(pullRequestsPayload),
    },
    planningPayload: clone(planningPayload),
    releasePageIndex: clone(releasePageIndexPayload),
    releasePagePayload: clone(releasePageOnePayload),
  };
}

export function getMockReleasePagePayload(pageNumber) {
  const pagesByNumber = {
    1: releasePageOnePayload,
    2: releasePageTwoPayload,
  };

  return clone(pagesByNumber[pageNumber] || releasePageOnePayload);
}

export function getMockAuthSession() {
  return clone(mockAuthSession);
}
