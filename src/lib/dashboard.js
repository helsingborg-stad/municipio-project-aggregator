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

function getUniqueOptions(values) {
  return [...new Set(values.filter(Boolean))].sort((left, right) => left.localeCompare(right));
}

export function getAuthorDirectory(items) {
  const authorsByLogin = new Map();

  items.forEach((item) => {
    const author = item?.author;
    if (!author?.login) {
      return;
    }

    const currentAuthor = authorsByLogin.get(author.login);
    authorsByLogin.set(author.login, {
      login: author.login,
      avatarUrl: author.avatarUrl ?? currentAuthor?.avatarUrl ?? '',
      url: author.url ?? currentAuthor?.url ?? '',
      contributionCount: (currentAuthor?.contributionCount ?? 0) + 1,
    });
  });

  return [...authorsByLogin.values()].sort((left, right) => left.login.localeCompare(right.login));
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

export function filterItems(items, filters) {
  return items.filter((item) => {
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
      return new Intl.RelativeTimeFormat('en', { numeric: 'auto' }).format(value, unit);
    }
  }

  return 'just now';
}

export function formatTimestamp(isoDate) {
  return new Intl.DateTimeFormat('en', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC',
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
