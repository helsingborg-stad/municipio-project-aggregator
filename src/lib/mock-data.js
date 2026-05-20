const repositories = [
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
  {
    owner: 'helsingborg-stad',
    name: 'plugin-gamma',
    fullName: 'helsingborg-stad/plugin-gamma',
    description: 'Experimental plugin gamma',
    url: 'https://github.com/helsingborg-stad/plugin-gamma',
  },
];

const authors = {
  octocat: {
    login: 'octocat',
    avatarUrl: 'https://avatars.example.com/octocat.png',
    company: 'GitHub',
    url: 'https://github.com/octocat',
  },
  hubot: {
    login: 'hubot',
    avatarUrl: 'https://avatars.example.com/hubot.png',
    company: 'Acme',
    url: 'https://github.com/hubot',
  },
  monalisa: {
    login: 'monalisa',
    avatarUrl: 'https://avatars.example.com/monalisa.png',
    company: 'Octo Arts',
    url: 'https://github.com/monalisa',
  },
  codergirl: {
    login: 'codergirl',
    avatarUrl: 'https://avatars.example.com/codergirl.png',
    company: 'Municipio',
    url: 'https://github.com/codergirl',
  },
};

const labels = {
  estimate5: { id: 'label-estimate-5', name: 'estimate:5', color: '7c3aed', description: 'Five points' },
  estimate3: { id: 'label-estimate-3', name: 'estimate:3', color: '2563eb', description: 'Three points' },
  estimate2: { id: 'label-estimate-2', name: 'estimate:2', color: '0f766e', description: 'Two points' },
  release: { id: 'label-release', name: 'release', color: '16a34a', description: 'Release work' },
  ux: { id: 'label-ux', name: 'ux', color: 'db2777', description: 'User experience polish' },
  docs: { id: 'label-docs', name: 'docs', color: '475569', description: 'Documentation work' },
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function createIssue({
  id,
  number,
  title,
  repository,
  createdAt,
  updatedAt,
  description,
  state = 'OPEN',
  labelList = [],
  author = authors.octocat,
  assignees = [],
  milestone = null,
  subIssues = { total: 0, completed: 0, percentCompleted: 0 },
  subIssueUrls = [],
}) {
  return {
    id,
    title,
    body: description,
    description,
    url: `https://github.com/${repository}/issues/${number}`,
    repository,
    createdAt,
    updatedAt: updatedAt || createdAt,
    number,
    state,
    labels: labelList,
    author,
    assignees,
    milestone,
    type: 'Issue',
    subIssues,
    subIssueUrls,
    relationshipSummary: { blockedBy: 0, totalBlockedBy: 0, blocking: 0, totalBlocking: 0, linked: 0 },
    relationships: [],
  };
}

function createPullRequest({
  id,
  number,
  title,
  repository,
  createdAt,
  updatedAt,
  description,
  state = 'OPEN',
  labelList = [],
  author = authors.monalisa,
  assignees = [],
}) {
  return {
    id,
    title,
    body: description,
    description,
    url: `https://github.com/${repository}/pull/${number}`,
    repository,
    createdAt,
    updatedAt: updatedAt || createdAt,
    number,
    state,
    labels: labelList,
    author,
    assignees,
    milestone: null,
    type: 'Pull Request',
    subIssues: { total: 0, completed: 0, percentCompleted: 0 },
    subIssueUrls: [],
    relationshipSummary: { blockedBy: 0, totalBlockedBy: 0, blocking: 0, totalBlocking: 0, linked: 0 },
    relationships: [],
  };
}

const issues = [
  createIssue({
    id: 'I_issue_1',
    number: 1,
    title: 'Issue alpha foundation',
    repository: 'helsingborg-stad/plugin-alpha',
    createdAt: '2026-04-25T09:00:00Z',
    updatedAt: '2026-04-28T11:00:00Z',
    description: 'Set up the shared planning state for backlog and sprint workflows, including status metadata for the UI.',
    labelList: [labels.estimate5],
    milestone: { title: 'Q2', url: 'https://github.com/helsingborg-stad/plugin-alpha/milestone/1', dueOn: '2026-06-01T00:00:00Z' },
    subIssues: { total: 1, completed: 0, percentCompleted: 0 },
    subIssueUrls: ['https://github.com/helsingborg-stad/plugin-alpha/issues/2'],
  }),
  createIssue({
    id: 'I_issue_2',
    number: 2,
    title: 'Issue alpha child',
    repository: 'helsingborg-stad/plugin-alpha',
    createdAt: '2026-04-25T08:00:00Z',
    updatedAt: '2026-04-28T12:00:00Z',
    description: 'Deliver drag and drop for the active sprint so issues can be moved without leaving the planning surface.',
    assignees: [authors.octocat],
    milestone: { title: 'Q2', url: 'https://github.com/helsingborg-stad/plugin-alpha/milestone/1', dueOn: '2026-06-01T00:00:00Z' },
  }),
  createIssue({
    id: 'I_issue_3',
    number: 14,
    title: 'Review release data caching',
    repository: 'helsingborg-stad/plugin-beta',
    createdAt: '2026-04-23T08:00:00Z',
    updatedAt: '2026-04-29T09:30:00Z',
    description: 'Verify the paginated release feed and cache invalidation strategy before the next deployment window.',
    labelList: [labels.estimate3],
    author: authors.hubot,
    assignees: [authors.hubot],
  }),
  createIssue({
    id: 'I_issue_4',
    number: 21,
    title: 'Add sprint templates',
    repository: 'helsingborg-stad/plugin-gamma',
    createdAt: '2026-04-24T11:00:00Z',
    updatedAt: '2026-05-01T08:15:00Z',
    description: 'Prepare reusable issue templates so sprint planning can seed recurring maintenance work faster.',
    labelList: [labels.docs, labels.estimate2],
    author: authors.codergirl,
    assignees: [authors.codergirl],
  }),
  createIssue({
    id: 'I_issue_5',
    number: 22,
    title: 'Improve public filter empty states',
    repository: 'helsingborg-stad/plugin-beta',
    createdAt: '2026-04-24T15:00:00Z',
    updatedAt: '2026-05-03T08:15:00Z',
    description: 'Make it easier for public viewers to understand why a sprint or backlog filter has no matching items.',
    labelList: [labels.ux, labels.estimate2],
    author: authors.monalisa,
  }),
  createIssue({
    id: 'I_issue_6',
    number: 23,
    title: 'Document editor shortcuts',
    repository: 'helsingborg-stad/plugin-gamma',
    createdAt: '2026-04-27T10:30:00Z',
    updatedAt: '2026-05-07T08:15:00Z',
    description: 'Write an operator guide that covers shortcuts and sprint rituals for maintainers working in the planning workspace.',
    labelList: [labels.docs],
    author: authors.codergirl,
  }),
  createIssue({
    id: 'I_issue_7',
    number: 24,
    title: 'Add saved sprint filters',
    repository: 'helsingborg-stad/plugin-alpha',
    createdAt: '2026-04-29T12:45:00Z',
    updatedAt: '2026-05-08T10:10:00Z',
    description: 'Persist commonly used sprint and repository filters so recurring planning views can be restored quickly.',
    labelList: [labels.estimate3],
    author: authors.octocat,
    assignees: [authors.codergirl],
  }),
  createIssue({
    id: 'I_issue_8',
    number: 25,
    title: 'Fix sprint counter regression',
    repository: 'helsingborg-stad/plugin-beta',
    createdAt: '2026-04-18T09:45:00Z',
    updatedAt: '2026-04-22T09:45:00Z',
    description: 'Correct the sprint totals when a completed item is moved back to backlog during review.',
    state: 'CLOSED',
    labelList: [labels.estimate2],
    author: authors.hubot,
  }),
];

const pullRequests = [
  createPullRequest({
    id: 'PR_4',
    number: 4,
    title: 'Release beta sync',
    repository: 'helsingborg-stad/plugin-beta',
    createdAt: '2026-04-25T10:00:00Z',
    updatedAt: '2026-05-05T11:00:00Z',
    description: 'Align the beta plugin release process with the new planning cadence and release log feed.',
    state: 'MERGED',
    labelList: [labels.release],
  }),
  createPullRequest({
    id: 'PR_5',
    number: 5,
    title: 'Planning list polish',
    repository: 'helsingborg-stad/plugin-alpha',
    createdAt: '2026-04-20T10:00:00Z',
    updatedAt: '2026-04-27T09:00:00Z',
    description: 'Ship the accessibility and spacing refinements needed for the new nested sprint list presentation.',
    state: 'MERGED',
    labelList: [labels.ux],
    author: authors.codergirl,
  }),
];

const issuesPayload = {
  source: 'issues',
  sourceScope: 'GitHub',
  generatedAt: '2026-05-08T10:15:00Z',
  count: issues.length,
  topics: ['municipio-se', 'getmunicipio'],
  repositories,
  authors: [authors.octocat, authors.hubot, authors.monalisa, authors.codergirl],
  items: issues,
};

const pullRequestsPayload = {
  source: 'pull-requests',
  sourceScope: 'GitHub',
  generatedAt: '2026-05-08T10:15:00Z',
  count: pullRequests.length,
  topics: ['municipio-se', 'getmunicipio'],
  repositories,
  authors: [authors.monalisa, authors.codergirl],
  items: pullRequests,
};

function toPlanningItem({
  projectItemId,
  sourceItem,
  status,
  statusOptionId,
  iterationId = null,
  iterationTitle = null,
  updatedAt,
}) {
  return {
    projectItemId,
    contentId: sourceItem.id,
    title: sourceItem.title,
    description: sourceItem.description,
    url: sourceItem.url,
    number: sourceItem.number,
    repository: sourceItem.repository,
    type: sourceItem.type,
    state: sourceItem.state,
    status,
    statusOptionId,
    iterationId,
    iterationTitle,
    updatedAt,
    labels: sourceItem.labels,
    assignees: sourceItem.assignees,
    milestone: sourceItem.milestone,
    subIssues: sourceItem.subIssues,
    subIssueUrls: sourceItem.subIssueUrls,
  };
}

const sprintBuckets = [
  {
    label: 'Completed Sprint',
    title: 'Sprint 13',
    iterationId: 'iteration-previous',
    startDate: '2026-04-14',
    endDate: '2026-04-27',
    items: [
      toPlanningItem({ projectItemId: 'item-completed-1', sourceItem: pullRequests[1], status: 'Done', statusOptionId: 'status-done', iterationId: 'iteration-previous', iterationTitle: 'Sprint 13', updatedAt: '2026-04-27T11:00:00Z' }),
      toPlanningItem({ projectItemId: 'item-completed-2', sourceItem: issues[7], status: 'Done', statusOptionId: 'status-done', iterationId: 'iteration-previous', iterationTitle: 'Sprint 13', updatedAt: '2026-04-22T09:45:00Z' }),
    ],
  },
  {
    label: 'Current Sprint',
    title: 'Sprint 14',
    iterationId: 'iteration-current',
    startDate: '2026-04-28',
    endDate: '2026-05-11',
    items: [
      toPlanningItem({ projectItemId: 'item-current-1', sourceItem: issues[1], status: 'In progress', statusOptionId: 'status-in-progress', iterationId: 'iteration-current', iterationTitle: 'Sprint 14', updatedAt: '2026-04-28T11:00:00Z' }),
      toPlanningItem({ projectItemId: 'item-current-2', sourceItem: issues[2], status: 'Review', statusOptionId: 'status-review', iterationId: 'iteration-current', iterationTitle: 'Sprint 14', updatedAt: '2026-04-29T09:30:00Z' }),
    ],
  },
  {
    label: 'Next Sprint',
    title: 'Sprint 15',
    iterationId: 'iteration-next',
    startDate: '2026-05-12',
    endDate: '2026-05-25',
    items: [
      toPlanningItem({ projectItemId: 'item-next-1', sourceItem: issues[3], status: 'Backlog', statusOptionId: 'status-backlog', iterationId: 'iteration-next', iterationTitle: 'Sprint 15', updatedAt: '2026-05-01T08:15:00Z' }),
      toPlanningItem({ projectItemId: 'item-next-2', sourceItem: pullRequests[0], status: 'Done', statusOptionId: 'status-done', iterationId: 'iteration-next', iterationTitle: 'Sprint 15', updatedAt: '2026-05-05T11:00:00Z' }),
    ],
  },
  {
    label: 'Sprint',
    title: 'Sprint 16',
    iterationId: 'iteration-future-1',
    startDate: '2026-05-26',
    endDate: '2026-06-08',
    items: [
      toPlanningItem({ projectItemId: 'item-future-1', sourceItem: issues[5], status: 'Backlog', statusOptionId: 'status-backlog', iterationId: 'iteration-future-1', iterationTitle: 'Sprint 16', updatedAt: '2026-05-07T08:15:00Z' }),
    ],
  },
  {
    label: 'Sprint',
    title: 'Sprint 17',
    iterationId: 'iteration-future-2',
    startDate: '2026-06-09',
    endDate: '2026-06-22',
    items: [],
  },
].map((bucket) => ({ ...bucket, itemCount: bucket.items.length }));

const planningPayload = {
  source: 'sprints',
  sourceScope: 'GitHub',
  generatedAt: '2026-05-08T10:15:00Z',
  count: 9,
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
        { id: 'status-review', name: 'Review', color: 'PURPLE', description: '' },
        { id: 'status-done', name: 'Done', color: 'GREEN', description: '' },
      ],
    },
    iteration: {
      id: 'iteration-field',
      name: 'Iteration',
      currentIterationId: 'iteration-current',
      nextIterationId: 'iteration-next',
      completedIterationId: 'iteration-previous',
      iterations: sprintBuckets.map((bucket) => ({
        id: bucket.iterationId,
        title: bucket.title,
        startDate: bucket.startDate,
        endDate: bucket.endDate,
        duration: 14,
      })),
    },
  },
  backlog: {
    label: 'Backlog',
    title: 'Backlog',
    iterationId: null,
    startDate: null,
    endDate: null,
    itemCount: 2,
    items: [
      toPlanningItem({ projectItemId: 'item-backlog-1', sourceItem: issues[0], status: 'Backlog', statusOptionId: 'status-backlog', updatedAt: '2026-04-28T11:00:00Z' }),
      toPlanningItem({ projectItemId: 'item-backlog-2', sourceItem: issues[6], status: 'Backlog', statusOptionId: 'status-backlog', updatedAt: '2026-05-08T10:10:00Z' }),
    ],
  },
  sprints: sprintBuckets,
  completedSprint: sprintBuckets[0],
  currentSprint: sprintBuckets[1],
  nextSprint: sprintBuckets[2],
};

const releasePageIndexPayload = {
  source: 'releases',
  sourceScope: 'GitHub',
  generatedAt: '2026-05-08T10:15:00Z',
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
  generatedAt: '2026-05-08T10:15:00Z',
  count: 12,
  pageSize: 10,
  pageNumber: 1,
  pageCount: 2,
  repository: releasePageIndexPayload.repository,
  items: [
    {
      title: 'Release 3.2.1',
      version: 'v3.2.1',
      body: '## Highlights\n\nUse `npm run build:data` before deployment.\n\n- Added rollout support\n- Hardened planning demo mode',
      url: 'https://github.com/municipio-se/municipio-deployment/releases/tag/v3.2.1',
      publishedAt: '2026-05-08T08:00:00Z',
      isPrerelease: false,
      isDraft: false,
    },
  ],
};

const releasePageTwoPayload = {
  source: 'releases',
  sourceScope: 'GitHub',
  generatedAt: '2026-05-08T10:15:00Z',
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
