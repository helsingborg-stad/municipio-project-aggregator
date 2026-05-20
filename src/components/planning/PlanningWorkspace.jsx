import { AlertCircle, ArrowUpRight, Building2, CalendarDays, CheckCircle2, CircleDashed, FolderGit2, FolderKanban, GripVertical, LogIn, LogOut, Plus, Sparkles, Target, TimerReset } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  addGitHubSubIssue,
  addItemToProject,
  clearProjectFieldValue,
  createGitHubIssue,
  fetchGitHubSession,
  fetchRepositoryPlanningOptions,
  logoutGitHub,
  removeGitHubSubIssue,
  startGitHubLogin,
  updateProjectItemPosition,
  updateProjectIterationField,
  updateProjectSingleSelectField,
} from '@/lib/github';
import { getMockAuthSession } from '@/lib/mock-data';
import {
  createPlanningDetailMap,
  formatPlanningState,
  getBucketMetrics,
  getPlanningItemKey,
  getUnplannedBacklogItems,
  mergePlanningItem,
  movePlanningItem,
  movePlanningSprintItem,
  reparentPlanningItem,
} from '@/lib/planning';

const sprintListGridClassName = 'grid grid-cols-[minmax(0,2.8fr)_minmax(7rem,1fr)_minmax(10rem,1.1fr)_minmax(8rem,0.8fr)] gap-3';

/**
 * Renders the GitHub-first backlog and sprint planning workspace.
 *
 * @param {{
 *   mode: 'backlog' | 'sprints',
 *   planningPayload: Record<string, any> | null,
 *   issuesPayload: Record<string, any> | null,
 *   pullRequestsPayload: Record<string, any> | null,
 *   repositories: Array<Record<string, any>>,
 *   searchQuery: string,
 *   isMockMode: boolean,
 *   onPlanningPayloadChange: (payload: Record<string, any>) => void,
 * }} props
 * @returns {JSX.Element}
 */
export default function PlanningWorkspace({
  mode,
  planningPayload,
  issuesPayload,
  pullRequestsPayload,
  repositories,
  searchQuery,
  isMockMode,
  onPlanningPayloadChange,
}) {
  const [session, setSession] = useState({ loading: true, authenticated: false, available: false, viewer: null, error: '' });
  const [flashMessage, setFlashMessage] = useState('');
  const [actionError, setActionError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [dragState, setDragState] = useState(null);
  const [sprintViewMode, setSprintViewMode] = useState('list');
  const [repoOptionsByName, setRepoOptionsByName] = useState({});
  const [quickAdd, setQuickAdd] = useState(() => ({
    title: '',
    description: '',
    repository: repositories[0]?.fullName || '',
    sprintTarget: 'backlog',
    assigneeId: '',
    labelIds: [],
    parentIssueId: '',
  }));

  useEffect(() => {
    let isMounted = true;

    if (isMockMode) {
      setSession(getMockAuthSession());
      return () => {};
    }

    fetchGitHubSession()
      .then((nextSession) => {
        if (!isMounted) {
          return;
        }

        setSession({
          loading: false,
          authenticated: Boolean(nextSession.authenticated),
          available: Boolean(nextSession.available),
          viewer: nextSession.viewer || null,
          error: nextSession.error || '',
        });
      })
      .catch((error) => {
        if (!isMounted) {
          return;
        }

        setSession({
          loading: false,
          authenticated: false,
          available: false,
          viewer: null,
          error: error instanceof Error ? error.message : 'Unable to load the GitHub session.',
        });
      });

    return () => {
      isMounted = false;
    };
  }, [isMockMode]);

  useEffect(() => {
    if (!repositories.some((repository) => repository.fullName === quickAdd.repository)) {
      setQuickAdd((currentQuickAdd) => ({
        ...currentQuickAdd,
        repository: repositories[0]?.fullName || '',
      }));
    }
  }, [repositories, quickAdd.repository]);

  useEffect(() => {
    if (!session.authenticated || !quickAdd.repository || repoOptionsByName[quickAdd.repository]) {
      return;
    }

    fetchRepositoryPlanningOptions(quickAdd.repository)
      .then((options) => {
        setRepoOptionsByName((currentValue) => ({
          ...currentValue,
          [quickAdd.repository]: options,
        }));
      })
      .catch(() => {
        setRepoOptionsByName((currentValue) => ({
          ...currentValue,
          [quickAdd.repository]: { repository: null, labels: [], assignees: [] },
        }));
      });
  }, [quickAdd.repository, repoOptionsByName, session.authenticated]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const url = new URL(window.location.href);
    const authStatus = url.searchParams.get('auth');
    const authError = url.searchParams.get('authError');

    if (!authStatus && !authError) {
      return;
    }

    setFlashMessage(authError ? `GitHub sign-in failed: ${authError}.` : 'GitHub editing is connected.');
    url.searchParams.delete('auth');
    url.searchParams.delete('authError');
    window.history.replaceState({}, '', url.toString());
  }, []);

  const detailMap = useMemo(
    () => createPlanningDetailMap([issuesPayload, pullRequestsPayload]),
    [issuesPayload, pullRequestsPayload],
  );
  const currentIterationId = planningPayload?.fields?.iteration?.currentIterationId || null;
  const nextIterationId = planningPayload?.fields?.iteration?.nextIterationId || null;
  const completedIterationId = planningPayload?.fields?.iteration?.completedIterationId || null;
  const backlogStatusOptionId = findStatusOption(planningPayload, ['backlog', 'todo', 'ready']);
  const inProgressStatusOptionId = findStatusOption(planningPayload, ['in progress', 'doing']);

  const backlogBucket = useMemo(() => {
    const items = Array.isArray(planningPayload?.backlog?.items) ? planningPayload.backlog.items : [];
    return {
      ...planningPayload?.backlog,
      items: items
        .map((item) => mergePlanningItem(item, detailMap))
        .filter((item) => matchesWorkspaceSearch(item, searchQuery)),
    };
  }, [detailMap, planningPayload, searchQuery]);

  const sprintBuckets = useMemo(() => {
    const configuredBuckets = Array.isArray(planningPayload?.sprints) && planningPayload.sprints.length > 0
      ? planningPayload.sprints
      : ['completedSprint', 'currentSprint', 'nextSprint']
        .map((bucketKey) => planningPayload?.[bucketKey])
        .filter(Boolean);

    return configuredBuckets.map((bucket) => ({
      ...bucket,
      items: (Array.isArray(bucket?.items) ? bucket.items : [])
        .map((item) => mergePlanningItem(item, detailMap))
        .filter((item) => matchesWorkspaceSearch(item, searchQuery)),
    }));
  }, [detailMap, planningPayload, searchQuery]);

  const planningItemsByUrl = useMemo(() => {
    const rawSprintBuckets = Array.isArray(planningPayload?.sprints) && planningPayload.sprints.length > 0
      ? planningPayload.sprints
      : ['completedSprint', 'currentSprint', 'nextSprint']
        .map((bucketKey) => planningPayload?.[bucketKey])
        .filter(Boolean);

    return new Map(
      [
        ...(Array.isArray(planningPayload?.backlog?.items) ? planningPayload.backlog.items : []),
        ...rawSprintBuckets.flatMap((bucket) => Array.isArray(bucket?.items) ? bucket.items : []),
      ]
        .filter((item) => item?.url)
        .map((item) => [item.url, item]),
    );
  }, [planningPayload]);

  const currentSprintBucket = useMemo(
    () => getSprintBucketByIterationId(sprintBuckets, currentIterationId),
    [currentIterationId, sprintBuckets],
  );
  const nextSprintBucket = useMemo(
    () => getSprintBucketByIterationId(sprintBuckets, nextIterationId),
    [nextIterationId, sprintBuckets],
  );
  const completedSprintBucket = useMemo(
    () => getSprintBucketByIterationId(sprintBuckets, completedIterationId),
    [completedIterationId, sprintBuckets],
  );

  const projectBuckets = useMemo(() => ({
    backlog: backlogBucket,
    currentSprint: currentSprintBucket,
    nextSprint: nextSprintBucket,
    completedSprint: completedSprintBucket,
    unplanned: getUnplannedBacklogItems(issuesPayload, planningItemsByUrl).filter((item) => matchesWorkspaceSearch(item, searchQuery)),
  }), [backlogBucket, completedSprintBucket, currentSprintBucket, issuesPayload, nextSprintBucket, planningItemsByUrl, searchQuery]);

  const projectMetrics = {
    backlog: getBucketMetrics(projectBuckets.backlog),
    currentSprint: getBucketMetrics(projectBuckets.currentSprint),
    nextSprint: getBucketMetrics(projectBuckets.nextSprint),
    completedSprint: getBucketMetrics(projectBuckets.completedSprint),
  };
  const canManagePlanning = session.authenticated || isMockMode;

  const sprintStatusGroups = useMemo(() => getSprintStatusGroups(projectBuckets.currentSprint?.items || []), [projectBuckets.currentSprint]);
  const sprintParentByChildUrl = useMemo(
    () => buildSubIssueParentMap([
      ...(projectBuckets.backlog?.items || []),
      ...sprintBuckets.flatMap((bucket) => bucket.items || []),
    ]),
    [projectBuckets.backlog, sprintBuckets],
  );
  const quickAddOptions = repoOptionsByName[quickAdd.repository] || { repository: null, labels: [], assignees: [] };
  const quickAddSprintOptions = useMemo(
    () => getQuickAddSprintOptions(sprintBuckets, {
      currentIterationId,
      nextIterationId,
      completedIterationId,
    }),
    [completedIterationId, currentIterationId, nextIterationId, sprintBuckets],
  );
  useEffect(() => {
    const availableTargets = new Set(['backlog', ...quickAddSprintOptions.map((option) => option.value)]);

    if (!availableTargets.has(quickAdd.sprintTarget)) {
      setQuickAdd((currentQuickAdd) => ({
        ...currentQuickAdd,
        sprintTarget: 'backlog',
      }));
    }
  }, [quickAdd.sprintTarget, quickAddSprintOptions]);
  const parentIssueOptions = useMemo(() => {
    return [
      ...(projectBuckets.backlog?.items || []),
      ...projectBuckets.unplanned,
      ...sprintBuckets.flatMap((bucket) => bucket.items || []),
    ].filter((item) => item.contentId && item.type === 'Issue');
  }, [projectBuckets, sprintBuckets]);

  async function handleQuickAddSubmit(event) {
    event.preventDefault();
    setActionError('');
    setFlashMessage('');

    if (!session.authenticated) {
      setActionError('Sign in with GitHub to create issues.');
      return;
    }

    if (!quickAdd.title.trim()) {
      setActionError('Enter an issue title.');
      return;
    }

    if (!quickAdd.repository) {
      setActionError('Select a repository.');
      return;
    }

    if (!quickAddOptions.repository?.id) {
      setActionError('Repository metadata is still loading.');
      return;
    }

    setIsSaving(true);

    try {
      const issue = await createGitHubIssue({
        repositoryId: quickAddOptions.repository.id,
        title: quickAdd.title.trim(),
        body: quickAdd.description.trim(),
        labelIds: quickAdd.labelIds,
        assigneeIds: quickAdd.assigneeId ? [quickAdd.assigneeId] : [],
      });

      const projectItemId = await addItemToProject({
        projectId: planningPayload.project.id,
        contentId: issue.id,
      });
      const sprintTargetMetadata = getSprintTargetMetadata({
        sprintTarget: quickAdd.sprintTarget,
        sprintBuckets,
        backlogStatusOptionId,
        inProgressStatusOptionId,
      });

      if (sprintTargetMetadata.iterationId) {
        await updateProjectIterationField({
          projectId: planningPayload.project.id,
          itemId: projectItemId,
          fieldId: planningPayload.fields.iteration.id,
          iterationId: sprintTargetMetadata.iterationId,
        });
      }

      if (sprintTargetMetadata.statusOptionId) {
        await updateProjectSingleSelectField({
          projectId: planningPayload.project.id,
          itemId: projectItemId,
          fieldId: planningPayload.fields.status.id,
          optionId: sprintTargetMetadata.statusOptionId,
        });
      }

      if (quickAdd.parentIssueId) {
        await addGitHubSubIssue({
          parentIssueId: quickAdd.parentIssueId,
          childIssueId: issue.id,
        });
      }

      const nextItem = {
        projectItemId,
        contentId: issue.id,
        id: issue.id,
        title: issue.title,
        url: issue.url,
        number: issue.number,
        repository: issue.repository.nameWithOwner,
        type: 'Issue',
        state: issue.state,
        description: issue.body || '',
        status: sprintTargetMetadata.statusName,
        statusOptionId: sprintTargetMetadata.statusOptionId,
        iterationId: sprintTargetMetadata.iterationId,
        iterationTitle: sprintTargetMetadata.iterationTitle,
        labels: issue.labels?.nodes || [],
        assignees: issue.assignees?.nodes || [],
        updatedAt: new Date().toISOString(),
      };

      const parentIssue = quickAdd.parentIssueId
        ? parentIssueOptions.find((item) => item.contentId === quickAdd.parentIssueId) || null
        : null;
      const insertedPayload = insertPlanningItemIntoPayload(planningPayload, nextItem, quickAdd.sprintTarget, sprintTargetMetadata);
      onPlanningPayloadChange(parentIssue ? reparentPlanningItem(insertedPayload, nextItem, parentIssue) : insertedPayload);
      setQuickAdd({
        title: '',
        description: '',
        repository: quickAdd.repository,
        sprintTarget: 'backlog',
        assigneeId: '',
        labelIds: [],
        parentIssueId: '',
      });
      setFlashMessage('GitHub issue created and added to the planning workspace.');
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Could not create the GitHub issue.');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleItemDrop(item, targetBucketKey, targetIndex = 0) {
    if (!canManagePlanning) {
      setActionError('Sign in with GitHub to update sprint planning.');
      return;
    }

    setActionError('');
    setIsSaving(true);

    const optimisticPayload = movePlanningItem(planningPayload, item, targetBucketKey, targetIndex);
    onPlanningPayloadChange(optimisticPayload);

    try {
      if (!session.authenticated) {
        setFlashMessage('Mock sprint planning updated locally.');
        return;
      }

      let projectItemId = item.projectItemId;

      if (!projectItemId) {
        projectItemId = await addItemToProject({
          projectId: planningPayload.project.id,
          contentId: item.contentId,
        });
      }

      const backlogOptionId = backlogStatusOptionId;
      const iterationFieldId = planningPayload.fields.iteration.id;
      const statusFieldId = planningPayload.fields.status.id;
      const nextPayload = movePlanningItem(planningPayload, { ...item, projectItemId }, targetBucketKey, targetIndex);
      onPlanningPayloadChange(nextPayload);

      if (targetBucketKey === 'backlog') {
        await clearProjectFieldValue({
          projectId: planningPayload.project.id,
          itemId: projectItemId,
          fieldId: iterationFieldId,
        });

        if (backlogOptionId) {
          await updateProjectSingleSelectField({
            projectId: planningPayload.project.id,
            itemId: projectItemId,
            fieldId: statusFieldId,
            optionId: backlogOptionId,
          });
        }
      }

      if (targetBucketKey === 'currentSprint' && currentIterationId) {
        await updateProjectIterationField({
          projectId: planningPayload.project.id,
          itemId: projectItemId,
          fieldId: iterationFieldId,
          iterationId: currentIterationId,
        });

        if (inProgressStatusOptionId) {
          await updateProjectSingleSelectField({
            projectId: planningPayload.project.id,
            itemId: projectItemId,
            fieldId: statusFieldId,
            optionId: inProgressStatusOptionId,
          });
        }
      }

      if (targetBucketKey === 'nextSprint' && nextIterationId) {
        await updateProjectIterationField({
          projectId: planningPayload.project.id,
          itemId: projectItemId,
          fieldId: iterationFieldId,
          iterationId: nextIterationId,
        });

        if (backlogOptionId) {
          await updateProjectSingleSelectField({
            projectId: planningPayload.project.id,
            itemId: projectItemId,
            fieldId: statusFieldId,
            optionId: backlogOptionId,
          });
        }
      }

      const targetItems = optimisticPayload?.[targetBucketKey]?.items || [];
      const previousItem = targetIndex > 0 ? targetItems[targetIndex - 1] || null : null;
      if (projectItemId) {
        await updateProjectItemPosition({
          projectId: planningPayload.project.id,
          itemId: projectItemId,
          afterId: previousItem?.projectItemId || null,
        });
      }

      setFlashMessage('GitHub project planning updated.');
    } catch (error) {
      onPlanningPayloadChange(planningPayload);
      setActionError(error instanceof Error ? error.message : 'Could not update GitHub planning.');
    } finally {
      setIsSaving(false);
      setDragState(null);
    }
  }

  async function handleStatusDrop(item, option) {
    if (!canManagePlanning) {
      setActionError('Sign in with GitHub to move sprint items.');
      return;
    }

    if (session.authenticated && !item.projectItemId) {
      setActionError('Only project items can be moved across sprint columns.');
      return;
    }

    setIsSaving(true);
    setActionError('');

    const optimisticPayload = updatePlanningItemStatus(planningPayload, item, option);
    onPlanningPayloadChange(optimisticPayload);

    try {
      if (!session.authenticated) {
        setFlashMessage(`Moved ${item.title} to ${option.name} in mock mode.`);
        return;
      }

      await updateProjectSingleSelectField({
        projectId: planningPayload.project.id,
        itemId: item.projectItemId,
        fieldId: planningPayload.fields.status.id,
        optionId: option.id,
      });

      setFlashMessage(`Moved ${item.title} to ${option.name}.`);
    } catch (error) {
      onPlanningPayloadChange(planningPayload);
      setActionError(error instanceof Error ? error.message : 'Could not update the sprint column.');
    } finally {
      setIsSaving(false);
      setDragState(null);
    }
  }

  async function handleSprintListDrop(item, sprintBucket, option, targetIndex = 0) {
    if (!canManagePlanning) {
      setActionError('Sign in with GitHub to rearrange sprint tasks.');
      return;
    }

    if (!option) {
      return;
    }

    if (session.authenticated && !item.projectItemId) {
      setActionError('Only project items can be rearranged inside sprint statuses.');
      return;
    }

    const currentParent = sprintParentByChildUrl.get(item.url || '') || null;
    const shouldBreakOutSubtask = Boolean(dragState?.isVisibleSubtask && currentParent);
    const statusOrder = (planningPayload?.fields?.status?.options || []).map((statusOption) => statusOption.name);
    const basePayload = shouldBreakOutSubtask ? reparentPlanningItem(planningPayload, item, null) : planningPayload;
    const optimisticPayload = movePlanningSprintItem(basePayload, item, {
      iterationId: sprintBucket.iterationId,
      statusName: option.name,
      statusOptionId: option.id,
      targetIndex,
      statusOrder,
    });

    setActionError('');
    setFlashMessage('');
    setIsSaving(true);
    onPlanningPayloadChange(optimisticPayload);

    try {
      if (!session.authenticated) {
        setFlashMessage(shouldBreakOutSubtask ? `Mock subtask ${item.title} was broken out as a top-level task.` : `Mock sprint list updated for ${item.title}.`);
        return;
      }

      if (shouldBreakOutSubtask && currentParent?.contentId && item.contentId) {
        await removeGitHubSubIssue({
          parentIssueId: currentParent.contentId,
          childIssueId: item.contentId,
        });
      }

      if (item.statusOptionId !== option.id) {
        await updateProjectSingleSelectField({
          projectId: planningPayload.project.id,
          itemId: item.projectItemId,
          fieldId: planningPayload.fields.status.id,
          optionId: option.id,
        });
      }

      const updatedSprintBucket = optimisticPayload.sprints?.find((bucket) => bucket.iterationId === sprintBucket.iterationId);
      const targetItems = updatedSprintBucket?.items || [];
      const itemIndex = targetItems.findIndex((entry) => getPlanningItemKey(entry) === getPlanningItemKey(item));
      const previousItem = itemIndex > 0 ? targetItems[itemIndex - 1] : null;

      await updateProjectItemPosition({
        projectId: planningPayload.project.id,
        itemId: item.projectItemId,
        afterId: previousItem?.projectItemId || null,
      });

      setFlashMessage(shouldBreakOutSubtask ? `Updated ${item.title} in ${option.name} and moved it out as a top-level task.` : `Updated ${item.title} in ${option.name}.`);
    } catch (error) {
      onPlanningPayloadChange(planningPayload);
      setActionError(error instanceof Error ? error.message : 'Could not rearrange the sprint list.');
    } finally {
      setIsSaving(false);
      setDragState(null);
    }
  }

  async function handleSubtaskAssignment(childItem, parentItem, sprintBucket) {
    if (!canManagePlanning) {
      setActionError('Sign in with GitHub to manage subtasks.');
      return;
    }

    if (childItem.type !== 'Issue' || !childItem.contentId) {
      setActionError('Only GitHub issues can be assigned as subtasks.');
      return;
    }

    const currentParent = sprintParentByChildUrl.get(childItem.url || '') || null;
    const nextParent = parentItem || null;

    if (!nextParent) {
      setActionError('Drop the task on a valid parent row to create a subtask.');
      return;
    }

    if (nextParent.type !== 'Issue' || !nextParent.contentId) {
      setActionError('Only existing GitHub issues can become parent tasks.');
      return;
    }

    if ((currentParent?.contentId || '') === (nextParent?.contentId || '')) {
      return;
    }

    setActionError('');
    setFlashMessage('');
    setIsSaving(true);

    const reparentedPayload = reparentPlanningItem(planningPayload, childItem, nextParent);
    const statusOrder = (planningPayload?.fields?.status?.options || []).map((statusOption) => statusOption.name);
    const targetGroupItems = (sprintBucket.items || []).filter((item) => item.status === nextParent.status);
    const parentIndexInStatus = targetGroupItems.findIndex((item) => getPlanningItemKey(item) === getPlanningItemKey(nextParent));
    const optimisticPayload = movePlanningSprintItem(reparentedPayload, childItem, {
      iterationId: sprintBucket.iterationId,
      statusName: nextParent.status || childItem.status || 'No status',
      statusOptionId: nextParent.statusOptionId || childItem.statusOptionId || '',
      targetIndex: parentIndexInStatus >= 0 ? parentIndexInStatus + 1 : targetGroupItems.length,
      statusOrder,
    });
    onPlanningPayloadChange(optimisticPayload);

    try {
      if (!session.authenticated) {
        setFlashMessage(nextParent ? `Mock subtask linked under ${nextParent.title}.` : `Mock subtask ${childItem.title} was broken out as a top-level task.`);
        return;
      }

      if (currentParent?.contentId) {
        await removeGitHubSubIssue({
          parentIssueId: currentParent.contentId,
          childIssueId: childItem.contentId,
        });
      }

      if (nextParent?.contentId) {
        await addGitHubSubIssue({
          parentIssueId: nextParent.contentId,
          childIssueId: childItem.contentId,
        });
      }

      setFlashMessage(nextParent ? `Linked ${childItem.title} under ${nextParent.title}.` : `Moved ${childItem.title} out as a top-level task.`);
    } catch (error) {
      onPlanningPayloadChange(planningPayload);
      setActionError(error instanceof Error ? error.message : 'Could not update the subtask relationship.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card className="border-white/10 bg-slate-950/50 text-card-foreground shadow-glow backdrop-blur">
        <CardHeader className="gap-4 border-b border-white/10 bg-white/5 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="bg-cyan-300/15 text-cyan-100 ring-1 ring-cyan-200/30">GitHub-first</Badge>
              {isMockMode ? <Badge className="bg-violet-400/15 text-violet-100 ring-1 ring-violet-300/30">Mock demo</Badge> : null}
              <Badge variant="secondary">{planningPayload?.project?.title || 'Project planning'}</Badge>
            </div>
            <div>
              <CardTitle className="text-2xl text-white">{mode === 'backlog' ? 'Backlog manager' : 'Sprint board'}</CardTitle>
              <CardDescription className="mt-2 max-w-3xl text-slate-300">
                {mode === 'backlog'
                  ? 'Aggregate cross-repository GitHub issues into a fast planning surface for backlog prioritization, sprint assignment, and quick issue decomposition.'
                  : 'Use GitHub Project v2 status and iteration fields as the canonical sprint board, with public browsing and authenticated drag/drop updates.'}
              </CardDescription>
            </div>
          </div>
          <div className="flex flex-col items-start gap-3 lg:items-end">
            <AuthStatus session={session} onLogin={startGitHubLogin} onLogout={logoutGitHub} />
            <div className="flex flex-wrap gap-2 text-xs text-slate-400">
              <span>Project: <a className="text-cyan-200 hover:text-cyan-100" href={planningPayload?.project?.url} target="_blank" rel="noreferrer">{planningPayload?.project?.title || 'GitHub Project'}</a></span>
              {planningPayload?.view?.name ? <span>View: {planningPayload.view.name}</span> : null}
              {planningPayload?.currentFilter ? <span>Filter: {planningPayload.currentFilter}</span> : null}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6 p-6">
          {flashMessage ? (
            <StatusBanner icon={CheckCircle2} text={flashMessage} tone="success" />
          ) : null}
          {actionError ? (
            <StatusBanner icon={AlertCircle} text={actionError} tone="error" />
          ) : null}
          <QuickAddCard
            quickAdd={quickAdd}
            repositories={repositories}
            options={quickAddOptions}
            sprintOptions={quickAddSprintOptions}
            parentIssueOptions={parentIssueOptions}
            authenticated={session.authenticated}
            isSaving={isSaving}
            onSubmit={handleQuickAddSubmit}
            onChange={setQuickAdd}
          />
        </CardContent>
      </Card>

      {mode === 'backlog' ? (
        <BacklogView
          buckets={projectBuckets}
          metrics={projectMetrics}
          dragState={dragState}
          isSaving={isSaving}
          onDragStateChange={setDragState}
          onItemDrop={handleItemDrop}
        />
      ) : (
        <SprintView
          payload={planningPayload}
          buckets={projectBuckets}
          sprintBuckets={sprintBuckets}
          metrics={projectMetrics}
          statusGroups={sprintStatusGroups}
          sprintViewMode={sprintViewMode}
          canManagePlanning={canManagePlanning}
          parentByChildUrl={sprintParentByChildUrl}
          dragState={dragState}
          isSaving={isSaving}
          onSprintViewModeChange={setSprintViewMode}
          onDragStateChange={setDragState}
          onStatusDrop={handleStatusDrop}
          onSprintListDrop={handleSprintListDrop}
          onSubtaskAssignment={handleSubtaskAssignment}
          onBucketDrop={handleItemDrop}
        />
      )}
    </div>
  );
}

function AuthStatus({ session, onLogin, onLogout }) {
  if (session.loading) {
    return <Badge variant="secondary">Checking GitHub session…</Badge>;
  }

  if (!session.available) {
    const isMockSession = String(session.notice || '').toLowerCase().includes('mock demo mode');
    return (
      <div className="space-y-1 text-right">
        <Badge variant="secondary">{isMockSession ? 'Mock demo mode' : 'Public browsing only'}</Badge>
        {session.notice || session.error ? <p className="text-xs text-slate-500">{session.notice || session.error}</p> : null}
      </div>
    );
  }

  if (!session.authenticated) {
    return (
      <button
        type="button"
        onClick={onLogin}
        className="inline-flex items-center gap-2 rounded-2xl border border-cyan-300/30 bg-cyan-300/10 px-4 py-2 text-sm text-cyan-100 transition-colors hover:border-cyan-200 hover:bg-cyan-300/20"
      >
        <LogIn className="h-4 w-4" />
        Sign in with GitHub to edit
      </button>
    );
  }

  return (
    <div className="flex items-center gap-3 rounded-2xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-100">
      {session.viewer?.avatarUrl ? <img src={session.viewer.avatarUrl} alt="" className="h-8 w-8 rounded-full" /> : <Sparkles className="h-4 w-4" />}
      <div className="text-left">
        <div className="font-medium text-white">{session.viewer?.login || 'Authenticated'}</div>
        <div className="text-xs text-emerald-100/80">GitHub changes write directly to the canonical project.</div>
      </div>
      <button type="button" onClick={onLogout} className="ml-2 inline-flex items-center gap-2 rounded-xl border border-white/10 px-3 py-1.5 text-xs text-slate-200 transition-colors hover:border-white/30 hover:text-white">
        <LogOut className="h-3.5 w-3.5" />
        Sign out
      </button>
    </div>
  );
}

function QuickAddCard({ quickAdd, repositories, options, sprintOptions, parentIssueOptions, authenticated, isSaving, onSubmit, onChange }) {
  const labelOptions = options.labels || [];
  const assigneeOptions = options.assignees || [];

  return (
    <Card className="border-white/10 bg-slate-950/70 text-card-foreground">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg text-white">
          <Plus className="h-4 w-4 text-cyan-200" />
          Quick add
        </CardTitle>
        <CardDescription className="text-slate-400">
          Create a real GitHub issue, add it to the GitHub Project backlog or sprint, and optionally attach it as a native sub-issue.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="grid gap-4 lg:grid-cols-[1.6fr_1fr_1fr_1fr]" onSubmit={onSubmit}>
          <label className="space-y-2 text-sm text-slate-300 lg:col-span-4">
            <span>Title</span>
            <input
              type="text"
              value={quickAdd.title}
              onChange={(event) => onChange((currentValue) => ({ ...currentValue, title: event.target.value }))}
              placeholder="Describe the next GitHub issue"
              disabled={!authenticated || isSaving}
              className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none transition-colors focus:border-cyan-300/40 disabled:cursor-not-allowed disabled:opacity-60"
            />
          </label>
          <label className="space-y-2 text-sm text-slate-300 lg:col-span-4">
            <span>Description</span>
            <textarea
              value={quickAdd.description}
              onChange={(event) => onChange((currentValue) => ({ ...currentValue, description: event.target.value }))}
              placeholder="Add the GitHub issue description"
              rows={5}
              disabled={!authenticated || isSaving}
              className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none transition-colors focus:border-cyan-300/40 disabled:cursor-not-allowed disabled:opacity-60"
            />
          </label>
          <SelectField label="Repository" value={quickAdd.repository} disabled={!authenticated || isSaving} onChange={(value) => onChange((currentValue) => ({ ...currentValue, repository: value, labelIds: [], assigneeId: '' }))}>
            {repositories.map((repository) => (
              <option key={repository.fullName} value={repository.fullName}>{repository.fullName}</option>
            ))}
          </SelectField>
          <SelectField label="Sprint" value={quickAdd.sprintTarget} disabled={!authenticated || isSaving} onChange={(value) => onChange((currentValue) => ({ ...currentValue, sprintTarget: value }))}>
            <option value="backlog">Backlog</option>
            {sprintOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </SelectField>
          <SelectField label="Assignee" value={quickAdd.assigneeId} disabled={!authenticated || isSaving} onChange={(value) => onChange((currentValue) => ({ ...currentValue, assigneeId: value }))}>
            <option value="">Unassigned</option>
            {assigneeOptions.map((assignee) => (
              <option key={assignee.id} value={assignee.id}>{assignee.login}</option>
            ))}
          </SelectField>
          <SelectField label="Parent issue" value={quickAdd.parentIssueId} disabled={!authenticated || isSaving} onChange={(value) => onChange((currentValue) => ({ ...currentValue, parentIssueId: value }))}>
            <option value="">No parent</option>
            {parentIssueOptions.map((item) => (
              <option key={getPlanningItemKey(item)} value={item.contentId}>{item.repository} #{item.number} — {item.title}</option>
            ))}
          </SelectField>
          <fieldset className="space-y-2 text-sm text-slate-300 lg:col-span-4">
            <legend>Labels</legend>
            <div className="flex flex-wrap gap-2">
              {labelOptions.length === 0 ? (
                <span className="text-xs text-slate-500">No labels loaded for this repository yet.</span>
              ) : labelOptions.map((label) => {
                const isChecked = quickAdd.labelIds.includes(label.id);
                return (
                  <label key={label.id} className={`inline-flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-xs transition-colors ${isChecked ? 'border-cyan-300/40 bg-cyan-300/10 text-cyan-100' : 'border-white/10 bg-white/5 text-slate-300 hover:border-white/20'}`}>
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={isChecked}
                      disabled={!authenticated || isSaving}
                      onChange={() => onChange((currentValue) => ({
                        ...currentValue,
                        labelIds: isChecked
                          ? currentValue.labelIds.filter((labelId) => labelId !== label.id)
                          : [...currentValue.labelIds, label.id],
                      }))}
                    />
                    <span>{label.name}</span>
                  </label>
                );
              })}
            </div>
          </fieldset>
          <div className="flex flex-wrap items-center justify-between gap-3 lg:col-span-4">
            <p className="text-xs text-slate-500">
              {authenticated
                ? 'The issue is created in GitHub first, then linked into the project backlog or sprint plan.'
                : 'Public users can browse the workspace. Sign in with GitHub to create or move work.'}
            </p>
            <button
              type="submit"
              disabled={!authenticated || isSaving}
              className="inline-flex items-center gap-2 rounded-2xl border border-cyan-300/30 bg-cyan-300/10 px-4 py-2 text-sm text-cyan-100 transition-colors hover:border-cyan-200 hover:bg-cyan-300/20 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Plus className="h-4 w-4" />
              {isSaving ? 'Saving…' : 'Create GitHub issue'}
            </button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function BacklogView({ buckets, metrics, dragState, isSaving, onDragStateChange, onItemDrop }) {
  return (
    <div className="space-y-6">
      <MetricsGrid metrics={metrics} />
      <div className="grid gap-6 xl:grid-cols-[1.2fr_1fr_1fr]">
        <DropSection title="Project backlog" subtitle="Prioritized project items ready for sprint assignment." items={buckets.backlog?.items || []} badgeText={`${metrics.backlog.itemCount} items`} onDropItem={(item, targetIndex) => onItemDrop(item, 'backlog', targetIndex)} dragState={dragState} isSaving={isSaving} onDragStateChange={onDragStateChange} />
        <DropSection title="Current sprint queue" subtitle="Drop backlog work here to commit it into the active GitHub iteration." items={buckets.currentSprint?.items || []} badgeText={`${metrics.currentSprint.itemCount} items`} onDropItem={(item, targetIndex) => onItemDrop(item, 'currentSprint', targetIndex)} dragState={dragState} isSaving={isSaving} onDragStateChange={onDragStateChange} />
        <DropSection title="Next sprint queue" subtitle="Prepare the next iteration without leaving the GitHub-native planning model." items={buckets.nextSprint?.items || []} badgeText={`${metrics.nextSprint.itemCount} items`} onDropItem={(item, targetIndex) => onItemDrop(item, 'nextSprint', targetIndex)} dragState={dragState} isSaving={isSaving} onDragStateChange={onDragStateChange} />
      </div>
      <Card className="border-white/10 bg-slate-950/50 text-card-foreground">
        <CardHeader>
          <CardTitle className="text-lg text-white">Unplanned GitHub issues</CardTitle>
          <CardDescription className="text-slate-400">Open GitHub issues discovered across tracked repositories that are not yet linked to the project board.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {buckets.unplanned.length === 0 ? <EmptyState text="No unplanned issues match the current filters." /> : buckets.unplanned.map((item) => (
            <PlanningItemCard key={getPlanningItemKey(item)} item={item} dragState={dragState} onDragStateChange={onDragStateChange} isSaving={isSaving} />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function SprintView({
  payload,
  buckets,
  sprintBuckets,
  metrics,
  statusGroups,
  sprintViewMode,
  canManagePlanning,
  parentByChildUrl,
  dragState,
  isSaving,
  onSprintViewModeChange,
  onDragStateChange,
  onStatusDrop,
  onSprintListDrop,
  onSubtaskAssignment,
  onBucketDrop,
}) {
  const completedPercent = metrics.currentSprint.itemCount > 0
    ? Math.round((metrics.currentSprint.doneCount / metrics.currentSprint.itemCount) * 100)
    : 0;
  const statusOptions = payload?.fields?.status?.options || [];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        <MetricCard title="Backlog" icon={FolderKanban} value={`${metrics.backlog.itemCount} items`} description="Ready for prioritization" />
        <MetricCard title="Current sprint" icon={CalendarDays} value={`${metrics.currentSprint.itemCount} items`} description={`${completedPercent}% done`} />
        <MetricCard title="Next sprint" icon={Target} value={`${metrics.nextSprint.itemCount} items`} description="Prepared for upcoming work" />
        <MetricCard title="Completed sprint" icon={TimerReset} value={`${metrics.completedSprint.itemCount} items`} description={`${metrics.completedSprint.doneCount} done`} />
      </div>
      <Card className="border-white/10 bg-slate-950/50 text-card-foreground shadow-glow backdrop-blur">
        <CardHeader className="gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <CardTitle className="text-xl text-white">Sprint workspace</CardTitle>
            <CardDescription className="text-slate-400">
              {sprintViewMode === 'list'
                ? 'Browse every configured sprint as nested status lists, then switch to cards when you want a denser overview.'
                : 'Use the card view for sprint boards and quick scanning across current, upcoming, and completed iterations.'}
            </CardDescription>
          </div>
          <div className="inline-flex rounded-2xl border border-white/10 bg-white/5 p-1">
            <button
              type="button"
              onClick={() => onSprintViewModeChange('list')}
              className={`rounded-xl px-3 py-2 text-sm transition-colors ${sprintViewMode === 'list' ? 'bg-cyan-300/15 text-cyan-100' : 'text-slate-300 hover:text-white'}`}
            >
              List view
            </button>
            <button
              type="button"
              onClick={() => onSprintViewModeChange('card')}
              className={`rounded-xl px-3 py-2 text-sm transition-colors ${sprintViewMode === 'card' ? 'bg-cyan-300/15 text-cyan-100' : 'text-slate-300 hover:text-white'}`}
            >
              Card view
            </button>
          </div>
        </CardHeader>
        <CardContent>
          {sprintViewMode === 'list' ? (
            <SprintNestedListView
              sprintBuckets={sprintBuckets}
              statusOptions={statusOptions}
              canManagePlanning={canManagePlanning}
              parentByChildUrl={parentByChildUrl}
              dragState={dragState}
              isSaving={isSaving}
              onDragStateChange={onDragStateChange}
              onSprintListDrop={onSprintListDrop}
              onSubtaskAssignment={onSubtaskAssignment}
            />
          ) : (
            <SprintCardView
              payload={payload}
              buckets={buckets}
              sprintBuckets={sprintBuckets}
              statusGroups={statusGroups}
              statusOptions={statusOptions}
              dragState={dragState}
              isSaving={isSaving}
              onDragStateChange={onDragStateChange}
              onStatusDrop={onStatusDrop}
              onBucketDrop={onBucketDrop}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function SprintNestedListView({
  sprintBuckets,
  statusOptions,
  canManagePlanning,
  parentByChildUrl,
  dragState,
  isSaving,
  onDragStateChange,
  onSprintListDrop,
  onSubtaskAssignment,
}) {
  if (sprintBuckets.length === 0) {
    return <EmptyState text="No sprint iterations are available yet." />;
  }

  return (
    <div className="space-y-4">
      {sprintBuckets.map((bucket) => {
        const statusGroups = getSprintStatusGroups(bucket.items || [], statusOptions, true);
        const itemOrderByKey = new Map((bucket.items || []).map((item, index) => [getPlanningItemKey(item), index]));

        return (
          <Card key={bucket.iterationId || bucket.title} className="border-white/10 bg-slate-900/50 text-card-foreground">
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <CardTitle className="flex flex-wrap items-center gap-2 text-lg text-white">
                    <span>{bucket.title}</span>
                    <SprintRoleBadge bucket={bucket} />
                  </CardTitle>
                  <CardDescription className="mt-1 text-slate-400">
                    {formatSprintRange(bucket.startDate, bucket.endDate)}
                  </CardDescription>
                </div>
                <Badge variant="secondary">{bucket.itemCount || 0} items</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {statusGroups.length === 0 ? (
                <EmptyState text="No items are planned for this sprint." />
              ) : statusGroups.map((group) => {
                const option = resolveStatusOption(group.status, statusOptions);
                const treeItems = getNestedSprintItems(group.items || []);

                return (
                  <div
                    key={`${bucket.iterationId || bucket.title}-${group.status}`}
                    className="overflow-hidden rounded-2xl border border-white/10 bg-slate-950/60"
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={() => dragState?.item && option ? onSprintListDrop(dragState.item, bucket, option, group.items.length) : null}
                    aria-label={`Drop in status ${group.status} for ${bucket.title}`}
                  >
                    <div className="flex items-center justify-between gap-3 border-b border-white/[0.06] px-4 py-2.5">
                      <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium ${getStatusChipClasses(option, group.status)}`}>
                        <CircleDashed className="h-3.5 w-3.5" />
                        {group.status}
                      </span>
                      <span className="text-xs text-slate-400">{group.items.length} items</span>
                    </div>
                    <div className={`${sprintListGridClassName} border-b border-white/[0.06] px-4 py-3 text-xs uppercase tracking-[0.14em] text-slate-500`}>
                      <span>Name</span>
                      <span>Assignee</span>
                      <span>Repository</span>
                      <span>Milestone</span>
                    </div>
                    {dragState?.isVisibleSubtask ? (
                      <div className="border-b border-white/[0.06] px-4 py-2 text-xs text-cyan-100/90">
                        Drop in the list to break this subtask out as a top-level task.
                      </div>
                    ) : null}
                    {treeItems.length === 0 ? (
                      <div className="px-4 py-4 text-sm text-slate-500">Drop items here to populate this status.</div>
                    ) : (
                      <ul>
                        {treeItems.map((item) => (
                          <SprintNestedListRow
                            key={getPlanningItemKey(item)}
                            item={item}
                            depth={0}
                            bucket={bucket}
                            group={group}
                            itemOrderByKey={itemOrderByKey}
                            parentByChildUrl={parentByChildUrl}
                            canManagePlanning={canManagePlanning}
                            dragState={dragState}
                            isSaving={isSaving}
                            onDragStateChange={onDragStateChange}
                            onSprintListDrop={onSprintListDrop}
                            onSubtaskAssignment={onSubtaskAssignment}
                          />
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function SprintNestedListRow({
  item,
  depth = 0,
  bucket,
  group,
  itemOrderByKey,
  parentByChildUrl,
  canManagePlanning,
  dragState,
  isSaving,
  onDragStateChange,
  onSprintListDrop,
  onSubtaskAssignment,
}) {
  const repositoryNameParts = getRepositoryNameParts(item.repository);
  const itemState = item.displayState || formatPlanningState(item.state);
  const currentParent = parentByChildUrl.get(item.url || '') || null;
  const descendantUrls = collectPlanningDescendantUrls(item);
  const childItems = (item.children || []).filter((childItem) => childItem.status === group.status);
  const targetRowIndex = itemOrderByKey.get(getPlanningItemKey(item)) || 0;
  const isDragging = dragState?.key === getPlanningItemKey(item);
  const assigneeNames = item.assignees?.map((assignee) => assignee.login).filter(Boolean) || [];
  const draggedItem = dragState?.item || null;
  const canAcceptSubtaskDrop = draggedItem
    ? canDropPlanningItemAsSubtask(draggedItem, item, currentParent, descendantUrls)
    : false;
  const rowClassName = depth > 0
    ? 'border-l-2 border-violet-300/40 bg-violet-300/[0.06]'
    : '';
  const currentParentTitle = currentParent?.title || 'parent task';

  return (
    <>
      <li
        className={`group border-t border-white/[0.06] transition-colors hover:bg-white/[0.03] first:border-t-0 ${isDragging ? 'opacity-50' : ''} ${rowClassName}`}
        draggable={canManagePlanning && !isSaving}
        onDragStart={() => onDragStateChange({ key: getPlanningItemKey(item), item, isVisibleSubtask: depth > 0 })}
        onDragEnd={() => onDragStateChange(null)}
        onDragOver={(event) => event.preventDefault()}
        onDrop={() => dragState?.item && group.option ? onSprintListDrop(dragState.item, bucket, group.option, targetRowIndex) : null}
        aria-label={`Drag ${item.title}`}
      >
        <div className={`${sprintListGridClassName} px-4 py-3`}>
          <div className="min-w-0">
            <div className="flex min-w-0 items-start gap-3">
              <div className={`flex items-center gap-2 pt-0.5 ${depth > 0 ? 'text-violet-200' : 'text-slate-500'}`}>
                <span aria-label="Drag handle">
                  <GripVertical className="h-3.5 w-3.5" />
                </span>
                <div className={`h-3.5 w-3.5 rounded-full border-2 ${depth > 0 ? 'border-violet-300/80 bg-violet-300/20' : 'border-slate-500/70'}`} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 flex-wrap items-center gap-2 text-[10px] uppercase tracking-[0.12em] text-slate-500">
                  <span>{item.type}</span>
                  {item.number ? <span>#{item.number}</span> : null}
                  <Badge variant="secondary" className="shrink-0 px-2 py-0 text-[10px]">{itemState}</Badge>
                  {depth > 0 ? <span className="rounded-full border border-violet-300/30 bg-violet-300/10 px-2 py-0.5 text-[10px] text-violet-100" role="status" aria-label="This is a subtask">Subtask</span> : null}
                  {item.subIssues?.total ? <span>{item.subIssues.total} sub</span> : null}
                </div>
                <div className="mt-1 flex min-w-0 items-center gap-2">
                  <span className="truncate text-sm font-medium text-slate-100 transition-colors group-hover:text-white">{item.title}</span>
                  {item.url ? (
                    <a href={item.url} target="_blank" rel="noreferrer" className="shrink-0 text-slate-500 transition-colors hover:text-cyan-300">
                      <ArrowUpRight className="h-3.5 w-3.5" />
                    </a>
                  ) : null}
                </div>
                {depth > 0 ? <span className="mt-1 block text-xs text-violet-200/90" aria-label={`Subtask of ${currentParentTitle}`}>Subtask of {currentParentTitle}</span> : null}
                {canAcceptSubtaskDrop ? (
                  <div
                    className="mt-2 inline-flex items-center rounded-full border border-dashed border-cyan-300/40 bg-cyan-300/10 px-2.5 py-1 text-[11px] text-cyan-100"
                    onDragOver={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                    }}
                    onDrop={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      onSubtaskAssignment(dragState.item, item, bucket);
                    }}
                    aria-label={`Drop ${draggedItem?.title || 'task'} under ${item.title} as subtask`}
                  >
                    Drop here to make subtask
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          <div className="min-w-0 py-1 text-xs text-slate-300">
            {assigneeNames.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {assigneeNames.map((assigneeName) => (
                  <span key={assigneeName} className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-cyan-300/15 px-2 text-[11px] font-medium text-cyan-100">
                    {getInitials(assigneeName)}
                  </span>
                ))}
              </div>
            ) : (
              <span className="text-slate-600">Unassigned</span>
            )}
          </div>

          <div className="min-w-0 py-1 text-xs leading-4 text-slate-400">
            {repositoryNameParts ? (
              <>
                <div className="flex items-start gap-1.5">
                  <Building2 className="mt-0.5 h-3 w-3 shrink-0 text-slate-600" />
                  <span className="truncate">{repositoryNameParts.owner}</span>
                </div>
                {repositoryNameParts.name ? (
                  <div className="mt-1 flex items-start gap-1.5 text-slate-300">
                    <FolderGit2 className="mt-0.5 h-3 w-3 shrink-0 text-slate-500" />
                    <span className="truncate">{repositoryNameParts.name}</span>
                  </div>
                ) : null}
              </>
            ) : (
              <span className="text-slate-700">—</span>
            )}
          </div>

          <div className="py-1 text-xs text-slate-400">
            {item.milestone?.title || <span className="text-slate-700">—</span>}
          </div>
        </div>
      </li>
      {childItems.map((childItem) => (
        <SprintNestedListRow
          key={getPlanningItemKey(childItem)}
          item={childItem}
          depth={depth + 1}
          bucket={bucket}
          group={group}
          itemOrderByKey={itemOrderByKey}
          parentByChildUrl={parentByChildUrl}
          canManagePlanning={canManagePlanning}
          dragState={dragState}
          isSaving={isSaving}
          onDragStateChange={onDragStateChange}
          onSprintListDrop={onSprintListDrop}
          onSubtaskAssignment={onSubtaskAssignment}
        />
      ))}
    </>
  );
}

function SprintCardView({ payload, buckets, sprintBuckets, statusGroups, statusOptions, dragState, isSaving, onDragStateChange, onStatusDrop, onBucketDrop }) {
  return (
    <div className="space-y-6">
      <Card className="border-white/10 bg-slate-950/60 text-card-foreground">
        <CardHeader>
          <CardTitle className="text-xl text-white">{payload?.currentSprint?.title || 'Current sprint'}</CardTitle>
          <CardDescription className="text-slate-400">Drag cards across status columns to update the GitHub Project status field directly.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 xl:grid-cols-5">
            {statusGroups.map((group) => {
              const option = resolveStatusOption(group.status, statusOptions);
              return (
                <div
                  key={group.status}
                  className="rounded-3xl border border-white/10 bg-slate-900/70 p-4"
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={() => dragState?.item && option ? onStatusDrop(dragState.item, option) : null}
                >
                  <div className="mb-4 flex items-center justify-between gap-2">
                    <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs uppercase tracking-[0.2em] ${getStatusChipClasses(option, group.status)}`}>
                      <CircleDashed className="h-3.5 w-3.5" />
                      {group.status}
                    </span>
                    <Badge variant="secondary">{group.items.length}</Badge>
                  </div>
                  <div className="space-y-3">
                    {group.items.map((item) => (
                      <PlanningItemCard key={getPlanningItemKey(item)} item={item} dragState={dragState} onDragStateChange={onDragStateChange} isSaving={isSaving} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
      <div className="grid gap-6 xl:grid-cols-2">
        <DropSection title={payload?.nextSprint?.title || 'Next sprint'} subtitle="Move unfinished work here to prepare the next iteration." items={buckets.nextSprint?.items || []} badgeText={`${buckets.nextSprint?.itemCount || 0} items`} onDropItem={(item, targetIndex) => onBucketDrop(item, 'nextSprint', targetIndex)} dragState={dragState} isSaving={isSaving} onDragStateChange={onDragStateChange} />
        <Card className="border-white/10 bg-slate-950/50 text-card-foreground">
          <CardHeader>
            <CardTitle className="text-lg text-white">{payload?.completedSprint?.title || 'Completed sprint'}</CardTitle>
            <CardDescription className="text-slate-400">Recently completed work, still sourced from the GitHub Project iteration history.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {(buckets.completedSprint?.items || []).length === 0 ? <EmptyState text="No completed sprint items are available." /> : (buckets.completedSprint?.items || []).map((item) => (
              <PlanningItemCard key={getPlanningItemKey(item)} item={item} dragState={dragState} onDragStateChange={onDragStateChange} isSaving={isSaving} />
            ))}
          </CardContent>
        </Card>
      </div>
      {sprintBuckets.length > 0 ? (
        <Card className="border-white/10 bg-slate-950/50 text-card-foreground">
          <CardHeader>
            <CardTitle className="text-lg text-white">All sprint cards</CardTitle>
            <CardDescription className="text-slate-400">A dense card overview of every configured sprint.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 lg:grid-cols-2">
            {sprintBuckets.map((bucket) => (
              <div key={bucket.iterationId || bucket.title} className="rounded-3xl border border-white/10 bg-slate-900/60 p-4">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="text-base font-semibold text-white">{bucket.title}</h4>
                      <SprintRoleBadge bucket={bucket} />
                    </div>
                    <p className="text-xs text-slate-400">{formatSprintRange(bucket.startDate, bucket.endDate)}</p>
                  </div>
                  <Badge variant="secondary">{bucket.itemCount || 0}</Badge>
                </div>
                <div className="space-y-3">
                  {(bucket.items || []).length === 0 ? <EmptyState text="No sprint items are planned." /> : (bucket.items || []).map((item) => (
                    <PlanningItemCard key={getPlanningItemKey(item)} item={item} dragState={dragState} onDragStateChange={onDragStateChange} isSaving={isSaving} />
                  ))}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function SprintRoleBadge({ bucket }) {
  const className = bucket?.label === 'Current Sprint'
    ? 'border-cyan-300/30 bg-cyan-300/10 text-cyan-100'
    : bucket?.label === 'Next Sprint'
      ? 'border-violet-300/30 bg-violet-300/10 text-violet-100'
      : bucket?.label === 'Completed Sprint'
        ? 'border-emerald-300/30 bg-emerald-300/10 text-emerald-100'
        : 'border-white/10 bg-white/5 text-slate-300';

  return <span className={`rounded-full border px-2.5 py-1 text-[11px] uppercase tracking-[0.2em] ${className}`}>{bucket?.label || 'Sprint'}</span>;
}

function DropSection({ title, subtitle, items, badgeText, dragState, isSaving, onDragStateChange, onDropItem }) {
  return (
    <Card className="border-white/10 bg-slate-950/50 text-card-foreground">
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle className="text-lg text-white">{title}</CardTitle>
            <CardDescription className="mt-1 text-slate-400">{subtitle}</CardDescription>
          </div>
          <Badge variant="secondary">{badgeText}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3" onDragOver={(event) => event.preventDefault()} onDrop={() => dragState?.item ? onDropItem(dragState.item, items.length) : null}>
        {items.length === 0 ? <EmptyState text="Drop a GitHub item here." /> : items.map((item, index) => (
          <div key={getPlanningItemKey(item)} onDragOver={(event) => event.preventDefault()} onDrop={() => dragState?.item ? onDropItem(dragState.item, index) : null}>
            <PlanningItemCard item={item} dragState={dragState} onDragStateChange={onDragStateChange} isSaving={isSaving} />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function PlanningItemCard({ item, dragState, onDragStateChange, isSaving = false }) {
  const childItems = item.subIssueUrls?.filter(Boolean) || [];
  const isDragging = dragState?.key === getPlanningItemKey(item);

  return (
    <div
      draggable={!isSaving}
      onDragStart={() => onDragStateChange({ key: getPlanningItemKey(item), item })}
      onDragEnd={() => onDragStateChange(null)}
      className={`rounded-3xl border border-white/10 bg-slate-900/80 p-4 transition-opacity ${isDragging ? 'opacity-50' : ''}`}
    >
      <div className="flex items-start gap-3">
        <GripVertical className="mt-0.5 h-4 w-4 shrink-0 text-slate-600" />
        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-slate-500">
            <span>{item.type}</span>
            {item.number ? <span>#{item.number}</span> : null}
            <span className={`inline-flex items-center rounded-full border px-2.5 py-1 normal-case tracking-normal ${getStatusChipClasses(null, item.status)}`}>
              {item.status || 'No status'}
            </span>
            <Badge variant="secondary">{item.displayState || formatPlanningState(item.state)}</Badge>
          </div>
          <div className="space-y-1">
            <h4 className="text-base font-semibold text-white">{item.title}</h4>
            {item.repository ? <p className="text-sm text-slate-400">{item.repository}</p> : null}
            {item.description ? <p className="text-sm text-slate-400">{truncateDescription(item.description, 180)}</p> : null}
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
            {item.assignees?.length ? <span>{item.assignees.map((assignee) => assignee.login).join(', ')}</span> : <span>Unassigned</span>}
            {item.milestone?.title ? <span>Milestone: {item.milestone.title}</span> : null}
            {item.subIssues?.total ? <span>{item.subIssues.total} sub-issues</span> : null}
          </div>
          {item.labels?.length ? (
            <div className="flex flex-wrap gap-2">
              {item.labels.map((label) => (
                <span key={label.id || label.name} className="rounded-full border border-white/10 px-2.5 py-1 text-[11px] text-slate-300">{label.name}</span>
              ))}
            </div>
          ) : null}
          {childItems.length > 0 ? (
            <details className="rounded-2xl border border-white/10 bg-white/5 p-3 text-sm text-slate-300">
              <summary className="cursor-pointer text-slate-200">View linked sub-issues</summary>
              <ul className="mt-3 space-y-2 text-xs text-slate-400">
                {childItems.map((childUrl) => (
                  <li key={childUrl} className="truncate">
                    <a href={childUrl} target="_blank" rel="noreferrer" className="hover:text-cyan-200">{childUrl}</a>
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
        </div>
        {item.url ? <a href={item.url} target="_blank" rel="noreferrer" className="text-slate-500 transition-colors hover:text-cyan-200"><ArrowUpRight className="h-4 w-4" /></a> : null}
      </div>
    </div>
  );
}

function getRepositoryNameParts(repository) {
  if (typeof repository !== 'string') {
    return null;
  }

  const fullName = repository.trim();

  if (!fullName) {
    return null;
  }

  if (!fullName.includes('/')) {
    return {
      owner: fullName,
      name: '',
      fullName,
    };
  }

  const [owner, ...nameParts] = fullName.split('/');
  const name = nameParts.join('/');

  return {
    owner,
    name,
    fullName,
  };
}

function MetricsGrid({ metrics }) {
  return (
    <div className="grid gap-4 md:grid-cols-4">
      <MetricCard title="Backlog" icon={FolderKanban} value={`${metrics.backlog.itemCount} items`} description="Ready for prioritization" />
      <MetricCard title="Current sprint" icon={CalendarDays} value={`${metrics.currentSprint.itemCount} items`} description={`${metrics.currentSprint.doneCount} done`} />
      <MetricCard title="Next sprint" icon={Target} value={`${metrics.nextSprint.itemCount} items`} description="Prepared for upcoming work" />
      <MetricCard title="Completed" icon={CheckCircle2} value={`${metrics.completedSprint.itemCount} items`} description={`${metrics.completedSprint.doneCount} done`} />
    </div>
  );
}

function MetricCard({ title, icon: Icon, value, description }) {
  return (
    <Card className="border-white/10 bg-slate-950/50 text-card-foreground">
      <CardHeader>
        <CardDescription className="flex items-center gap-2 text-slate-400">
          <Icon className="h-4 w-4 text-cyan-200" />
          {title}
        </CardDescription>
        <CardTitle className="text-white">{value}</CardTitle>
      </CardHeader>
      <CardContent className="text-sm text-slate-400">{description}</CardContent>
    </Card>
  );
}

function SelectField({ label, value, onChange, disabled, children }) {
  return (
    <label className="space-y-2 text-sm text-slate-300">
      <span>{label}</span>
      <select value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)} className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none transition-colors focus:border-cyan-300/40 disabled:cursor-not-allowed disabled:opacity-60">
        {children}
      </select>
    </label>
  );
}

function StatusBanner({ icon: Icon, text, tone }) {
  const className = tone === 'success'
    ? 'border-emerald-400/20 bg-emerald-500/10 text-emerald-100'
    : 'border-rose-400/20 bg-rose-500/10 text-rose-100';

  return (
    <div className={`flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm ${className}`}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{text}</span>
    </div>
  );
}

function EmptyState({ text }) {
  return (
    <div className="rounded-2xl border border-dashed border-white/15 bg-white/5 p-6 text-center text-sm text-slate-400">
      {text}
    </div>
  );
}

function findStatusOption(payload, names) {
  const options = payload?.fields?.status?.options || [];
  return options.find((option) => names.includes(option.name.toLowerCase()))?.id || '';
}

function getSprintTargetMetadata({
  sprintTarget,
  sprintBuckets,
  backlogStatusOptionId,
  inProgressStatusOptionId,
}) {
  if (sprintTarget === 'backlog') {
    return {
      iterationId: null,
      iterationTitle: null,
      statusName: 'Backlog',
      statusOptionId: backlogStatusOptionId || '',
    };
  }

  const iterationId = sprintTarget.replace(/^iteration:/, '');
  const sprintBucket = sprintBuckets.find((bucket) => bucket.iterationId === iterationId);
  const isCurrentSprint = sprintBucket?.label === 'Current Sprint';

  if (sprintBucket) {
    return {
      iterationId: sprintBucket.iterationId,
      iterationTitle: sprintBucket.title,
      statusName: isCurrentSprint && inProgressStatusOptionId ? 'In progress' : 'Backlog',
      statusOptionId: isCurrentSprint && inProgressStatusOptionId ? inProgressStatusOptionId : backlogStatusOptionId || '',
    };
  }

  return {
    iterationId: null,
    iterationTitle: null,
    statusName: 'Backlog',
    statusOptionId: backlogStatusOptionId || '',
  };
}

function insertPlanningItemIntoPayload(payload, item, sprintTarget, sprintTargetMetadata) {
  const nextPayload = structuredClone(payload);
  const itemKey = getPlanningItemKey(item);
  const removeFromBucket = (bucket) => {
    if (!bucket || !Array.isArray(bucket.items)) {
      return bucket;
    }

    bucket.items = bucket.items.filter((entry) => getPlanningItemKey(entry) !== itemKey);
    bucket.itemCount = bucket.items.length;
    return bucket;
  };

  removeFromBucket(nextPayload.backlog);
  removeFromBucket(nextPayload.currentSprint);
  removeFromBucket(nextPayload.nextSprint);
  removeFromBucket(nextPayload.completedSprint);

  if (Array.isArray(nextPayload.sprints)) {
    nextPayload.sprints = nextPayload.sprints.map((bucket) => removeFromBucket(bucket));
  }

  if (sprintTarget === 'backlog') {
    nextPayload.backlog.items = [item, ...(nextPayload.backlog?.items || [])];
    nextPayload.backlog.itemCount = nextPayload.backlog.items.length;
    return nextPayload;
  }

  const targetIterationId = sprintTargetMetadata.iterationId;
  if (!targetIterationId) {
    return nextPayload;
  }

  const targetBucket = Array.isArray(nextPayload.sprints)
    ? nextPayload.sprints.find((bucket) => bucket.iterationId === targetIterationId)
    : null;

  if (targetBucket) {
    targetBucket.items = [item, ...(targetBucket.items || [])];
    targetBucket.itemCount = targetBucket.items.length;
  }

  if (nextPayload.currentSprint?.iterationId === targetIterationId) {
    nextPayload.currentSprint = targetBucket || nextPayload.currentSprint;
  } else if (nextPayload.nextSprint?.iterationId === targetIterationId) {
    nextPayload.nextSprint = targetBucket || nextPayload.nextSprint;
  } else if (nextPayload.completedSprint?.iterationId === targetIterationId) {
    nextPayload.completedSprint = targetBucket || nextPayload.completedSprint;
  }

  return nextPayload;
}

function matchesWorkspaceSearch(item, searchQuery) {
  if (!searchQuery) {
    return true;
  }

  return [
    item.title,
    item.repository,
    item.status,
    item.displayState,
    ...(item.labels?.map((label) => label.name) || []),
    ...(item.assignees?.map((assignee) => assignee.login) || []),
  ].some((value) => typeof value === 'string' && value.toLowerCase().includes(searchQuery.trim().toLowerCase()));
}

function getNestedSprintItems(items) {
  const itemsByUrl = new Map(
    items
      .filter((item) => item?.url)
      .map((item) => [item.url, { ...item, children: [] }]),
  );
  const childUrls = new Set();

  itemsByUrl.forEach((item) => {
    const childItems = (Array.isArray(item.subIssueUrls) ? item.subIssueUrls : [])
      .map((childUrl) => itemsByUrl.get(childUrl))
      .filter(Boolean);

    item.children = childItems;
    childItems.forEach((childItem) => {
      childUrls.add(childItem.url);
    });
  });

  return items
    .map((item) => (item?.url ? itemsByUrl.get(item.url) : { ...item, children: [] }))
    .filter((item) => !item?.url || !childUrls.has(item.url));
}

function buildSubIssueParentMap(items) {
  const itemsByUrl = new Map(items.filter((item) => item?.url).map((item) => [item.url, item]));

  return items.reduce((result, item) => {
    const childUrls = Array.isArray(item?.subIssueUrls) ? item.subIssueUrls.filter(Boolean) : [];
    childUrls.forEach((childUrl) => {
      if (itemsByUrl.has(childUrl)) {
        result.set(childUrl, item);
      }
    });
    return result;
  }, new Map());
}

function collectPlanningDescendantUrls(item) {
  const descendantUrls = new Set();
  const visited = new Set();
  const stack = [...(item.children || [])];

  while (stack.length > 0) {
    const childItem = stack.pop();

    if (!childItem || (childItem.url && visited.has(childItem.url))) {
      continue;
    }

    if (childItem.url) {
      visited.add(childItem.url);
      descendantUrls.add(childItem.url);
    }

    (childItem.children || []).forEach((nestedChild) => {
      stack.push(nestedChild);
    });
  }

  return descendantUrls;
}

function canDropPlanningItemAsSubtask(draggedItem, candidateParent, currentParent, descendantUrls) {
  if (!draggedItem || !candidateParent) {
    return false;
  }

  if (draggedItem.type !== 'Issue' || !draggedItem.contentId) {
    return false;
  }

  if (candidateParent.type !== 'Issue' || !candidateParent.contentId) {
    return false;
  }

  if (getPlanningItemKey(draggedItem) === getPlanningItemKey(candidateParent)) {
    return false;
  }

  if (descendantUrls.has(draggedItem.url)) {
    return false;
  }

  if ((currentParent?.contentId || '') === candidateParent.contentId) {
    return false;
  }

  return true;
}

function getInitials(value) {
  if (typeof value !== 'string' || !value.trim()) {
    return '–';
  }

  return value
    .split(/[\s._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('');
}

function getSprintStatusGroups(items, statusOptions = [], includeEmpty = false) {
  const groups = items.reduce((result, item) => {
    const status = item.status || 'No status';
    const collection = result.get(status) || [];
    collection.push(item);
    result.set(status, collection);
    return result;
  }, new Map());

  const orderedStatuses = [
    ...statusOptions.map((option) => option.name),
    ...[...groups.keys()].filter((status) => !statusOptions.some((option) => option.name === status)),
  ];

  return orderedStatuses
    .filter((status) => includeEmpty || (groups.get(status) || []).length > 0)
    .map((status) => ({
      status,
      option: resolveStatusOption(status, statusOptions),
      items: groups.get(status) || [],
    }));
}

function getQuickAddSprintOptions(sprintBuckets, metadata) {
  return sprintBuckets.map((bucket) => {
    let suffix = '';

    if (bucket.iterationId === metadata.currentIterationId) {
      suffix = ' (current)';
    } else if (bucket.iterationId === metadata.nextIterationId) {
      suffix = ' (next)';
    } else if (bucket.iterationId === metadata.completedIterationId) {
      suffix = ' (completed)';
    }

    return {
      value: `iteration:${bucket.iterationId}`,
      label: `${bucket.title}${suffix}`,
    };
  });
}

function getSprintBucketByIterationId(sprintBuckets, iterationId) {
  return sprintBuckets.find((bucket) => bucket.iterationId === iterationId) || {
    label: '',
    title: '',
    iterationId,
    startDate: null,
    endDate: null,
    itemCount: 0,
    items: [],
  };
}

function resolveStatusOption(status, statusOptions) {
  return statusOptions.find((option) => option.name.toLowerCase() === String(status || '').toLowerCase()) || null;
}

function getStatusChipClasses(option, status) {
  const color = String(option?.color || '').toUpperCase();
  const normalizedStatus = String(status || '').toLowerCase();

  if (color === 'GREEN' || normalizedStatus === 'done') {
    return 'border-emerald-300/30 bg-emerald-300/10 text-emerald-100';
  }

  if (color === 'BLUE' || normalizedStatus.includes('progress')) {
    return 'border-sky-300/30 bg-sky-300/10 text-sky-100';
  }

  if (color === 'RED' || normalizedStatus.includes('blocked')) {
    return 'border-rose-300/30 bg-rose-300/10 text-rose-100';
  }

  if (color === 'PURPLE' || normalizedStatus.includes('review')) {
    return 'border-violet-300/30 bg-violet-300/10 text-violet-100';
  }

  if (color === 'YELLOW' || color === 'ORANGE' || normalizedStatus === 'backlog' || normalizedStatus === 'todo') {
    return 'border-amber-300/30 bg-amber-300/10 text-amber-100';
  }

  return 'border-white/10 bg-white/5 text-slate-200';
}

function truncateDescription(text, maxLength = 180) {
  if (typeof text !== 'string') {
    return '';
  }

  const normalizedText = text.replace(/\s+/g, ' ').trim();
  if (normalizedText.length <= maxLength) {
    return normalizedText;
  }

  return `${normalizedText.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

function formatSprintRange(startDate, endDate) {
  if (!startDate && !endDate) {
    return 'No sprint dates available.';
  }

  if (startDate && endDate) {
    return `${startDate} → ${endDate}`;
  }

  return startDate || endDate;
}

function updatePlanningItemStatus(payload, item, option) {
  const nextPayload = structuredClone(payload);

  nextPayload.currentSprint.items = (nextPayload.currentSprint?.items || []).map((entry) => {
    if (getPlanningItemKey(entry) !== getPlanningItemKey(item)) {
      return entry;
    }

    return {
      ...entry,
      status: option.name,
      statusOptionId: option.id,
    };
  });

  if (Array.isArray(nextPayload.sprints)) {
    nextPayload.sprints = nextPayload.sprints.map((bucket) => ({
      ...bucket,
      items: (bucket.items || []).map((entry) => {
        if (getPlanningItemKey(entry) !== getPlanningItemKey(item)) {
          return entry;
        }

        return {
          ...entry,
          status: option.name,
          statusOptionId: option.id,
        };
      }),
    }));
  }

  return nextPayload;
}
