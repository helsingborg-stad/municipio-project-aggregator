import { describe, expect, it } from 'vitest';

import { formatRelativeTime, getRepositoryGroups } from './dashboard';

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