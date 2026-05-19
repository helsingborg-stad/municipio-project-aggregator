import { AlertCircle, ArrowUpRight, CalendarDays, CheckCircle2, CircleDashed, FolderKanban, GripVertical, LogIn, LogOut, Plus, Sparkles, Target, TimerReset } from 'lucide-react';
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
  startGitHubLogin,
  updateProjectItemPosition,
  updateProjectIterationField,
  updateProjectSingleSelectField,
} from '@/lib/github';
import {
  createPlanningDetailMap,
  formatPlanningState,
  getBucketMetrics,
  getPlanningItemKey,
  getUnplannedBacklogItems,
  mergePlanningItem,
  movePlanningItem,
  prependPlanningItem,
} from '@/lib/planning';

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
  onPlanningPayloadChange,
}) {
  const [session, setSession] = useState({ loading: true, authenticated: false, available: false, viewer: null, error: '' });
  const [flashMessage, setFlashMessage] = useState('');
  const [actionError, setActionError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [dragState, setDragState] = useState(null);
  const [repoOptionsByName, setRepoOptionsByName] = useState({});
  const [quickAdd, setQuickAdd] = useState(() => ({
    title: '',
    repository: repositories[0]?.fullName || '',
    sprintTarget: 'backlog',
    assigneeId: '',
    labelIds: [],
    parentIssueId: '',
  }));

  useEffect(() => {
    let isMounted = true;

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
  }, []);

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

  const projectBuckets = useMemo(() => {
    const mergeBucket = (bucketKey) => {
      const items = Array.isArray(planningPayload?.[bucketKey]?.items) ? planningPayload[bucketKey].items : [];
      return {
        ...planningPayload?.[bucketKey],
        items: items
          .map((item) => mergePlanningItem(item, detailMap))
          .filter((item) => matchesWorkspaceSearch(item, searchQuery)),
      };
    };

    const planningItemsByUrl = new Map(
      ['backlog', 'currentSprint', 'nextSprint', 'completedSprint']
        .flatMap((bucketKey) => Array.isArray(planningPayload?.[bucketKey]?.items) ? planningPayload[bucketKey].items : [])
        .filter((item) => item?.url)
        .map((item) => [item.url, item]),
    );

    return {
      backlog: mergeBucket('backlog'),
      currentSprint: mergeBucket('currentSprint'),
      nextSprint: mergeBucket('nextSprint'),
      completedSprint: mergeBucket('completedSprint'),
      unplanned: getUnplannedBacklogItems(issuesPayload, planningItemsByUrl).filter((item) => matchesWorkspaceSearch(item, searchQuery)),
    };
  }, [detailMap, issuesPayload, planningPayload, searchQuery]);

  const projectMetrics = {
    backlog: getBucketMetrics(projectBuckets.backlog),
    currentSprint: getBucketMetrics(projectBuckets.currentSprint),
    nextSprint: getBucketMetrics(projectBuckets.nextSprint),
    completedSprint: getBucketMetrics(projectBuckets.completedSprint),
  };

  const sprintStatusGroups = useMemo(() => getSprintStatusGroups(projectBuckets.currentSprint?.items || []), [projectBuckets.currentSprint]);
  const quickAddOptions = repoOptionsByName[quickAdd.repository] || { repository: null, labels: [], assignees: [] };
  const parentIssueOptions = useMemo(() => {
    return [
      ...(projectBuckets.backlog?.items || []),
      ...projectBuckets.unplanned,
      ...(projectBuckets.currentSprint?.items || []),
      ...(projectBuckets.nextSprint?.items || []),
    ].filter((item) => item.contentId && item.type === 'Issue');
  }, [projectBuckets]);

  const currentIterationId = planningPayload?.fields?.iteration?.currentIterationId || null;
  const nextIterationId = planningPayload?.fields?.iteration?.nextIterationId || null;
  const backlogStatusOptionId = findStatusOption(planningPayload, ['backlog', 'todo', 'ready']);
  const inProgressStatusOptionId = findStatusOption(planningPayload, ['in progress', 'doing']);

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
        labelIds: quickAdd.labelIds,
        assigneeIds: quickAdd.assigneeId ? [quickAdd.assigneeId] : [],
      });

      const projectItemId = await addItemToProject({
        projectId: planningPayload.project.id,
        contentId: issue.id,
      });
      const sprintTargetMetadata = getSprintTargetMetadata({
        sprintTarget: quickAdd.sprintTarget,
        currentIterationId,
        nextIterationId,
        currentSprintTitle: planningPayload.currentSprint?.title || null,
        nextSprintTitle: planningPayload.nextSprint?.title || null,
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
        status: sprintTargetMetadata.statusName,
        statusOptionId: sprintTargetMetadata.statusOptionId,
        iterationId: sprintTargetMetadata.iterationId,
        iterationTitle: sprintTargetMetadata.iterationTitle,
        labels: issue.labels?.nodes || [],
        assignees: issue.assignees?.nodes || [],
        updatedAt: new Date().toISOString(),
      };

      onPlanningPayloadChange(prependPlanningItem(planningPayload, nextItem, quickAdd.sprintTarget));
      setQuickAdd({
        title: '',
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
    if (!session.authenticated) {
      setActionError('Sign in with GitHub to update sprint planning.');
      return;
    }

    setActionError('');
    setIsSaving(true);

    const optimisticPayload = movePlanningItem(planningPayload, item, targetBucketKey, targetIndex);
    onPlanningPayloadChange(optimisticPayload);

    try {
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
    if (!session.authenticated) {
      setActionError('Sign in with GitHub to move sprint items.');
      return;
    }

    if (!item.projectItemId) {
      setActionError('Only project items can be moved across sprint columns.');
      return;
    }

    setIsSaving(true);
    setActionError('');

    const optimisticPayload = updatePlanningItemStatus(planningPayload, item, option);
    onPlanningPayloadChange(optimisticPayload);

    try {
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

  return (
    <div className="space-y-6">
      <Card className="border-white/10 bg-slate-950/50 text-card-foreground shadow-glow backdrop-blur">
        <CardHeader className="gap-4 border-b border-white/10 bg-white/5 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="bg-cyan-300/15 text-cyan-100 ring-1 ring-cyan-200/30">GitHub-first</Badge>
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
          metrics={projectMetrics}
          statusGroups={sprintStatusGroups}
          dragState={dragState}
          isSaving={isSaving}
          onDragStateChange={setDragState}
          onStatusDrop={handleStatusDrop}
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
    return (
      <div className="space-y-1 text-right">
        <Badge variant="secondary">Public browsing only</Badge>
        {session.error ? <p className="text-xs text-slate-500">{session.error}</p> : null}
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

function QuickAddCard({ quickAdd, repositories, options, parentIssueOptions, authenticated, isSaving, onSubmit, onChange }) {
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
          <SelectField label="Repository" value={quickAdd.repository} disabled={!authenticated || isSaving} onChange={(value) => onChange((currentValue) => ({ ...currentValue, repository: value, labelIds: [], assigneeId: '' }))}>
            {repositories.map((repository) => (
              <option key={repository.fullName} value={repository.fullName}>{repository.fullName}</option>
            ))}
          </SelectField>
          <SelectField label="Sprint" value={quickAdd.sprintTarget} disabled={!authenticated || isSaving} onChange={(value) => onChange((currentValue) => ({ ...currentValue, sprintTarget: value }))}>
            <option value="backlog">Backlog</option>
            <option value="currentSprint">Current sprint</option>
            <option value="nextSprint">Next sprint</option>
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

function SprintView({ payload, buckets, metrics, statusGroups, dragState, isSaving, onDragStateChange, onStatusDrop, onBucketDrop }) {
  const completedPercent = metrics.currentSprint.itemCount > 0
    ? Math.round((metrics.currentSprint.doneCount / metrics.currentSprint.itemCount) * 100)
    : 0;
  const statusOptions = payload?.fields?.status?.options || [];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        <MetricCard title="Backlog" icon={FolderKanban} value={`${metrics.backlog.itemCount} items`} description={`${metrics.backlog.estimatePoints} estimated points`} />
        <MetricCard title="Current sprint" icon={CalendarDays} value={`${metrics.currentSprint.itemCount} items`} description={`${completedPercent}% done`} />
        <MetricCard title="Next sprint" icon={Target} value={`${metrics.nextSprint.itemCount} items`} description={`${metrics.nextSprint.estimatePoints} estimated points`} />
        <MetricCard title="Completed sprint" icon={TimerReset} value={`${metrics.completedSprint.itemCount} items`} description={`${metrics.completedSprint.doneCount} done`} />
      </div>
      <Card className="border-white/10 bg-slate-950/50 text-card-foreground shadow-glow backdrop-blur">
        <CardHeader>
          <CardTitle className="text-xl text-white">{payload?.currentSprint?.title || 'Current sprint'}</CardTitle>
          <CardDescription className="text-slate-400">Drag cards across status columns to update the GitHub Project status field directly.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 xl:grid-cols-5">
            {statusGroups.map((group) => {
              const option = statusOptions.find((statusOption) => statusOption.name.toLowerCase() === group.status.toLowerCase());
              return (
                <div
                  key={group.status}
                  className="rounded-3xl border border-white/10 bg-slate-900/70 p-4"
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={() => dragState?.item && option ? onStatusDrop(dragState.item, option) : null}
                >
                  <div className="mb-4 flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-2 rounded-full bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.2em] text-slate-300">
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
        <DropSection title={payload?.nextSprint?.title || 'Next sprint'} subtitle="Move unfinished work here to prepare the next iteration." items={buckets.nextSprint?.items || []} badgeText={`${metrics.nextSprint.itemCount} items`} onDropItem={(item, targetIndex) => onBucketDrop(item, 'nextSprint', targetIndex)} dragState={dragState} isSaving={isSaving} onDragStateChange={onDragStateChange} />
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
    </div>
  );
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
            <Badge variant="secondary">{item.status || 'No status'}</Badge>
            <Badge variant="secondary">{item.displayState || formatPlanningState(item.state)}</Badge>
          </div>
          <div className="space-y-1">
            <h4 className="text-base font-semibold text-white">{item.title}</h4>
            {item.repository ? <p className="text-sm text-slate-400">{item.repository}</p> : null}
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
            {item.estimatePoints ? <span>{item.estimatePoints} pts</span> : null}
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

function MetricsGrid({ metrics }) {
  return (
    <div className="grid gap-4 md:grid-cols-4">
      <MetricCard title="Backlog" icon={FolderKanban} value={`${metrics.backlog.itemCount} items`} description={`${metrics.backlog.estimatePoints} points`} />
      <MetricCard title="Current sprint" icon={CalendarDays} value={`${metrics.currentSprint.itemCount} items`} description={`${metrics.currentSprint.doneCount} done`} />
      <MetricCard title="Next sprint" icon={Target} value={`${metrics.nextSprint.itemCount} items`} description={`${metrics.nextSprint.estimatePoints} points`} />
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
  currentIterationId,
  nextIterationId,
  currentSprintTitle,
  nextSprintTitle,
  backlogStatusOptionId,
  inProgressStatusOptionId,
}) {
  if (sprintTarget === 'currentSprint') {
    return {
      iterationId: currentIterationId,
      iterationTitle: currentSprintTitle,
      statusName: inProgressStatusOptionId ? 'In progress' : 'Backlog',
      statusOptionId: inProgressStatusOptionId || backlogStatusOptionId || '',
    };
  }

  if (sprintTarget === 'nextSprint') {
    return {
      iterationId: nextIterationId,
      iterationTitle: nextSprintTitle,
      statusName: 'Backlog',
      statusOptionId: backlogStatusOptionId || '',
    };
  }

  return {
    iterationId: null,
    iterationTitle: null,
    statusName: 'Backlog',
    statusOptionId: backlogStatusOptionId || '',
  };
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

function getSprintStatusGroups(items) {
  const groups = items.reduce((result, item) => {
    const status = item.status || 'No status';
    const collection = result.get(status) || [];
    collection.push(item);
    result.set(status, collection);
    return result;
  }, new Map());

  return [...groups.entries()].map(([status, statusItems]) => ({
    status,
    items: statusItems,
  }));
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

  return nextPayload;
}
