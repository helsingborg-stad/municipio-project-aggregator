import { describe, expect, it } from 'vitest';

import {
  getEstimatePoints,
  getUnplannedBacklogItems,
  movePlanningItem,
} from './planning';

describe('planning helpers', () => {
  it('parses estimate points from numeric and size labels', () => {
    expect(getEstimatePoints([{ name: 'estimate:5' }])).toBe(5);
    expect(getEstimatePoints([{ name: 'size:m' }])).toBe(3);
    expect(getEstimatePoints([{ name: 'priority:high' }])).toBe(0);
  });

  it('moves an item between planning buckets while keeping counts updated', () => {
    const payload = {
      backlog: { itemCount: 1, items: [{ projectItemId: 'backlog-1', title: 'Backlog item' }] },
      currentSprint: { itemCount: 1, iterationId: 'iteration-current', items: [{ projectItemId: 'current-1', title: 'Current item' }] },
      nextSprint: { itemCount: 0, iterationId: 'iteration-next', items: [] },
      completedSprint: { itemCount: 0, items: [] },
      sprints: [
        { iterationId: 'iteration-current', itemCount: 1, items: [{ projectItemId: 'current-1', title: 'Current item' }] },
        { iterationId: 'iteration-next', itemCount: 0, items: [] },
      ],
    };

    const nextPayload = movePlanningItem(payload, payload.backlog.items[0], 'currentSprint', 1);

    expect(nextPayload.backlog.items).toHaveLength(0);
    expect(nextPayload.backlog.itemCount).toBe(0);
    expect(nextPayload.currentSprint.items.map((item) => item.title)).toEqual(['Current item', 'Backlog item']);
    expect(nextPayload.currentSprint.itemCount).toBe(2);
    expect(nextPayload.sprints[0].items.map((item) => item.title)).toEqual(['Current item', 'Backlog item']);
  });

  it('builds unplanned backlog items from issues outside the project board', () => {
    const issuesPayload = {
      items: [
        { id: 'I_1', title: 'Unplanned issue', url: 'https://github.com/org/repo/issues/1', repository: 'org/repo', state: 'OPEN', labels: [{ name: 'estimate:3' }] },
        { id: 'I_2', title: 'Tracked issue', url: 'https://github.com/org/repo/issues/2', repository: 'org/repo', state: 'OPEN', labels: [] },
      ],
    };

    const planningItemsByUrl = new Map([['https://github.com/org/repo/issues/2', { projectItemId: 'item-2' }]]);

    const items = getUnplannedBacklogItems(issuesPayload, planningItemsByUrl);

    expect(items).toHaveLength(1);
    expect(items[0].title).toBe('Unplanned issue');
    expect(items[0].estimatePoints).toBe(3);
    expect(items[0].status).toBe('Backlog');
  });
});
