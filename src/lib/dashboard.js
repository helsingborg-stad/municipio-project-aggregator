export function getRepositoryGroups(items) {
  const grouped = items.reduce((result, item) => {
    const collection = result.get(item.repository) ?? [];
    collection.push(item);
    result.set(item.repository, collection);
    return result;
  }, new Map());

  return [...grouped.entries()]
    .map(([repository, repositoryItems]) => ({
      repository,
      items: [...repositoryItems].sort((left, right) => right.createdAt.localeCompare(left.createdAt)),
    }))
    .sort((left, right) => left.repository.localeCompare(right.repository));
}

/**
 * Returns the milestone label used when grouping items.
 *
 * @param {Record<string, any>} item
 * @returns {string}
 */
function getMilestoneLabel(item) {
  return item.milestone?.title || 'No milestone';
}

/**
 * Groups items by milestone and sorts items newest first.
 *
 * @param {Array<Record<string, any>>} items
 * @returns {Array<{milestone: string, items: Array<Record<string, any>>}>}
 */
export function getMilestoneGroups(items) {
  const grouped = items.reduce((result, item) => {
    const milestone = getMilestoneLabel(item);
    const collection = result.get(milestone) ?? [];
    collection.push(item);
    result.set(milestone, collection);
    return result;
  }, new Map());

  return [...grouped.entries()]
    .map(([milestone, milestoneItems]) => ({
      milestone,
      items: [...milestoneItems].sort((left, right) => right.createdAt.localeCompare(left.createdAt)),
    }))
    .sort((left, right) => {
      if (left.milestone === 'No milestone') {
        return 1;
      }

      if (right.milestone === 'No milestone') {
        return -1;
      }

      return left.milestone.localeCompare(right.milestone);
    });
}

export function getRepositoryCatalog(payloads) {
  const repositoriesByName = new Map();
  const itemCountsByRepository = new Map();

  payloads
    .flatMap((payload) => Array.isArray(payload.items) ? payload.items : [])
    .forEach((item) => {
      if (!item?.repository) {
        return;
      }

      itemCountsByRepository.set(item.repository, (itemCountsByRepository.get(item.repository) ?? 0) + 1);
    });

  payloads
    .flatMap((payload) => Array.isArray(payload.repositories) ? payload.repositories : [])
    .forEach((repository) => {
      if (!repository?.fullName) {
        return;
      }

      repositoriesByName.set(repository.fullName, {
        ...repository,
        itemCount: itemCountsByRepository.get(repository.fullName) ?? 0,
      });
    });

  return [...repositoriesByName.values()].sort((left, right) => left.fullName.localeCompare(right.fullName));
}

function normalizeSearchQuery(searchQuery) {
  return typeof searchQuery === 'string' ? searchQuery.trim().toLowerCase() : '';
}

/**
 * Normalizes a value for fuzzy search comparisons.
 *
 * @param {string} value
 * @returns {string}
 */
function normalizeSearchValue(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * Returns whether the query characters appear in order within the value.
 *
 * @param {string} value
 * @param {string} query
 * @returns {boolean}
 */
function isSubsequenceMatch(value, query) {
  let queryIndex = 0;

  for (const character of value) {
    if (character === query[queryIndex]) {
      queryIndex += 1;
    }

    if (queryIndex === query.length) {
      return true;
    }
  }

  return false;
}

/**
 * Returns the Levenshtein distance between two values.
 *
 * @param {string} left
 * @param {string} right
 * @returns {number}
 */
function getLevenshteinDistance(left, right) {
  if (left === right) {
    return 0;
  }

  if (!left.length) {
    return right.length;
  }

  if (!right.length) {
    return left.length;
  }

  const previousRow = Array.from({ length: right.length + 1 }, (_, index) => index);

  for (let leftIndex = 0; leftIndex < left.length; leftIndex += 1) {
    let previousDiagonal = previousRow[0];
    previousRow[0] = leftIndex + 1;

    for (let rightIndex = 0; rightIndex < right.length; rightIndex += 1) {
      const upper = previousRow[rightIndex + 1];
      const substitutionCost = left[leftIndex] === right[rightIndex] ? 0 : 1;

      previousRow[rightIndex + 1] = Math.min(
        previousRow[rightIndex] + 1,
        upper + 1,
        previousDiagonal + substitutionCost,
      );

      previousDiagonal = upper;
    }
  }

  return previousRow[right.length];
}

/**
 * Returns whether a value approximately matches a query.
 *
 * @param {string} value
 * @param {string} query
 * @returns {boolean}
 */
function isFuzzyMatch(value, query) {
  const normalizedValue = normalizeSearchValue(value);
  const normalizedQuery = normalizeSearchValue(query);

  if (!normalizedValue || !normalizedQuery) {
    return false;
  }

  if (normalizedValue.includes(normalizedQuery)) {
    return true;
  }

  const compactValue = normalizedValue.replace(/\s+/g, '');
  const compactQuery = normalizedQuery.replace(/\s+/g, '');

  if (compactValue.includes(compactQuery) || isSubsequenceMatch(compactValue, compactQuery)) {
    return true;
  }

  const queryTerms = normalizedQuery.split(/\s+/).filter(Boolean);
  const valueTerms = normalizedValue.split(/\s+/).filter(Boolean);

  return queryTerms.every((queryTerm) => valueTerms.some((valueTerm) => {
    const distance = getLevenshteinDistance(valueTerm, queryTerm);
    const allowedDistance = queryTerm.length >= 8 ? 2 : 1;

    return distance <= allowedDistance;
  }));
}

function matchesSearchQuery(values, searchQuery) {
  const normalizedSearchQuery = normalizeSearchQuery(searchQuery);

  if (!normalizedSearchQuery) {
    return true;
  }

  return values.some((value) => typeof value === 'string' && isFuzzyMatch(value, normalizedSearchQuery));
}

function getUniqueOptions(values) {
  return [...new Set(values.filter(Boolean))].sort((left, right) => left.localeCompare(right));
}

/**
 * Determines whether a value is a non-empty item URL.
 *
 * @param {unknown} value
 * @returns {boolean}
 */
function isItemUrl(value) {
  return typeof value === 'string' && value !== '';
}

export function getAuthorDirectory(items) {
  const authorsByLogin = new Map();

  items.forEach((item) => {
    const author = item?.author;
    if (!author?.login) {
      return;
    }

    const currentAuthor = authorsByLogin.get(author.login);
    const normalizedCompany = typeof author.company === 'string' ? author.company.trim() : '';

    authorsByLogin.set(author.login, {
      login: author.login,
      avatarUrl: author.avatarUrl ?? currentAuthor?.avatarUrl ?? '',
      company: normalizedCompany || currentAuthor?.company || '',
      url: author.url ?? currentAuthor?.url ?? '',
      score: Number(((currentAuthor?.score ?? 0) + (item.source === 'pull-requests' ? 1 : 0.1)).toFixed(1)),
    });
  });

  return [...authorsByLogin.values()].sort((left, right) => right.score - left.score);
}

export function filterRepositories(repositories, searchQuery) {
  return repositories.filter((repository) => matchesSearchQuery([
    repository.fullName,
    repository.name,
    repository.owner,
    repository.description,
  ], searchQuery));
}

export function filterAuthors(authors, searchQuery) {
  return authors.filter((author) => matchesSearchQuery([
    author.login,
    author.company,
    author.url,
  ], searchQuery));
}

export function getFilterOptions(items) {
  return {
    authors: getUniqueOptions(items.map((item) => item.author?.login ?? '')),
    assignees: getUniqueOptions(items.flatMap((item) => item.assignees?.map((assignee) => assignee.login) ?? [])),
    milestones: getUniqueOptions(items.map((item) => item.milestone?.title ?? '')),
    types: getUniqueOptions(items.map((item) => item.type ?? '')),
  };
}

export function hasSubIssues(item) {
  return Number(item.subIssues?.total ?? 0) > 0;
}

export function hasRelationships(item) {
  const summary = item.relationshipSummary ?? {};
  return [summary.blockedBy, summary.totalBlockedBy, summary.blocking, summary.totalBlocking, summary.linked]
    .some((value) => Number(value ?? 0) > 0);
}

/**
 * Builds a nested tree from visible items and tracked sub-issue URLs.
 *
 * @param {Array<Record<string, any>>} items
 * @returns {Array<Record<string, any> & {children: Array<Record<string, any>>}>}
 */
export function getItemTree(items) {
  const orderByUrl = new Map(
    items
      .filter((item) => isItemUrl(item.url))
      .map((item, index) => [item.url, index]),
  );

  const nodes = items.map((item) => ({ ...item, children: [] }));
  const nodeByUrl = new Map(
    nodes
      .filter((item) => isItemUrl(item.url))
      .map((item) => [item.url, item]),
  );
  const childUrls = new Set();

  nodes.forEach((item) => {
    const subIssueUrls = Array.isArray(item.subIssueUrls) ? item.subIssueUrls.filter(isItemUrl) : [];

    item.children = subIssueUrls
      .map((url) => nodeByUrl.get(url))
      .filter(Boolean)
      .sort((left, right) => (orderByUrl.get(left.url) ?? 0) - (orderByUrl.get(right.url) ?? 0));

    item.children.forEach((child) => {
      childUrls.add(child.url);
    });
  });

  return nodes
    .filter((item) => !item.url || !childUrls.has(item.url))
    .sort((left, right) => (orderByUrl.get(left.url) ?? 0) - (orderByUrl.get(right.url) ?? 0));
}

export function filterItems(items, filters, searchQuery = '') {
  return items.filter((item) => {
    if (!matchesSearchQuery([
      item.title,
      item.repository,
      item.author?.login,
      item.milestone?.title,
      item.type,
      ...(item.assignees?.map((assignee) => assignee.login) ?? []),
      ...(item.relationships?.flatMap((relationship) => [relationship.title, relationship.repository, relationship.event]) ?? []),
    ], searchQuery)) {
      return false;
    }

    if (filters.author && item.author?.login !== filters.author) {
      return false;
    }

    if (filters.assignee === '__unassigned__' && (item.assignees?.length ?? 0) > 0) {
      return false;
    }

    if (filters.assignee && filters.assignee !== '__unassigned__') {
      const assigneeMatches = item.assignees?.some((assignee) => assignee.login === filters.assignee) ?? false;
      if (!assigneeMatches) {
        return false;
      }
    }

    if (filters.milestone === '__none__' && item.milestone) {
      return false;
    }

    if (filters.milestone && filters.milestone !== '__none__' && item.milestone?.title !== filters.milestone) {
      return false;
    }

    if (filters.type === '__none__' && item.type) {
      return false;
    }

    if (filters.type && filters.type !== '__none__' && item.type !== filters.type) {
      return false;
    }

    if (filters.subIssues === 'with' && !hasSubIssues(item)) {
      return false;
    }

    if (filters.subIssues === 'without' && hasSubIssues(item)) {
      return false;
    }

    if (filters.relationships === 'with' && !hasRelationships(item)) {
      return false;
    }

    if (filters.relationships === 'without' && hasRelationships(item)) {
      return false;
    }

    return true;
  });
}

export function formatRelativeTime(isoDate, now = new Date()) {
  const target = new Date(isoDate);
  const diffInSeconds = Math.round((target.getTime() - now.getTime()) / 1000);

  const units = [
    ['year', 60 * 60 * 24 * 365],
    ['month', 60 * 60 * 24 * 30],
    ['week', 60 * 60 * 24 * 7],
    ['day', 60 * 60 * 24],
    ['hour', 60 * 60],
    ['minute', 60],
  ];

  for (const [unit, seconds] of units) {
    const value = Math.trunc(diffInSeconds / seconds);
    if (value !== 0) {
      return new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' }).format(value, unit);
    }
  }

  return 'just now';
}

export function formatTimestamp(isoDate) {
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(isoDate));
}

export function truncateText(value, maxLength = 140) {
  if (typeof value !== 'string') {
    return '';
  }

  const trimmedValue = value.trim();
  if (trimmedValue.length <= maxLength) {
    return trimmedValue;
  }

  return `${trimmedValue.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}
