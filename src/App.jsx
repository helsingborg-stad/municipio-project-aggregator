import { AlertCircle, ArrowUpRight, Building2, CalendarDays, ChevronDown, ChevronRight, FolderGit2, FolderKanban, GitPullRequest, LayoutGrid, List, RefreshCcw, RotateCcw, ScrollText, Search, Ticket, Users } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { useEffect, useState } from 'react';
import remarkGfm from 'remark-gfm';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  filterAuthors,
  filterItems,
  filterReleases,
  filterRepositories,
  filterSprintItems,
  formatRelativeTime,
  formatTimestamp,
  getAuthorDirectory,
  getFilterOptions,
  getItemTree,
  getMilestoneGroups,
  getRepositoryCatalog,
  getRepositoryGroups,
  hasRelationships,
  hasSubIssues,
  truncateText,
} from '@/lib/dashboard';

const sources = [
  { key: 'issues', label: 'Issues', icon: Ticket, accent: 'bg-rose-500/15 text-rose-200 ring-1 ring-rose-400/30' },
  { key: 'pull-requests', label: 'Pull Requests', icon: GitPullRequest, accent: 'bg-emerald-500/15 text-emerald-200 ring-1 ring-emerald-400/30' },
];

const sprintTab = { key: 'sprints', label: 'Sprints', icon: CalendarDays };
const releaseTab = { key: 'releases', label: 'Release log', icon: ScrollText };

const auxiliaryTabs = [
  { key: 'repositories', label: 'Repositories', icon: FolderKanban },
  { key: 'authors', label: 'Authors', icon: Users },
];

const mainTabs = [...sources, sprintTab, releaseTab, ...auxiliaryTabs];

const emptyFilters = {
  author: '',
  assignee: '',
  milestone: '',
  type: '',
  subIssues: 'all',
  relationships: 'all',
};

const defaultViewMode = 'cards';
const sourcePanelStorageKeyPrefix = 'municipio-project-aggregator:source-panel';

/**
 * Returns a new filter state object with default values.
 *
 * @returns {typeof emptyFilters}
 */
function getEmptyFilters() {
  return { ...emptyFilters };
}

/**
 * Returns the default source panel preferences.
 *
 * @returns {{filters: typeof emptyFilters, viewMode: 'cards' | 'list', expandedTreeItems: string[]}}
 */
function getDefaultSourcePanelPreferences() {
  return {
    filters: getEmptyFilters(),
    viewMode: defaultViewMode,
    expandedTreeItems: [],
  };
}

/**
 * Returns the local storage key for a source panel.
 *
 * @param {string} source
 * @returns {string}
 */
function getSourcePanelStorageKey(source) {
  return `${sourcePanelStorageKeyPrefix}:${source}`;
}

/**
 * Normalizes a stored filter object to the supported filter shape.
 *
 * @param {unknown} storedFilters
 * @returns {typeof emptyFilters}
 */
function normalizeStoredFilters(storedFilters) {
  const filters = getEmptyFilters();

  if (!storedFilters || typeof storedFilters !== 'object') {
    return filters;
  }

  return Object.keys(filters).reduce((normalizedFilters, key) => ({
    ...normalizedFilters,
    [key]: typeof storedFilters[key] === 'string' ? storedFilters[key] : filters[key],
  }), filters);
}

/**
 * Normalizes the stored presentation mode.
 *
 * @param {unknown} viewMode
 * @returns {'cards' | 'list'}
 */
function normalizeViewMode(viewMode) {
  return viewMode === 'list' ? 'list' : defaultViewMode;
}

/**
 * Normalizes the stored expanded tree item state.
 *
 * @param {unknown} expandedTreeItems
 * @returns {string[]}
 */
function normalizeStoredExpandedTreeItems(expandedTreeItems) {
  if (!Array.isArray(expandedTreeItems)) {
    return [];
  }

  return [...new Set(expandedTreeItems.filter((url) => typeof url === 'string' && url !== ''))];
}

/**
 * Reads saved source panel preferences from local storage.
 *
 * @param {string} source
 * @returns {{filters: typeof emptyFilters, viewMode: 'cards' | 'list', expandedTreeItems: string[]}}
 */
function readSourcePanelPreferences(source) {
  if (typeof window === 'undefined') {
    return getDefaultSourcePanelPreferences();
  }

  try {
    const rawPreferences = window.localStorage.getItem(getSourcePanelStorageKey(source));

    if (!rawPreferences) {
      return getDefaultSourcePanelPreferences();
    }

    const parsedPreferences = JSON.parse(rawPreferences);

    return {
      filters: normalizeStoredFilters(parsedPreferences.filters),
      viewMode: normalizeViewMode(parsedPreferences.viewMode),
      expandedTreeItems: normalizeStoredExpandedTreeItems(parsedPreferences.expandedTreeItems),
    };
  } catch {
    return getDefaultSourcePanelPreferences();
  }
}

/**
 * Determines whether the current panel state differs from the defaults.
 *
 * @param {typeof emptyFilters} filters
 * @param {'cards' | 'list'} viewMode
 * @param {string[]} expandedTreeItems
 * @returns {boolean}
 */
function hasCustomPanelPreferences(filters, viewMode, expandedTreeItems) {
  return Object.entries(emptyFilters).some(([name, value]) => filters[name] !== value)
    || viewMode !== defaultViewMode
    || expandedTreeItems.length > 0;
}

/**
 * Returns the normalized main tab key.
 *
 * @param {string | null | undefined} tabKey
 * @returns {string}
 */
function normalizeMainTabKey(tabKey) {
  if (tabKey === 'contributors') {
    return 'authors';
  }

  return mainTabs.some((tab) => tab.key === tabKey) ? tabKey : sources[0].key;
}

/**
 * Reads the selected main tab from the current URL.
 *
 * @returns {string}
 */
function readMainTabFromUrl() {
  if (typeof window === 'undefined') {
    return sources[0].key;
  }

  const searchParams = new URLSearchParams(window.location.search);

  return normalizeMainTabKey(searchParams.get('tab'));
}

/**
 * Writes the selected main tab to the current URL.
 *
 * @param {string} tabKey
 * @returns {void}
 */
function writeMainTabToUrl(tabKey) {
  if (typeof window === 'undefined') {
    return;
  }

  const url = new URL(window.location.href);
  url.searchParams.set('tab', normalizeMainTabKey(tabKey));
  window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
}

/**
 * Splits a repository full name into owner and repository name parts.
 *
 * @param {string | null | undefined} repository
 * @returns {{owner: string, name: string, fullName: string} | null}
 */
function getRepositoryNameParts(repository) {
  if (typeof repository !== 'string') {
    return null;
  }

  const fullName = repository.trim();

  if (!fullName) {
    return null;
  }

  const [owner = '', ...nameParts] = fullName.split('/');
  const name = nameParts.join('/');

  if (!owner || !name) {
    return {
      owner: fullName,
      name: '',
      fullName,
    };
  }

  return {
    owner,
    name,
    fullName,
  };
}

function AvatarImage({ person, sizeClassName = 'h-5 w-5', fallbackTextClassName = 'text-[10px]' }) {
  if (!person?.login) {
    return null;
  }

  if (person.avatarUrl) {
    return <img src={person.avatarUrl} alt={person.login} className={`${sizeClassName} rounded-full object-cover`} loading="lazy" />;
  }

  return (
    <div className={`flex ${sizeClassName} items-center justify-center rounded-full bg-cyan-300/15 font-semibold uppercase text-cyan-100 ${fallbackTextClassName}`}>
      {person.login.slice(0, 1)}
    </div>
  );
}

function Avatar({ person, fallbackLabel }) {
  if (!person?.login) {
    return null;
  }

  return (
    <div className="flex max-w-full min-w-0 items-center gap-2 rounded-full bg-white/5 px-2.5 py-1 text-xs text-slate-200 ring-1 ring-white/10">
      <AvatarImage person={person} />
      <span className="truncate">
        {fallbackLabel ? `${fallbackLabel}: ` : ''}
        {person.login}
      </span>
    </div>
  );
}

function PersonHoverAvatar({ person, roleLabel }) {
  if (!person?.login) {
    return null;
  }

  return (
    <div className="group/avatar relative" title={`${roleLabel}: ${person.login}`}>
      <div className="rounded-full ring-1 ring-white/10 transition-colors group-hover/avatar:ring-cyan-300/50">
        <AvatarImage person={person} sizeClassName="h-8 w-8" fallbackTextClassName="text-xs" />
      </div>
      <div className="pointer-events-none absolute right-0 top-full z-10 mt-2 w-max max-w-48 rounded-xl border border-white/10 bg-slate-950/95 px-3 py-2 text-right text-xs text-slate-200 opacity-0 shadow-xl transition-opacity group-hover/avatar:opacity-100">
        <div className="font-medium text-white">{person.login}</div>
        <div className="mt-0.5 uppercase tracking-[0.2em] text-slate-500">{roleLabel}</div>
      </div>
    </div>
  );
}

function CardPeopleCluster({ author, assignees }) {
  const people = [
    author?.login ? { key: `author:${author.login}`, person: author, roleLabel: 'Author' } : null,
    ...(assignees ?? []).filter((assignee) => assignee?.login).map((assignee) => ({
      key: `assignee:${assignee.login}`,
      person: assignee,
      roleLabel: 'Assignee',
    })),
  ].filter(Boolean);

  if (people.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap justify-end gap-2">
      {people.map(({ key, person, roleLabel }) => (
        <PersonHoverAvatar key={key} person={person} roleLabel={roleLabel} />
      ))}
    </div>
  );
}

function AssigneeStack({ assignees }) {
  if (!assignees?.length) {
    return <span className="text-xs text-slate-500">No assignees</span>;
  }

  return (
    <div className="flex min-w-0 flex-wrap gap-2">
      {assignees.map((assignee) => (
        <Avatar key={assignee.login} person={assignee} />
      ))}
    </div>
  );
}

function FilterSelect({ label, value, onChange, options }) {
  return (
    <label className="space-y-2 text-sm text-slate-300">
      <span className="block text-xs font-medium uppercase tracking-[0.2em] text-slate-500">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-white outline-none transition-colors focus:border-cyan-300/50"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function FilterBar({ filters, filterOptions, onFilterChange, viewMode, onViewModeChange, onClear, canClear }) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="inline-flex w-full rounded-full border border-white/10 bg-slate-950/70 p-1 text-sm lg:w-auto">
          <button
            type="button"
            aria-label="Card view"
            aria-pressed={viewMode === 'cards'}
            onClick={() => onViewModeChange('cards')}
            className={`inline-flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2 transition-colors lg:flex-none ${viewMode === 'cards' ? 'bg-white text-slate-950' : 'text-slate-300 hover:bg-white/5 hover:text-white'}`}
          >
            <LayoutGrid className="h-4 w-4" />
            Cards
          </button>
          <button
            type="button"
            aria-label="List view"
            aria-pressed={viewMode === 'list'}
            onClick={() => onViewModeChange('list')}
            className={`inline-flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2 transition-colors lg:flex-none ${viewMode === 'list' ? 'bg-white text-slate-950' : 'text-slate-300 hover:bg-white/5 hover:text-white'}`}
          >
            <List className="h-4 w-4" />
            List
          </button>
        </div>

        <button
          type="button"
          aria-label="Clear saved view"
          onClick={onClear}
          disabled={!canClear}
          className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-2 text-sm text-slate-300 transition-colors hover:border-cyan-300/40 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          <RotateCcw className="h-4 w-4" />
          Clear saved view
        </button>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <FilterSelect
          label="Author"
          value={filters.author}
          onChange={(value) => onFilterChange('author', value)}
          options={[{ value: '', label: 'All authors' }, ...filterOptions.authors.map((author) => ({ value: author, label: author }))]}
        />
        <FilterSelect
          label="Assignee"
          value={filters.assignee}
          onChange={(value) => onFilterChange('assignee', value)}
          options={[
            { value: '', label: 'All assignees' },
            { value: '__unassigned__', label: 'Unassigned' },
            ...filterOptions.assignees.map((assignee) => ({ value: assignee, label: assignee })),
          ]}
        />
        <FilterSelect
          label="Milestone"
          value={filters.milestone}
          onChange={(value) => onFilterChange('milestone', value)}
          options={[
            { value: '', label: 'All milestones' },
            { value: '__none__', label: 'No milestone' },
            ...filterOptions.milestones.map((milestone) => ({ value: milestone, label: milestone })),
          ]}
        />
        <FilterSelect
          label="Type"
          value={filters.type}
          onChange={(value) => onFilterChange('type', value)}
          options={[
            { value: '', label: 'All types' },
            { value: '__none__', label: 'Untyped' },
            ...filterOptions.types.map((type) => ({ value: type, label: type })),
          ]}
        />
        <FilterSelect
          label="Sub-issues"
          value={filters.subIssues}
          onChange={(value) => onFilterChange('subIssues', value)}
          options={[
            { value: 'all', label: 'All sub-issue states' },
            { value: 'with', label: 'Has sub-issues' },
            { value: 'without', label: 'No sub-issues' },
          ]}
        />
        <FilterSelect
          label="Relationships"
          value={filters.relationships}
          onChange={(value) => onFilterChange('relationships', value)}
          options={[
            { value: 'all', label: 'All relationship states' },
            { value: 'with', label: 'Has relationships' },
            { value: 'without', label: 'No relationships' },
          ]}
        />
      </div>
    </div>
  );
}

function GlobalSearchInput({ value, onChange }) {
  return (
    <label className="relative block w-full xl:max-w-md">
      <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
      <span className="sr-only">Search all tabs</span>
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Search titles, repositories, authors, assignees, versions..."
        className="w-full rounded-2xl border border-white/10 bg-slate-950/70 py-3 pl-11 pr-4 text-sm text-white outline-none transition-colors placeholder:text-slate-500 focus:border-cyan-300/50"
      />
    </label>
  );
}

function ReleaseMarkdown({ body }) {
  const markdown = typeof body === 'string' && body.trim() !== '' ? body : '_No release notes were provided for this release._';

  return (
    <div className="release-log__markdown overflow-hidden rounded-3xl border border-white/10 bg-slate-950/70 p-5 text-sm text-slate-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ node, ...props }) => <h3 className="mt-6 text-xl font-semibold text-white first:mt-0" {...props} />,
          h2: ({ node, ...props }) => <h4 className="mt-6 text-lg font-semibold text-white first:mt-0" {...props} />,
          h3: ({ node, ...props }) => <h5 className="mt-5 text-base font-semibold text-white first:mt-0" {...props} />,
          p: ({ node, ...props }) => <p className="mt-3 leading-7 text-slate-300 first:mt-0" {...props} />,
          ul: ({ node, ...props }) => <ul className="mt-4 list-disc space-y-2 pl-5 text-slate-300 marker:text-cyan-300" {...props} />,
          ol: ({ node, ...props }) => <ol className="mt-4 list-decimal space-y-2 pl-5 text-slate-300 marker:text-cyan-300" {...props} />,
          li: ({ node, ...props }) => <li className="pl-1 leading-7" {...props} />,
          blockquote: ({ node, ...props }) => <blockquote className="mt-4 border-l-2 border-cyan-300/40 pl-4 italic text-slate-400" {...props} />,
          a: ({ node, ...props }) => <a className="font-medium text-cyan-200 underline decoration-cyan-300/40 underline-offset-4 transition-colors hover:text-white" target="_blank" rel="noreferrer" {...props} />,
          code: ({ className, children, ...props }) => {
            const codeText = String(children ?? '');
            const isInlineCode = !className && !codeText.includes('\n');

            return isInlineCode
              ? <code className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-[13px] text-cyan-100" {...props}>{children}</code>
              : <code className={`block overflow-x-auto rounded-2xl bg-slate-900/95 p-4 font-mono text-[13px] text-cyan-100 ${className || ''}`} {...props}>{children}</code>;
          },
          pre: ({ node, ...props }) => <pre className="mt-4 overflow-x-auto" {...props} />,
          hr: ({ node, ...props }) => <hr className="my-6 border-white/10" {...props} />,
          table: ({ node, ...props }) => (
            <div className="mt-4 overflow-x-auto rounded-2xl border border-white/10">
              <table className="min-w-full divide-y divide-white/10 text-left text-sm" {...props} />
            </div>
          ),
          thead: ({ node, ...props }) => <thead className="bg-white/5" {...props} />,
          th: ({ node, ...props }) => <th className="px-4 py-3 font-semibold text-white" {...props} />,
          td: ({ node, ...props }) => <td className="px-4 py-3 align-top text-slate-300" {...props} />,
        }}
      >
        {markdown}
      </ReactMarkdown>
    </div>
  );
}

function ReleaseTimelinePanel({ pageIndex, pagePayload, searchQuery, currentPageNumber, onPageChange, isLoadingPage }) {
  const repository = pageIndex?.repository;
  const releases = filterReleases(Array.isArray(pagePayload?.items) ? pagePayload.items : [], searchQuery);
  const pages = Array.isArray(pageIndex?.pages) ? pageIndex.pages : [];
  const totalPages = Number(pageIndex?.pageCount ?? 0);

  return (
    <Card className="overflow-hidden border-white/10 bg-slate-950/50 text-card-foreground shadow-glow backdrop-blur">
      <CardHeader className="flex flex-col gap-4 border-b border-white/10 bg-white/5 md:flex-row md:items-end md:justify-between">
        <div>
          <CardTitle className="text-2xl text-white">Release log</CardTitle>
          <CardDescription className="mt-2 max-w-2xl text-slate-300">
            Release notes from <span className="font-semibold text-white">{repository?.fullName ?? 'municipio-se/municipio-deployment'}</span>, presented as a chronological deployment flow.
          </CardDescription>
        </div>
        <div className="inline-flex items-center gap-2 rounded-full bg-amber-400/15 px-4 py-2 text-sm font-medium text-amber-100 ring-1 ring-amber-300/30">
          <ScrollText className="h-4 w-4" />
          {pageIndex?.count ?? 0} releases
        </div>
      </CardHeader>
      <CardContent className="p-6">
        {totalPages > 1 ? (
          <div className="mb-6 flex flex-col gap-4 rounded-3xl border border-white/10 bg-white/[0.03] p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm text-slate-400">
              Page <span className="font-semibold text-white">{currentPageNumber}</span> of <span className="font-semibold text-white">{totalPages}</span>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                aria-label="Previous release page"
                onClick={() => onPageChange(currentPageNumber - 1)}
                disabled={currentPageNumber <= 1 || isLoadingPage}
                className="rounded-full border border-white/10 bg-slate-950/70 px-4 py-2 text-sm text-slate-300 transition-colors hover:border-cyan-300/40 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                Previous
              </button>
              {pages.map((page) => (
                <button
                  key={page.pageNumber}
                  type="button"
                  aria-label={`Release page ${page.pageNumber}`}
                  aria-pressed={page.pageNumber === currentPageNumber}
                  onClick={() => onPageChange(page.pageNumber)}
                  disabled={isLoadingPage}
                  className={`rounded-full px-4 py-2 text-sm transition-colors ${page.pageNumber === currentPageNumber ? 'bg-white text-slate-950' : 'border border-white/10 bg-slate-950/70 text-slate-300 hover:border-cyan-300/40 hover:text-white'}`}
                >
                  {page.pageNumber}
                </button>
              ))}
              <button
                type="button"
                aria-label="Next release page"
                onClick={() => onPageChange(currentPageNumber + 1)}
                disabled={currentPageNumber >= totalPages || isLoadingPage}
                className="rounded-full border border-white/10 bg-slate-950/70 px-4 py-2 text-sm text-slate-300 transition-colors hover:border-cyan-300/40 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        ) : null}

        {isLoadingPage ? (
          <div className="rounded-2xl border border-dashed border-white/15 bg-white/5 p-8 text-center text-slate-300">
            Loading release page...
          </div>
        ) : null}

        {releases.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/15 bg-white/5 p-8 text-center text-slate-300">
            No releases match the current search.
          </div>
        ) : (
          <div className="space-y-6">
            {releases.map((release) => (
              <article key={`${release.version}-${release.publishedAt}`} className="relative pl-10">
                <div className="absolute left-4 top-0 h-full w-px bg-gradient-to-b from-cyan-300/60 via-white/10 to-transparent" aria-hidden="true" />
                <div className="absolute left-[7px] top-5 h-4 w-4 rounded-full border-4 border-slate-950 bg-cyan-300 shadow-[0_0_0_4px_rgba(34,211,238,0.12)]" aria-hidden="true" />

                <div className="rounded-[1.75rem] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.95),rgba(15,23,42,0.75))] p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        {release.version ? <Badge variant="secondary">{release.version}</Badge> : null}
                        {release.isPrerelease ? <Badge variant="secondary" className="bg-amber-400/10 text-amber-100 ring-1 ring-amber-300/20">Pre-release</Badge> : null}
                        {release.isDraft ? <Badge variant="secondary" className="bg-slate-400/10 text-slate-200 ring-1 ring-slate-300/20">Draft</Badge> : null}
                      </div>
                      <div>
                        <a
                          href={release.url}
                          target="_blank"
                          rel="noreferrer"
                          className="group inline-flex items-start gap-2 text-left"
                        >
                          <h3 className="text-2xl font-semibold text-white transition-colors group-hover:text-cyan-100">{release.title}</h3>
                          <ArrowUpRight className="mt-1 h-4 w-4 shrink-0 text-slate-500 transition-colors group-hover:text-cyan-200" />
                        </a>
                        <div className="mt-2 flex flex-wrap gap-2 text-sm text-slate-400">
                          <span>{formatRelativeTime(release.publishedAt)}</span>
                          <span className="text-slate-600">/</span>
                          <span>{formatTimestamp(release.publishedAt)}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6">
                    <ReleaseMarkdown body={release.body} />
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ItemBadgeRow({ item }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Badge variant="secondary">#{item.number}</Badge>
      {item.type ? <Badge variant="secondary">{item.type}</Badge> : null}
      {item.milestone?.title ? <Badge variant="secondary">{item.milestone.title}</Badge> : null}
      {hasSubIssues(item) ? <Badge variant="secondary">{item.subIssues.total} sub-issues</Badge> : null}
      {hasRelationships(item) ? (
        <Badge variant="secondary">
          {item.relationshipSummary.linked + item.relationshipSummary.totalBlockedBy + item.relationshipSummary.totalBlocking} relationships
        </Badge>
      ) : null}
    </div>
  );
}

function ItemDetailPanel({ item }) {
  const showSubIssues = hasSubIssues(item);
  const hasDependencySummary = item.relationshipSummary.totalBlockedBy > 0 || item.relationshipSummary.totalBlocking > 0;
  const hasRelationshipsList = (item.relationships?.length ?? 0) > 0;

  if (!showSubIssues && !hasDependencySummary && !hasRelationshipsList) {
    return null;
  }

  return (
    <div className="source-item-card__details grid gap-3 rounded-2xl border border-white/10 bg-slate-950/45 p-3 text-sm text-slate-300">
      {showSubIssues || hasDependencySummary ? (
        <div className="source-item-card__stats grid gap-2 text-xs text-slate-400">
          {showSubIssues ? (
            <div className="rounded-2xl bg-white/5 px-3 py-2">
              <span className="block text-slate-500">Sub-issues</span>
              <span className="font-medium text-slate-100">
                {item.subIssues.completed}/{item.subIssues.total} completed
              </span>
            </div>
          ) : null}
          {hasDependencySummary ? (
            <div className="rounded-2xl bg-white/5 px-3 py-2">
              <span className="block text-slate-500">Dependencies</span>
              <span className="font-medium text-slate-100">
                {item.relationshipSummary.totalBlockedBy} blocked by, {item.relationshipSummary.totalBlocking} blocking
              </span>
            </div>
          ) : null}
        </div>
      ) : null}
      {hasRelationshipsList ? (
        <div className="source-item-card__relationships space-y-2">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-500">Relationships</p>
          <ul className="space-y-2">
            {item.relationships.slice(0, 3).map((relationship) => (
              <li key={`${relationship.event}-${relationship.url}`}>
                <a
                  href={relationship.url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-between gap-3 rounded-2xl bg-white/5 px-3 py-2 text-xs text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
                >
                  <span>
                    <span className="font-medium text-slate-100">{relationship.title}</span>
                    <span className="ml-2 text-slate-500">{relationship.repository}</span>
                  </span>
                  {!['cross referenced', 'cross-referenced'].includes(relationship.event?.toLowerCase()) ? (
                    <Badge variant="secondary">{relationship.event}</Badge>
                  ) : null}
                </a>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function hasItemDetailContent(item) {
  return hasSubIssues(item)
    || item.relationshipSummary.totalBlockedBy > 0
    || item.relationshipSummary.totalBlocking > 0
    || (item.relationships?.length ?? 0) > 0;
}

function TrackedItemCard({ item, showRepository = false }) {
  const hasDetailContent = hasItemDetailContent(item);

  return (
    <li className="source-item-card rounded-2xl border border-white/10 bg-white/5 p-4 transition-colors hover:border-cyan-300/40 hover:bg-white/10">
      <div className={`source-item-card__content grid gap-4 ${hasDetailContent ? '' : 'source-item-card__content--summary-only'}`}>
        <a
          href={item.url}
          target="_blank"
          rel="noreferrer"
          className="source-item-card__link group flex items-start justify-between gap-4"
        >
          <div className="source-item-card__summary min-w-0 flex-1">
            {showRepository ? (
              <div className="mb-3 flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-slate-500">
                <FolderKanban className="h-3.5 w-3.5" />
                <span>{item.repository}</span>
              </div>
            ) : null}
            <ItemBadgeRow item={item} />
            <h4 className="mt-3 text-sm font-medium text-slate-100 transition-colors group-hover:text-white">
              {item.title}
              <span className="sr-only"> (opens in a new tab)</span>
            </h4>
            <div className="source-item-card__timestamps mt-2 flex flex-wrap gap-2 text-xs text-slate-400">
              <span>{formatRelativeTime(item.createdAt)}</span>
              <span className="text-slate-600">/</span>
              <span>{formatTimestamp(item.createdAt)}</span>
            </div>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-3">
            <CardPeopleCluster author={item.author} assignees={item.assignees} />
            <ArrowUpRight className="source-item-card__icon mt-0.5 h-4 w-4 shrink-0 text-slate-500 transition-colors group-hover:text-cyan-200" />
          </div>
        </a>

        <ItemDetailPanel item={item} />
      </div>
    </li>
  );
}

/**
 * Returns the total number of visible items in a tree.
 *
 * @param {Array<{children?: Array<any>}>} items
 * @returns {number}
 */
function countTreeItems(items) {
  return items.reduce((total, item) => total + 1 + countTreeItems(item.children ?? []), 0);
}

function TrackedItemListRow({ item, depth = 0, expandedTreeItems, onToggleExpand }) {
  const childItems = Array.isArray(item.children) ? item.children : [];
  const hasChildren = childItems.length > 0;
  const isExpanded = hasChildren ? expandedTreeItems.includes(item.url) : false;
  const repositoryNameParts = getRepositoryNameParts(item.repository);

  return (
    <>
      <li
        className="group flex items-center border-b border-white/[0.06] transition-colors hover:bg-white/[0.03] last:border-b-0"
        style={{ paddingLeft: `${depth * 1.25}rem` }}
      >
        <div className="flex h-9 w-7 shrink-0 items-center justify-center">
          {hasChildren ? (
            <button
              type="button"
              aria-expanded={isExpanded}
              aria-label={`${isExpanded ? 'Collapse' : 'Expand'} sub-items for ${item.title}`}
              onClick={() => onToggleExpand(item.url)}
              className="flex h-5 w-5 items-center justify-center rounded text-slate-500 transition-colors hover:text-slate-200"
            >
              {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            </button>
          ) : null}
        </div>

        <div className="flex h-9 w-6 shrink-0 items-center">
          <div className="h-3.5 w-3.5 rounded-full border-2 border-slate-500/70" />
        </div>

        <div className="flex min-w-0 flex-1 items-center gap-2 py-2 pr-3">
          <a
            href={item.url}
            target="_blank"
            rel="noreferrer"
            className="truncate text-sm text-slate-200 transition-colors hover:text-white"
          >
            {item.title}
          </a>
          {item.type ? (
            <Badge variant="secondary" className="shrink-0 text-[10px]">{item.type}</Badge>
          ) : null}
          {hasSubIssues(item) ? (
            <span className="shrink-0 font-mono text-[10px] text-slate-500">
              {item.subIssues.completed}/{item.subIssues.total}
            </span>
          ) : null}
          {hasChildren ? (
            <Badge variant="secondary" className="shrink-0 text-[10px]">
              {childItems.length}
            </Badge>
          ) : null}
        </div>

        <div className="flex w-52 shrink-0 items-center gap-1.5 py-2 pr-3">
          {repositoryNameParts ? (
            <>
              <span className="min-w-0 space-y-1 text-xs leading-4 text-slate-500">
                <span className="flex items-start gap-1.5">
                  <Building2 className="mt-0.5 h-3 w-3 shrink-0 text-slate-600" />
                  <span className="block break-all text-slate-400">{repositoryNameParts.owner}</span>
                </span>
                {repositoryNameParts.name ? (
                  <span className="flex items-start gap-1.5">
                    <FolderGit2 className="mt-0.5 h-3 w-3 shrink-0 text-slate-500" />
                    <span className="block break-all font-medium text-slate-300">{repositoryNameParts.name}</span>
                  </span>
                ) : null}
              </span>
            </>
          ) : (
            <span className="text-slate-700">—</span>
          )}
        </div>

        <div className="flex w-20 shrink-0 items-center py-2">
          {item.assignees?.length ? (
            <div className="flex -space-x-1">
              {item.assignees.slice(0, 3).map((assignee) => (
                <AvatarImage key={assignee.login} person={assignee} sizeClassName="h-5 w-5 ring-1 ring-slate-900" />
              ))}
            </div>
          ) : (
            <span className="text-slate-700">—</span>
          )}
        </div>

        <div className="w-28 shrink-0 whitespace-nowrap py-2 text-xs text-slate-500">
          {formatTimestamp(item.createdAt)}
        </div>

        <div className="flex w-8 shrink-0 items-center justify-center py-2 opacity-0 transition-opacity group-hover:opacity-100">
          <a
            href={item.url}
            target="_blank"
            rel="noreferrer"
            className="text-slate-500 transition-colors hover:text-cyan-300"
          >
            <ArrowUpRight className="h-3.5 w-3.5" />
          </a>
        </div>
      </li>

      {hasChildren && isExpanded
        ? childItems.map((child) => (
            <TrackedItemListRow
              key={child.url}
              item={child}
              depth={depth + 1}
              expandedTreeItems={expandedTreeItems}
              onToggleExpand={onToggleExpand}
            />
          ))
        : null}
    </>
  );
}

function RepositoryCatalogPanel({ repositories, searchQuery }) {
  const repositoryCardClassName = 'rounded-3xl border border-white/10 bg-slate-900/70 p-5';
  const visibleRepositories = filterRepositories(repositories, searchQuery);

  return (
    <Card className="overflow-hidden border-white/10 bg-slate-950/50 text-card-foreground shadow-glow backdrop-blur">
      <CardHeader className="flex flex-col gap-4 border-b border-white/10 bg-white/5 md:flex-row md:items-end md:justify-between">
        <div>
          <CardTitle className="text-2xl text-white">Compatible plugins</CardTitle>
          <CardDescription className="mt-2 max-w-2xl text-slate-300">
            Repositories discovered from the tracked GitHub topics, ready to browse as compatible Municipio plugins.
          </CardDescription>
        </div>
        <div className="inline-flex items-center gap-2 rounded-full bg-cyan-300/15 px-4 py-2 text-sm font-medium text-cyan-100 ring-1 ring-cyan-200/30">
          <FolderKanban className="h-4 w-4" />
          {visibleRepositories.length} repositories
        </div>
      </CardHeader>
      <CardContent className="p-6">
        {visibleRepositories.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/15 bg-white/5 p-8 text-center text-slate-300">
            No repositories match the current search.
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {visibleRepositories.map((repository) => {
              const content = (
                <>
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-2">
                      <div>
                        <h3 className="text-lg font-semibold text-white">{repository.name}</h3>
                        <p className="text-sm text-slate-500">{repository.owner}</p>
                      </div>
                      <p className="text-sm text-slate-300">{truncateText(repository.description || 'No description available.', 140)}</p>
                    </div>
                    {repository.url ? <ArrowUpRight className="mt-0.5 h-4 w-4 shrink-0 text-slate-500 transition-colors group-hover:text-cyan-200" /> : null}
                  </div>
                  <div className="mt-4 flex items-center justify-between text-xs text-slate-400">
                    <span>{repository.fullName}</span>
                    <Badge variant="secondary">{repository.itemCount} tracked item{repository.itemCount === 1 ? '' : 's'}</Badge>
                  </div>
                </>
              );

              if (!repository.url) {
                return (
                  <div key={repository.fullName} className={repositoryCardClassName}>
                    {content}
                  </div>
                );
              }

              return (
                <a
                  key={repository.fullName}
                  href={repository.url}
                  target="_blank"
                  rel="noreferrer"
                  className={`group ${repositoryCardClassName} transition-colors hover:border-cyan-300/40 hover:bg-slate-900`}
                >
                  {content}
                </a>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function AuthorDirectoryPanel({ authors, searchQuery }) {
  const authorCardClassName = 'rounded-3xl border border-white/10 bg-slate-900/70 p-5';
  const visibleAuthors = filterAuthors(authors, searchQuery);
  const activeAuthors = visibleAuthors.filter((author) => author.score > 0);
  const historicAuthors = visibleAuthors.filter((author) => author.score <= 0);

  function renderAuthors(authorList) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {authorList.map((author) => {
          const content = (
            <div className={author.url ? `group ${authorCardClassName} transition-colors hover:border-fuchsia-300/40 hover:bg-slate-900` : authorCardClassName}>
              <div className="flex items-center gap-4">
                <AvatarImage person={author} sizeClassName="h-14 w-14" fallbackTextClassName="text-base" />
                <div className="flex min-h-14 min-w-0 flex-1 flex-col">
                  <h3 className="truncate text-lg font-semibold text-white">{author.login}</h3>
                  {author.company ? <p className="truncate text-sm text-slate-500">{author.company}</p> : null}
                </div>
                {author.url ? <ArrowUpRight className="ml-auto h-4 w-4 shrink-0 text-slate-500 transition-colors group-hover:text-fuchsia-200" /> : null}
              </div>
            </div>
          );

          if (!author.url) {
            return <div key={author.login}>{content}</div>;
          }

          return (
            <a key={author.login} href={author.url} target="_blank" rel="noreferrer">
              {content}
            </a>
          );
        })}
      </div>
    );
  }

  return (
    <Card className="overflow-hidden border-white/10 bg-slate-950/50 text-card-foreground shadow-glow backdrop-blur">
      <CardHeader className="flex flex-col gap-4 border-b border-white/10 bg-white/5 md:flex-row md:items-end md:justify-between">
        <div>
          <CardTitle className="text-2xl text-white">Contributors</CardTitle>
          <CardDescription className="mt-2 max-w-2xl text-slate-300">
            People behind the tracked GitHub issues and pull requests, highlighted for attribution across the Municipio ecosystem.
          </CardDescription>
        </div>
        <div className="inline-flex items-center gap-2 rounded-full bg-fuchsia-400/15 px-4 py-2 text-sm font-medium text-fuchsia-100 ring-1 ring-fuchsia-300/30">
          <Users className="h-4 w-4" />
          {visibleAuthors.length} authors
        </div>
      </CardHeader>
      <CardContent className="p-6">
        {visibleAuthors.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/15 bg-white/5 p-8 text-center text-slate-300">
            No authors match the current search.
          </div>
        ) : (
          <div className="space-y-8">
            {activeAuthors.length > 0 ? (
              <section className="space-y-4" aria-label="Contributors">
                <div>
                  <h3 className="text-lg font-semibold text-white">Contributors</h3>
                  <p className="mt-1 text-sm text-slate-400">
                    Contributors with open issues or pull requests.
                  </p>
                </div>
                {renderAuthors(activeAuthors)}
              </section>
            ) : null}
            {historicAuthors.length > 0 ? (
              <section className="space-y-4" aria-label="Contributors">
                <div>
                  <h3 className="text-lg font-semibold text-white">Contributors</h3>
                  <p className="mt-1 text-sm text-slate-400">
                    Remaining contributors are shown alphabetically to keep the full author directory available.
                  </p>
                </div>
                {renderAuthors(historicAuthors)}
              </section>
            ) : null}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function formatDateOnly(value) {
  if (!value) {
    return 'Unknown date';
  }

  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(`${value}T00:00:00Z`));
}

function formatSprintRange(startDate, endDate) {
  return `${formatDateOnly(startDate)} - ${formatDateOnly(endDate)}`;
}

function SprintPanel({ payload, searchQuery }) {
  const currentSprintItems = filterSprintItems(payload?.currentSprint?.items ?? [], searchQuery);
  const nextSprintItems = filterSprintItems(payload?.nextSprint?.items ?? [], searchQuery);
  const visibleItemCount = currentSprintItems.length + nextSprintItems.length;

  function renderSprintSection(sprint, visibleItems) {
    if (!sprint) {
      return (
        <div className="rounded-2xl border border-dashed border-white/15 bg-white/5 p-8 text-center text-slate-300">
          No sprint data is available for this section.
        </div>
      );
    }

    return (
      <section className="space-y-4">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-white">{sprint.label}</h3>
            <p className="text-sm text-slate-400">{sprint.title}</p>
          </div>
          <div className="flex items-center gap-3 text-sm text-slate-400">
            <span>{formatSprintRange(sprint.startDate, sprint.endDate)}</span>
            <Badge variant="secondary">{visibleItems.length} linked item{visibleItems.length === 1 ? '' : 's'}</Badge>
          </div>
        </div>

        {visibleItems.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/15 bg-white/5 p-6 text-center text-slate-300">
            No linked issues or pull requests match the current search.
          </div>
        ) : (
          <div className="grid gap-4 xl:grid-cols-2">
            {visibleItems.map((item) => (
              <a
                key={item.url}
                href={item.url}
                target="_blank"
                rel="noreferrer"
                className="group rounded-3xl border border-white/10 bg-slate-900/70 p-5 transition-colors hover:border-cyan-300/40 hover:bg-slate-900"
              >
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1 space-y-3">
                    <div>
                      <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-slate-500">
                        <span>{item.type}</span>
                        <span>#{item.number}</span>
                      </div>
                      <h4 className="mt-2 text-lg font-semibold text-white">{item.title}</h4>
                      <p className="mt-1 text-sm text-slate-400">{item.repository}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="secondary">{item.status || 'No status'}</Badge>
                      <Badge variant="secondary">{item.state}</Badge>
                    </div>
                  </div>
                  <ArrowUpRight className="mt-1 h-4 w-4 shrink-0 text-slate-500 transition-colors group-hover:text-cyan-200" />
                </div>
              </a>
            ))}
          </div>
        )}
      </section>
    );
  }

  return (
    <Card className="overflow-hidden border-white/10 bg-slate-950/50 text-card-foreground shadow-glow backdrop-blur">
      <CardHeader className="flex flex-col gap-4 border-b border-white/10 bg-white/5 md:flex-row md:items-end md:justify-between">
        <div>
          <CardTitle className="text-2xl text-white">Sprints</CardTitle>
          <CardDescription className="mt-2 max-w-2xl text-slate-300">
            Linked issues and pull requests from the GitHub project board, grouped by the active and upcoming sprint iterations.
          </CardDescription>
        </div>
        <div className="inline-flex items-center gap-2 rounded-full bg-cyan-400/15 px-4 py-2 text-sm font-medium text-cyan-100 ring-1 ring-cyan-300/30">
          <CalendarDays className="h-4 w-4" />
          {visibleItemCount} sprint item{visibleItemCount === 1 ? '' : 's'}
        </div>
      </CardHeader>
      <CardContent className="space-y-8 p-6">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
          <div className="space-y-2">
            <p className="text-sm font-medium text-white">{payload?.project?.title || 'GitHub Project'}</p>
            <p className="text-sm text-slate-400">
              {payload?.view?.name ? `View: ${payload.view.name}` : 'Default project view'}
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-300">
            <span className="font-medium text-white">Current filter:</span>{' '}
            {payload?.currentFilter || 'No filter exposed by GitHub for this view.'}
          </div>
        </div>
        {renderSprintSection(payload?.currentSprint, currentSprintItems)}
        {renderSprintSection(payload?.nextSprint, nextSprintItems)}
      </CardContent>
    </Card>
  );
}

function SourcePanel({ payload, icon: Icon, accentClassName, searchQuery }) {
  const [panelPreferences, setPanelPreferences] = useState(() => readSourcePanelPreferences(payload.source));
  const { filters, viewMode, expandedTreeItems } = panelPreferences;
  const availableItems = Array.isArray(payload.items) ? payload.items : [];
  const filterOptions = getFilterOptions(availableItems);
  const visibleItems = filterItems(availableItems, filters, searchQuery);
  const repositoryGroups = getRepositoryGroups(visibleItems);
  const treeItems = getItemTree(visibleItems);
  const milestoneGroups = getMilestoneGroups(treeItems);
  const trackedTopics = Array.isArray(payload.topics) ? payload.topics.join(', ') : '';
  const canClear = hasCustomPanelPreferences(filters, viewMode, expandedTreeItems);

  useEffect(() => {
    setPanelPreferences(readSourcePanelPreferences(payload.source));
  }, [payload.source]);

  useEffect(() => {
    const availableItemUrls = new Set(
      availableItems
        .map((item) => item.url)
        .filter((url) => typeof url === 'string' && url !== ''),
    );

    setPanelPreferences((currentPreferences) => {
      const nextExpandedTreeItems = currentPreferences.expandedTreeItems.filter((url) => availableItemUrls.has(url));

      if (nextExpandedTreeItems.length === currentPreferences.expandedTreeItems.length) {
        return currentPreferences;
      }

      return {
        ...currentPreferences,
        expandedTreeItems: nextExpandedTreeItems,
      };
    });
  }, [availableItems]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const storageKey = getSourcePanelStorageKey(payload.source);

    try {
      if (!hasCustomPanelPreferences(filters, viewMode, expandedTreeItems)) {
        window.localStorage.removeItem(storageKey);
        return;
      }

      window.localStorage.setItem(storageKey, JSON.stringify({ filters, viewMode, expandedTreeItems }));
    } catch {
      // Ignore local storage write failures so the dashboard remains usable.
    }
  }, [expandedTreeItems, filters, payload.source, viewMode]);

  const updateFilter = (name, value) => {
    setPanelPreferences((currentPreferences) => ({
      ...currentPreferences,
      filters: {
        ...currentPreferences.filters,
        [name]: value,
      },
    }));
  };

  const updateViewMode = (nextViewMode) => {
    setPanelPreferences((currentPreferences) => ({
      ...currentPreferences,
      viewMode: normalizeViewMode(nextViewMode),
    }));
  };

  const toggleTreeItem = (itemUrl) => {
    setPanelPreferences((currentPreferences) => {
      const isExpanded = currentPreferences.expandedTreeItems.includes(itemUrl);

      return {
        ...currentPreferences,
        expandedTreeItems: isExpanded
          ? currentPreferences.expandedTreeItems.filter((url) => url !== itemUrl)
          : [...currentPreferences.expandedTreeItems, itemUrl],
      };
    });
  };

  const clearPreferences = () => {
    setPanelPreferences(getDefaultSourcePanelPreferences());
  };

  const itemCountLabel = `${visibleItems.length} of ${payload.count} open ${payload.source.replace('-', ' ')}`;

  const filterBar = (
    <FilterBar
      filters={filters}
      filterOptions={filterOptions}
      onFilterChange={updateFilter}
      viewMode={viewMode}
      onViewModeChange={updateViewMode}
      onClear={clearPreferences}
      canClear={canClear}
    />
  );

  const listGroupAccents = [
    { dot: 'bg-yellow-400', badge: 'bg-yellow-400/10 text-yellow-200 ring-1 ring-yellow-400/25' },
    { dot: 'bg-orange-400', badge: 'bg-orange-400/10 text-orange-200 ring-1 ring-orange-400/25' },
    { dot: 'bg-rose-500', badge: 'bg-rose-500/10 text-rose-200 ring-1 ring-rose-500/25' },
    { dot: 'bg-cyan-400', badge: 'bg-cyan-400/10 text-cyan-200 ring-1 ring-cyan-400/25' },
    { dot: 'bg-violet-400', badge: 'bg-violet-400/10 text-violet-200 ring-1 ring-violet-400/25' },
  ];

  const itemContent = viewMode === 'list' ? (
    <div className="source-panel__stack overflow-hidden rounded-2xl border border-white/10 bg-slate-900/60">
      {milestoneGroups.map(({ milestone, items }, groupIndex) => {
        const visibleTreeItemCount = countTreeItems(items);
        const accent = listGroupAccents[groupIndex % listGroupAccents.length];

        return (
          <section key={milestone} className="border-b border-white/[0.06] last:border-b-0">
            <div className="flex items-center gap-3 bg-white/[0.025] px-3 py-2">
              <div className={`h-2.5 w-2.5 shrink-0 rounded-sm ${accent.dot}`} />
              <h3 className={`inline-flex items-center rounded px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider ${accent.badge}`}>
                {milestone}
              </h3>
              <span className="text-xs text-slate-600">{visibleTreeItemCount}</span>
            </div>

            <div className="flex items-center border-b border-white/[0.06] text-[10px] uppercase tracking-wider text-slate-600">
              <div className="w-7 shrink-0" />
              <div className="w-6 shrink-0" />
              <div className="flex-1 py-1.5 pr-3">Name</div>
              <div className="w-52 shrink-0 py-1.5">Repository</div>
              <div className="w-20 shrink-0 py-1.5">Assignee</div>
              <div className="w-28 shrink-0 py-1.5">Created</div>
              <div className="w-8 shrink-0" />
            </div>

            <ul>
              {items.map((item) => (
                <TrackedItemListRow
                  key={item.url}
                  item={item}
                  expandedTreeItems={expandedTreeItems}
                  onToggleExpand={toggleTreeItem}
                />
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  ) : (
    <div className="source-panel__stack space-y-4">
      {repositoryGroups.map(({ repository, items }) => (
        <section
          key={repository}
          className="rounded-3xl border border-white/10 bg-slate-900/70 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]"
        >
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-cyan-300/10 p-2 text-cyan-200">
                <FolderKanban className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">{repository}</h3>
                <p className="text-sm text-slate-400">{items.length} tracked item{items.length === 1 ? '' : 's'}</p>
              </div>
            </div>
            <Badge variant="secondary">{items.length}</Badge>
          </div>
          <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {items.map((item) => (
              <TrackedItemCard key={item.url} item={item} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden border-white/10 bg-slate-950/50 text-card-foreground shadow-glow backdrop-blur">
        <CardHeader className="flex flex-col gap-4 border-b border-white/10 bg-white/5 md:flex-row md:items-end md:justify-between">
          <div>
            <CardTitle className="text-2xl text-white">{itemCountLabel}</CardTitle>
            <CardDescription className="mt-2 max-w-2xl text-slate-300">
              Collected from repositories tagged <span className="font-semibold text-white">{trackedTopics}</span> in the{' '}
              <span className="font-semibold text-white">{payload.sourceScope}</span> scope.
            </CardDescription>
          </div>
          <div className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium ${accentClassName}`}>
            <Icon className="h-4 w-4" />
            {repositoryGroups.length} repositories
          </div>
        </CardHeader>
        <CardContent className="p-6">
          {repositoryGroups.length === 0 ? (
            <div className="space-y-4">
              {filterBar}

              <div className="rounded-2xl border border-dashed border-white/15 bg-white/5 p-8 text-center text-slate-300">
                No items match the current filters.
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {filterBar}
              {itemContent}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

async function fetchDataFile(path) {
  const response = await fetch(`${import.meta.env.BASE_URL}data/${path}`);
  if (!response.ok) {
    throw new Error(`Failed to load ${path} (${response.status})`);
  }

  return response.json();
}

async function fetchOptionalDataFile(path) {
  const response = await fetch(`${import.meta.env.BASE_URL}data/${path}`);

  if (!response.ok) {
    return null;
  }

  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.toLowerCase().includes('application/json')) {
    return null;
  }

  return response.json();
}

async function fetchSource(key) {
  return fetchDataFile(`${key}.json`);
}

export default function App() {
  const [payloads, setPayloads] = useState({});
  const [sprintPayload, setSprintPayload] = useState(null);
  const [releasePageIndex, setReleasePageIndex] = useState(null);
  const [releasePagePayload, setReleasePagePayload] = useState(null);
  const [activeReleasePageNumber, setActiveReleasePageNumber] = useState(1);
  const [isLoadingReleasePage, setIsLoadingReleasePage] = useState(false);
  const [status, setStatus] = useState('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [activeMainTab, setActiveMainTab] = useState(readMainTabFromUrl);
  const [searchQuery, setSearchQuery] = useState('');
  const payloadList = Object.values(payloads);
  const buildStatusTabs = [...sources, sprintTab, releaseTab];
  const allItems = payloadList.flatMap((payload) => (
    Array.isArray(payload.items)
      ? payload.items.map((item) => ({ ...item, source: payload.source }))
      : []
  ));
  const repositories = getRepositoryCatalog(payloadList);
  const authors = getAuthorDirectory(payloadList, allItems);
  useEffect(() => {
    let isActive = true;

    async function loadDashboard() {
      try {
        setStatus('loading');
        const [entries, nextSprintPayload, nextReleasePageIndex] = await Promise.all([
          Promise.all(sources.map(async (source) => [source.key, await fetchSource(source.key)])),
          fetchOptionalDataFile('sprints.json'),
          fetchDataFile('releases/pageIndex.json'),
        ]);

        const firstReleasePageFile = nextReleasePageIndex?.pages?.[0]?.file;
        const nextReleasePagePayload = firstReleasePageFile
          ? await fetchDataFile(`releases/${firstReleasePageFile}`)
          : null;

        if (!isActive) {
          return;
        }

        setPayloads(Object.fromEntries(entries));
        setSprintPayload(nextSprintPayload);
        setReleasePageIndex(nextReleasePageIndex);
        setReleasePagePayload(nextReleasePagePayload);
        setActiveReleasePageNumber(nextReleasePagePayload?.pageNumber ?? 1);
        setStatus('ready');
      } catch (error) {
        if (!isActive) {
          return;
        }

        setErrorMessage(error instanceof Error ? error.message : 'Unknown error while loading dashboard data.');
        setStatus('error');
      }
    }

    loadDashboard();

    return () => {
      isActive = false;
    };
  }, []);

  const loadReleasePage = async (pageNumber) => {
    const pages = Array.isArray(releasePageIndex?.pages) ? releasePageIndex.pages : [];
    const nextPage = pages.find((page) => page.pageNumber === pageNumber);

    if (!nextPage || nextPage.pageNumber === activeReleasePageNumber) {
      return;
    }

    setIsLoadingReleasePage(true);

    try {
      const nextPagePayload = await fetchDataFile(`releases/${nextPage.file}`);
      setReleasePagePayload(nextPagePayload);
      setActiveReleasePageNumber(nextPage.pageNumber);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unknown error while loading release page.');
      setStatus('error');
    } finally {
      setIsLoadingReleasePage(false);
    }
  };

  useEffect(() => {
    writeMainTabToUrl(activeMainTab);
  }, [activeMainTab]);

  useEffect(() => {
    function syncMainTabFromUrl() {
      setActiveMainTab(readMainTabFromUrl());
    }

    window.addEventListener('popstate', syncMainTabFromUrl);

    return () => {
      window.removeEventListener('popstate', syncMainTabFromUrl);
    };
  }, []);

  const generatedAt = payloadList
    .concat(releasePageIndex ? [releasePageIndex] : [])
    .map((payload) => payload.generatedAt)
    .filter(Boolean)
    .sort()
    .at(-1);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(34,211,238,0.18),_transparent_28%),linear-gradient(180deg,_#020617_0%,_#0f172a_50%,_#111827_100%)] text-foreground">
      <div className="mx-auto flex min-h-screen flex-col px-4 py-8 sm:px-6 lg:px-8">
        <header className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-white/5 p-6 shadow-glow backdrop-blur md:p-10">
          <div className="absolute inset-x-0 top-0 h-40 bg-[radial-gradient(circle_at_top_right,_rgba(244,114,182,0.25),_transparent_45%)]" />
          <div className="relative grid gap-8 lg:grid-cols-[1.6fr_0.8fr] lg:items-end">
            <div className="space-y-4">
              <Badge className="bg-cyan-300/15 text-cyan-100 ring-1 ring-cyan-200/30">Municipio</Badge>
              <div className="space-y-3">
                <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-white md:text-6xl">
                  Project overview
                </h1>
                <p className="max-w-2xl text-base text-slate-300 md:text-lg">
                  A dashboard that visualizes open GitHub issues and pull requests related to the Municipio project across multiple organizations.
                </p>
              </div>
            </div>

            <Card className="border-white/10 bg-slate-950/60 text-card-foreground">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg text-white">
                  <RefreshCcw className="h-4 w-4 text-cyan-200" />
                  Build status
                </CardTitle>
                <CardDescription className="text-slate-400">
                  {generatedAt ? `Last data refresh ${formatTimestamp(generatedAt)}` : 'Run the aggregator to generate the JSON sources.'}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-3 text-sm text-slate-300">
                {buildStatusTabs.map((tab) => (
                  <div key={tab.key} className="flex min-w-[9rem] flex-1 items-center justify-between gap-3 rounded-2xl bg-white/5 px-4 py-3">
                    <span>{tab.label}</span>
                    <span className="font-semibold text-white">{tab.key === releaseTab.key ? releasePageIndex?.count ?? 0 : tab.key === sprintTab.key ? sprintPayload?.count ?? 0 : payloads[tab.key]?.count ?? 0}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </header>

        <main className="flex-1 py-8">
          {status === 'loading' && (
            <div className="grid gap-4 md:grid-cols-3">
              {buildStatusTabs.map((source) => (
                <div key={source.key} className="h-64 animate-pulse rounded-[1.75rem] border border-white/10 bg-white/5" />
              ))}
            </div>
          )}

          {status === 'error' && (
            <Card className="border-rose-400/30 bg-rose-500/10 text-rose-50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-rose-100">
                  <AlertCircle className="h-5 w-5" />
                  Dashboard data is unavailable
                </CardTitle>
                <CardDescription className="text-rose-100/80">
                  {errorMessage}. Run <span className="font-semibold text-white">npm run build:data</span> before starting the UI.
                </CardDescription>
              </CardHeader>
            </Card>
          )}

          {status === 'ready' && (
            <Tabs value={activeMainTab} onValueChange={setActiveMainTab} className="space-y-6">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                <TabsList
                  className="main-tabs grid w-full max-w-5xl grid-flow-col auto-cols-fr rounded-full border border-white/10 bg-slate-950/60 p-1"
                >
                  {mainTabs.map((tab) => {
                    const Icon = tab.icon;
                    return (
                      <TabsTrigger
                        key={tab.key}
                        value={tab.key}
                        className="main-tabs__trigger min-w-0 rounded-full px-2 py-2.5 text-xs data-[state=active]:bg-white data-[state=active]:text-slate-950 sm:text-sm"
                      >
                        <Icon className="main-tabs__icon h-4 w-4 shrink-0" />
                        <span className="main-tabs__label truncate">{tab.label}</span>
                      </TabsTrigger>
                    );
                  })}
                </TabsList>
                <div className="xl:flex xl:justify-end">
                  <GlobalSearchInput value={searchQuery} onChange={setSearchQuery} />
                </div>
              </div>

              {sources.map((source) => {
                const Icon = source.icon;
                return (
                  <TabsContent key={source.key} value={source.key}>
                    <SourcePanel
                      payload={payloads[source.key]}
                      icon={Icon}
                      accentClassName={source.accent}
                      searchQuery={searchQuery}
                    />
                  </TabsContent>
                );
              })}

              <TabsContent value="sprints">
                <SprintPanel payload={sprintPayload} searchQuery={searchQuery} />
              </TabsContent>

              <TabsContent value="repositories">
                <RepositoryCatalogPanel repositories={repositories} searchQuery={searchQuery} />
              </TabsContent>

              <TabsContent value="releases">
                <ReleaseTimelinePanel
                  pageIndex={releasePageIndex}
                  pagePayload={releasePagePayload}
                  searchQuery={searchQuery}
                  currentPageNumber={activeReleasePageNumber}
                  onPageChange={loadReleasePage}
                  isLoadingPage={isLoadingReleasePage}
                />
              </TabsContent>

              <TabsContent value="authors">
                <AuthorDirectoryPanel authors={authors} searchQuery={searchQuery} />
              </TabsContent>
            </Tabs>
          )}
        </main>
      </div>
    </div>
  );
}
