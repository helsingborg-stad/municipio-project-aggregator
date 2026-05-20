import { matchesSearchQuery } from '@/lib/dashboard';

const planningBucketKeys = ['backlog', 'completedSprint', 'currentSprint', 'nextSprint'];
const sizePoints = {
  xs: 1,
  s: 2,
  m: 3,
  l: 5,
  xl: 8,
};

/**
 * Returns the supported planning bucket keys.
 *
 * @returns {string[]}
 */
export function getPlanningBucketKeys() {
  return [...planningBucketKeys];
}

/**
 * Returns a stable identifier for a planning item.
 *
 * @param {Record<string, any>} item
 * @returns {string}
 */
export function getPlanningItemKey(item) {
  return item.projectItemId || item.id || item.contentId || item.url || `${item.repository}:${item.number || item.title}`;
}

/**
 * Humanizes a GitHub state value.
 *
 * @param {string} state
 * @returns {string}
 */
export function formatPlanningState(state) {
  return {
    OPEN: 'Open',
    CLOSED: 'Closed',
    MERGED: 'Merged',
    DRAFT: 'Draft',
  }[state] || (typeof state === 'string' && state ? state : 'Unknown');
}

/**
 * Parses an estimate value from issue labels.
 *
 * @param {Array<{name?: string}>} labels
 * @returns {number}
 */
export function getEstimatePoints(labels = []) {
  for (const label of labels) {
    const labelName = typeof label?.name === 'string' ? label.name.trim().toLowerCase() : '';

    if (!labelName) {
      continue;
    }

    const explicitMatch = labelName.match(/(?:estimate|points|size)\s*[:=]\s*(\d{1,3})/);
    if (explicitMatch) {
      const estimatePoints = Number(explicitMatch[1]);
      return estimatePoints >= 1 && estimatePoints <= 100 ? estimatePoints : 0;
    }

    const sizeMatch = labelName.match(/(?:size|estimate)\s*[:=]\s*(xs|s|m|l|xl)/);
    if (sizeMatch) {
      return sizePoints[sizeMatch[1]] || 0;
    }
  }

  return 0;
}

/**
 * Merges a planning entry with richer issue or pull request data.
 *
 * @param {Record<string, any>} item
 * @param {Map<string, Record<string, any>>} detailsByUrl
 * @returns {Record<string, any>}
 */
export function mergePlanningItem(item, detailsByUrl) {
  const detail = item.url ? detailsByUrl.get(item.url) : null;
  const labels = item.labels?.length ? item.labels : detail?.labels || [];
  const assignees = item.assignees?.length ? item.assignees : detail?.assignees || [];
  const subIssueUrls = getPlanningSubIssueUrls(item, detail);
  const mergedItem = {
    ...detail,
    ...item,
    labels,
    assignees,
    subIssues: item?.subIssues || detail?.subIssues || { total: 0, completed: 0, percentCompleted: 0 },
    subIssueUrls,
    relationshipSummary: detail?.relationshipSummary || { blockedBy: 0, totalBlockedBy: 0, blocking: 0, totalBlocking: 0, linked: 0 },
    relationships: detail?.relationships || [],
    displayState: formatPlanningState(item.state),
    estimatePoints: getEstimatePoints(labels),
  };

  return mergedItem;
}

/**
 * Builds a URL-keyed detail map from source payloads.
 *
 * @param {Array<Record<string, any> | null | undefined>} payloads
 * @returns {Map<string, Record<string, any>>}
 */
export function createPlanningDetailMap(payloads) {
  return payloads.reduce((result, payload) => {
    const items = Array.isArray(payload?.items) ? payload.items : [];

    items.forEach((item) => {
      if (item?.url) {
        result.set(item.url, item);
      }
    });

    return result;
  }, new Map());
}

/**
 * Returns whether a planning item matches the current search query.
 *
 * @param {Record<string, any>} item
 * @param {string} searchQuery
 * @returns {boolean}
 */
export function matchesPlanningItem(item, searchQuery) {
  return matchesSearchQuery([
    item.title,
    item.repository,
    item.status,
    item.displayState,
    item.type,
    item.milestone?.title,
    ...(item.labels?.map((label) => label.name) || []),
    ...(item.assignees?.map((assignee) => assignee.login) || []),
  ], searchQuery);
}

/**
 * Returns a cloned planning payload with the provided item moved to the target bucket.
 *
 * @param {Record<string, any>} payload
 * @param {Record<string, any>} item
 * @param {string} targetBucketKey
 * @param {number} [targetIndex]
 * @returns {Record<string, any>}
 */
export function movePlanningItem(payload, item, targetBucketKey, targetIndex = 0) {
  const nextPayload = structuredClone(payload);
  const itemKey = getPlanningItemKey(item);
  const normalizedTargetIndex = Number.isInteger(targetIndex) ? targetIndex : 0;
  let movedItem = null;

  getPlanningBucketKeys().forEach((bucketKey) => {
    const bucketItems = Array.isArray(nextPayload?.[bucketKey]?.items) ? nextPayload[bucketKey].items : [];
    const nextItems = bucketItems.filter((entry) => {
      const isMatch = getPlanningItemKey(entry) === itemKey;
      if (isMatch) {
        movedItem = { ...entry, ...item };
      }
      return !isMatch;
    });

    if (nextPayload?.[bucketKey]) {
      nextPayload[bucketKey].items = nextItems;
      nextPayload[bucketKey].itemCount = nextItems.length;
    }
  });

  if (Array.isArray(nextPayload?.sprints)) {
    nextPayload.sprints = nextPayload.sprints.map((bucket) => {
      const bucketItems = Array.isArray(bucket?.items) ? bucket.items : [];
      const nextItems = bucketItems.filter((entry) => {
        const isMatch = getPlanningItemKey(entry) === itemKey;
        if (isMatch) {
          movedItem = { ...entry, ...item };
        }
        return !isMatch;
      });

      return {
        ...bucket,
        items: nextItems,
        itemCount: nextItems.length,
      };
    });
  }

  const targetItems = Array.isArray(nextPayload?.[targetBucketKey]?.items) ? [...nextPayload[targetBucketKey].items] : [];
  const nextPosition = Math.max(0, Math.min(normalizedTargetIndex, targetItems.length));
  targetItems.splice(nextPosition, 0, movedItem || { ...item });

  if (nextPayload?.[targetBucketKey]) {
    nextPayload[targetBucketKey].items = targetItems;
    nextPayload[targetBucketKey].itemCount = targetItems.length;
  }

  const targetIterationId = nextPayload?.[targetBucketKey]?.iterationId || null;
  if (targetIterationId && Array.isArray(nextPayload?.sprints)) {
    nextPayload.sprints = nextPayload.sprints.map((bucket) => (
      bucket.iterationId === targetIterationId
        ? {
          ...bucket,
          items: [...targetItems],
          itemCount: targetItems.length,
        }
        : bucket
    ));
  }

  return nextPayload;
}

/**
 * Moves a sprint item within a specific iteration bucket and updates its status.
 *
 * @param {Record<string, any>} payload
 * @param {Record<string, any>} item
 * @param {{
 *   iterationId: string,
 *   statusName: string,
 *   statusOptionId?: string,
 *   targetIndex?: number,
 *   statusOrder?: string[],
 * }} input
 * @returns {Record<string, any>}
 */
export function movePlanningSprintItem(payload, item, input) {
  const nextPayload = structuredClone(payload);
  const itemKey = getPlanningItemKey(item);
  const normalizedTargetIndex = Number.isInteger(input?.targetIndex) ? input.targetIndex : 0;
  const normalizedStatusName = input?.statusName || item.status || 'No status';
  const normalizedStatusOrder = Array.isArray(input?.statusOrder)
    ? input.statusOrder.filter((status) => typeof status === 'string' && status.trim())
    : [];
  let movedItem = null;

  if (Array.isArray(nextPayload?.sprints)) {
    nextPayload.sprints = nextPayload.sprints.map((bucket) => {
      const bucketItems = Array.isArray(bucket?.items) ? bucket.items : [];
      const nextItems = bucketItems.filter((entry) => {
        const isMatch = getPlanningItemKey(entry) === itemKey;
        if (isMatch) {
          movedItem = {
            ...entry,
            ...item,
            iterationId: input.iterationId,
            iterationTitle: bucket.iterationId === input.iterationId ? bucket.title : entry.iterationTitle,
            status: normalizedStatusName,
            statusOptionId: input?.statusOptionId ?? entry.statusOptionId ?? '',
          };
        }
        return !isMatch;
      });

      return {
        ...bucket,
        items: nextItems,
        itemCount: nextItems.length,
      };
    });
  }

  const targetBucket = Array.isArray(nextPayload?.sprints)
    ? nextPayload.sprints.find((bucket) => bucket.iterationId === input.iterationId)
    : null;

  if (!targetBucket) {
    return nextPayload;
  }

  const statusGroups = (targetBucket.items || []).reduce((result, entry) => {
    const status = entry.status || 'No status';
    const collection = result.get(status) || [];
    collection.push(entry);
    result.set(status, collection);
    return result;
  }, new Map());

  const targetStatusItems = [...(statusGroups.get(normalizedStatusName) || [])];
  const insertAt = Math.max(0, Math.min(normalizedTargetIndex, targetStatusItems.length));
  targetStatusItems.splice(insertAt, 0, {
    ...(movedItem || item),
    iterationId: input.iterationId,
    iterationTitle: targetBucket.title,
    status: normalizedStatusName,
    statusOptionId: input?.statusOptionId ?? movedItem?.statusOptionId ?? item.statusOptionId ?? '',
  });
  statusGroups.set(normalizedStatusName, targetStatusItems);

  const orderedStatuses = [
    ...normalizedStatusOrder,
    ...[...statusGroups.keys()].filter((status) => !normalizedStatusOrder.includes(status)),
  ];

  targetBucket.items = orderedStatuses.flatMap((status) => statusGroups.get(status) || []);
  targetBucket.itemCount = targetBucket.items.length;

  syncSprintAliases(nextPayload);

  return nextPayload;
}

/**
 * Reassigns a planning issue to a parent issue or breaks it out as a top-level item.
 *
 * @param {Record<string, any>} payload
 * @param {Record<string, any>} childItem
 * @param {Record<string, any> | null} parentItem
 * @returns {Record<string, any>}
 */
export function reparentPlanningItem(payload, childItem, parentItem = null) {
  const nextPayload = structuredClone(payload);
  const childKey = getPlanningItemKey(childItem);
  const childUrl = childItem?.url || '';

  if (!childUrl) {
    return nextPayload;
  }

  const updateBucketItems = (items = []) => {
    const nextItems = items.map((entry) => ({ ...entry }));

    nextItems.forEach((entry) => {
      const subIssueUrls = Array.isArray(entry.subIssueUrls) ? entry.subIssueUrls.filter(Boolean) : [];
      const filteredSubIssueUrls = subIssueUrls.filter((url) => url !== childUrl);

      if (filteredSubIssueUrls.length !== subIssueUrls.length) {
        const nextTotal = Math.max(0, Number(entry.subIssues?.total || 0) - 1);
        const nextCompleted = Math.min(Number(entry.subIssues?.completed || 0), nextTotal);
        entry.subIssueUrls = filteredSubIssueUrls;
        entry.subIssues = {
          total: nextTotal,
          completed: nextCompleted,
          percentCompleted: getCompletedPercent(nextTotal, nextCompleted),
        };
      }

      if (getPlanningItemKey(entry) === childKey) {
        entry.parentIssueUrl = parentItem?.url || '';
        entry.parentIssueTitle = parentItem?.title || '';
      }
    });

    if (parentItem?.url) {
      const parentKey = getPlanningItemKey(parentItem);
      const parentEntry = nextItems.find((entry) => getPlanningItemKey(entry) === parentKey);

      if (parentEntry) {
        const subIssueUrls = Array.isArray(parentEntry.subIssueUrls) ? parentEntry.subIssueUrls.filter(Boolean) : [];
        if (!subIssueUrls.includes(childUrl)) {
          parentEntry.subIssueUrls = [...subIssueUrls, childUrl];
          parentEntry.subIssues = {
            total: Number(parentEntry.subIssues?.total || 0) + 1,
            completed: Number(parentEntry.subIssues?.completed || 0),
            percentCompleted: getCompletedPercent(
              Number(parentEntry.subIssues?.total || 0) + 1,
              Number(parentEntry.subIssues?.completed || 0),
            ),
          };
        }
      }
    }

    return nextItems;
  };

  if (nextPayload?.backlog) {
    nextPayload.backlog.items = updateBucketItems(nextPayload.backlog.items);
    nextPayload.backlog.itemCount = nextPayload.backlog.items.length;
  }

  if (Array.isArray(nextPayload?.sprints)) {
    nextPayload.sprints = nextPayload.sprints.map((bucket) => {
      const nextItems = updateBucketItems(bucket.items);

      return {
        ...bucket,
        items: nextItems,
        itemCount: nextItems.length,
      };
    });
  }

  syncSprintAliases(nextPayload);

  return nextPayload;
}

function syncSprintAliases(payload) {
  const sprintBucketsByIterationId = new Map(
    (Array.isArray(payload?.sprints) ? payload.sprints : [])
      .filter((bucket) => bucket?.iterationId)
      .map((bucket) => [bucket.iterationId, bucket]),
  );

  ['currentSprint', 'nextSprint', 'completedSprint'].forEach((bucketKey) => {
    const iterationId = payload?.[bucketKey]?.iterationId;
    if (iterationId && sprintBucketsByIterationId.has(iterationId)) {
      payload[bucketKey] = sprintBucketsByIterationId.get(iterationId);
    }
  });
}

function getPlanningSubIssueUrls(item, detail) {
  if (Array.isArray(item?.subIssueUrls)) {
    return item.subIssueUrls;
  }

  if (Array.isArray(detail?.subIssueUrls)) {
    return detail.subIssueUrls;
  }

  return [];
}

function getCompletedPercent(total, completed) {
  return total > 0 ? Math.round((completed / total) * 100) : 0;
}

/**
 * Adds a new planning item to the requested bucket.
 *
 * @param {Record<string, any>} payload
 * @param {Record<string, any>} item
 * @param {string} bucketKey
 * @returns {Record<string, any>}
 */
export function prependPlanningItem(payload, item, bucketKey) {
  return movePlanningItem(payload, item, bucketKey, 0);
}

/**
 * Builds unplanned backlog items from open issues that are not yet part of the project.
 *
 * @param {Record<string, any> | null} issuesPayload
 * @param {Map<string, Record<string, any>>} planningItemsByUrl
 * @returns {Record<string, any>[]}
 */
export function getUnplannedBacklogItems(issuesPayload, planningItemsByUrl) {
  const issues = Array.isArray(issuesPayload?.items) ? issuesPayload.items : [];

  return issues
    .filter((item) => item?.url && !planningItemsByUrl.has(item.url))
    .map((item) => ({
      ...item,
      projectItemId: '',
      contentId: item.id || '',
      status: 'Backlog',
      statusOptionId: '',
      iterationId: null,
      iterationTitle: null,
      displayState: formatPlanningState(item.state),
      estimatePoints: getEstimatePoints(item.labels || []),
      type: item.type || 'Issue',
      labels: item.labels || [],
    }));
}

/**
 * Returns a bucket summary for UI counters.
 *
 * @param {Record<string, any> | null | undefined} bucket
 * @returns {{itemCount: number, estimatePoints: number, doneCount: number}}
 */
export function getBucketMetrics(bucket) {
  const items = Array.isArray(bucket?.items) ? bucket.items : [];
  return {
    itemCount: items.length,
    estimatePoints: items.reduce((total, item) => total + (item.estimatePoints || 0), 0),
    doneCount: items.filter((item) => typeof item.status === 'string' && item.status.toLowerCase() === 'done').length,
  };
}
