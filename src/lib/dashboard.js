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