import { describe, expect, it } from 'vitest';

import {
  getEstimatePoints,
  getUnplannedBacklogItems,
  movePlanningSprintItem,
  movePlanningItem,
  reparentPlanningItem,
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

  it('moves a sprint item between status groups and inserts it at the requested position', () => {
    const payload = {
      backlog: { itemCount: 0, items: [] },
      currentSprint: {
        itemCount: 3,
        iterationId: 'iteration-current',
        items: [
          { projectItemId: 'item-1', title: 'Backlog first', status: 'Backlog', statusOptionId: 'status-backlog' },
          { projectItemId: 'item-2', title: 'In progress first', status: 'In progress', statusOptionId: 'status-progress' },
          { projectItemId: 'item-3', title: 'Backlog second', status: 'Backlog', statusOptionId: 'status-backlog' },
        ],
      },
      nextSprint: { itemCount: 0, iterationId: 'iteration-next', items: [] },
      completedSprint: { itemCount: 0, items: [] },
      sprints: [
        {
          iterationId: 'iteration-current',
          title: 'Sprint 14',
          itemCount: 3,
          items: [
            { projectItemId: 'item-1', title: 'Backlog first', status: 'Backlog', statusOptionId: 'status-backlog' },
            { projectItemId: 'item-2', title: 'In progress first', status: 'In progress', statusOptionId: 'status-progress' },
            { projectItemId: 'item-3', title: 'Backlog second', status: 'Backlog', statusOptionId: 'status-backlog' },
          ],
        },
      ],
    };

    const nextPayload = movePlanningSprintItem(payload, payload.currentSprint.items[1], {
      iterationId: 'iteration-current',
      statusName: 'Backlog',
      statusOptionId: 'status-backlog',
      targetIndex: 1,
      statusOrder: ['Backlog', 'In progress', 'Review', 'Done'],
    });

    expect(nextPayload.currentSprint.items.map((item) => `${item.title}:${item.status}`)).toEqual([
      'Backlog first:Backlog',
      'In progress first:Backlog',
      'Backlog second:Backlog',
    ]);
  });

  it('reparents a planning issue under a new parent and can break it back out', () => {
    const payload = {
      backlog: { itemCount: 0, items: [] },
      currentSprint: {
        itemCount: 2,
        iterationId: 'iteration-current',
        items: [
          {
            projectItemId: 'item-parent',
            title: 'Parent issue',
            url: 'https://github.com/org/repo/issues/1',
            subIssues: { total: 0, completed: 0, percentCompleted: 0 },
            subIssueUrls: [],
          },
          {
            projectItemId: 'item-child',
            title: 'Child issue',
            url: 'https://github.com/org/repo/issues/2',
            subIssues: { total: 0, completed: 0, percentCompleted: 0 },
            subIssueUrls: [],
          },
        ],
      },
      nextSprint: { itemCount: 0, iterationId: 'iteration-next', items: [] },
      completedSprint: { itemCount: 0, items: [] },
      sprints: [
        {
          iterationId: 'iteration-current',
          title: 'Sprint 14',
          itemCount: 2,
          items: [
            {
              projectItemId: 'item-parent',
              title: 'Parent issue',
              url: 'https://github.com/org/repo/issues/1',
              subIssues: { total: 0, completed: 0, percentCompleted: 0 },
              subIssueUrls: [],
            },
            {
              projectItemId: 'item-child',
              title: 'Child issue',
              url: 'https://github.com/org/repo/issues/2',
              subIssues: { total: 0, completed: 0, percentCompleted: 0 },
              subIssueUrls: [],
            },
          ],
        },
      ],
    };

    const parentItem = payload.currentSprint.items[0];
    const childItem = payload.currentSprint.items[1];

    const nestedPayload = reparentPlanningItem(payload, childItem, parentItem);
    expect(nestedPayload.currentSprint.items[0].subIssueUrls).toEqual(['https://github.com/org/repo/issues/2']);
    expect(nestedPayload.currentSprint.items[0].subIssues.total).toBe(1);
    expect(nestedPayload.currentSprint.items[1].parentIssueUrl).toBe('https://github.com/org/repo/issues/1');

    const brokenOutPayload = reparentPlanningItem(nestedPayload, nestedPayload.currentSprint.items[1], null);
    expect(brokenOutPayload.currentSprint.items[0].subIssueUrls).toEqual([]);
    expect(brokenOutPayload.currentSprint.items[0].subIssues.total).toBe(0);
    expect(brokenOutPayload.currentSprint.items[1].parentIssueUrl).toBe('');
  });
});
