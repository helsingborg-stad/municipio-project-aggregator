import { AlertCircle, ArrowUpRight, FolderKanban, GitPullRequest, LayoutGrid, List, RefreshCcw, RotateCcw, Ticket, Users } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  filterItems,
  formatRelativeTime,
  formatTimestamp,
  getAuthorDirectory,
  getFilterOptions,
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
 * Reads saved source panel preferences from local storage.
 *
 * @param {string} source
 * @returns {{filters: typeof emptyFilters, viewMode: 'cards' | 'list'}}
 */
function readSourcePanelPreferences(source) {
  if (typeof window === 'undefined') {
    return { filters: getEmptyFilters(), viewMode: defaultViewMode };
  }

  try {
    const rawPreferences = window.localStorage.getItem(getSourcePanelStorageKey(source));

    if (!rawPreferences) {
      return { filters: getEmptyFilters(), viewMode: defaultViewMode };
    }

    const parsedPreferences = JSON.parse(rawPreferences);

    return {
      filters: normalizeStoredFilters(parsedPreferences.filters),
      viewMode: normalizeViewMode(parsedPreferences.viewMode),
    };
  } catch {
    return { filters: getEmptyFilters(), viewMode: defaultViewMode };
  }
}

/**
 * Determines whether the current panel state differs from the defaults.
 *
 * @param {typeof emptyFilters} filters
 * @param {'cards' | 'list'} viewMode
 * @returns {boolean}
 */
function hasCustomPanelPreferences(filters, viewMode) {
  return Object.entries(emptyFilters).some(([name, value]) => filters[name] !== value) || viewMode !== defaultViewMode;
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
    <div className="flex items-center gap-2 rounded-full bg-white/5 px-2.5 py-1 text-xs text-slate-200 ring-1 ring-white/10">
      <AvatarImage person={person} />
      <span>
        {fallbackLabel ? `${fallbackLabel}: ` : ''}
        {person.login}
      </span>
    </div>
  );
}

function AssigneeStack({ assignees }) {
  if (!assignees?.length) {
    return <span className="text-xs text-slate-500">No assignees</span>;
  }

  return (
    <div className="flex flex-wrap gap-2">
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
        <div className="inline-flex w-full rounded-2xl border border-white/10 bg-slate-950/70 p-1 text-sm lg:w-auto">
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
  return (
    <div className="source-item-card__details grid gap-3 rounded-2xl border border-white/10 bg-slate-950/45 p-3 text-sm text-slate-300">
      <div className="source-item-card__meta-row flex flex-wrap items-center gap-2">
        <Avatar person={item.author} fallbackLabel="Author" />
      </div>
      <div className="source-item-card__meta-section space-y-2">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-500">Assignees</p>
        <AssigneeStack assignees={item.assignees} />
      </div>
      <div className="source-item-card__stats grid gap-2 text-xs text-slate-400">
        <div className="rounded-2xl bg-white/5 px-3 py-2">
          <span className="block text-slate-500">Sub-issues</span>
          <span className="font-medium text-slate-100">
            {item.subIssues.completed}/{item.subIssues.total} completed
          </span>
        </div>
        <div className="rounded-2xl bg-white/5 px-3 py-2">
          <span className="block text-slate-500">Dependencies</span>
          <span className="font-medium text-slate-100">
            {item.relationshipSummary.totalBlockedBy} blocked by, {item.relationshipSummary.totalBlocking} blocking
          </span>
        </div>
      </div>
      {item.relationships?.length ? (
        <div className="space-y-2">
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
                  <Badge variant="secondary">{relationship.event}</Badge>
                </a>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function TrackedItemCard({ item, showRepository = false }) {
  return (
    <li className="source-item-card rounded-2xl border border-white/10 bg-white/5 p-4 transition-colors hover:border-cyan-300/40 hover:bg-white/10">
      <div className="source-item-card__content space-y-4">
        <a
          href={item.url}
          target="_blank"
          rel="noreferrer"
          className="source-item-card__link group flex items-start justify-between gap-3"
        >
          <div className="source-item-card__summary min-w-0">
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
          <ArrowUpRight className="source-item-card__icon mt-0.5 h-4 w-4 shrink-0 text-slate-500 transition-colors group-hover:text-cyan-200" />
        </a>

        <ItemDetailPanel item={item} />
      </div>
    </li>
  );
}

function RepositoryCatalogPanel({ repositories }) {
  const repositoryCardClassName = 'rounded-3xl border border-white/10 bg-slate-900/70 p-5';

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
          {repositories.length} repositories
        </div>
      </CardHeader>
      <CardContent className="p-6">
        {repositories.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/15 bg-white/5 p-8 text-center text-slate-300">
            No compatible repositories are available yet.
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {repositories.map((repository) => {
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

function AuthorDirectoryPanel({ authors }) {
  const authorCardClassName = 'rounded-3xl border border-white/10 bg-slate-900/70 p-5';

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
          {authors.length} authors
        </div>
      </CardHeader>
      <CardContent className="p-6">
        {authors.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/15 bg-white/5 p-8 text-center text-slate-300">
            No authors are available yet.
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {authors.map((author) => {
              const content = (
                <div className={author.url ? `group ${authorCardClassName} transition-colors hover:border-fuchsia-300/40 hover:bg-slate-900` : authorCardClassName}>
                  <div className="flex items-center gap-4">
                    <AvatarImage person={author} sizeClassName="h-14 w-14" fallbackTextClassName="text-base" />
                    <div className="min-w-0">
                      <h3 className="truncate text-lg font-semibold text-white">{author.login}</h3>
                      <p className="text-sm text-slate-400">
                        {author.contributionCount} tracked contribution{author.contributionCount === 1 ? '' : 's'}
                      </p>
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
        )}
      </CardContent>
    </Card>
  );
}

function SourcePanel({ payload, icon: Icon, accentClassName }) {
  const [panelPreferences, setPanelPreferences] = useState(() => readSourcePanelPreferences(payload.source));
  const { filters, viewMode } = panelPreferences;
  const availableItems = Array.isArray(payload.items) ? payload.items : [];
  const filterOptions = getFilterOptions(availableItems);
  const visibleItems = filterItems(availableItems, filters);
  const repositoryGroups = getRepositoryGroups(visibleItems);
  const trackedTopics = Array.isArray(payload.topics) ? payload.topics.join(', ') : '';
  const canClear = hasCustomPanelPreferences(filters, viewMode);

  useEffect(() => {
    setPanelPreferences(readSourcePanelPreferences(payload.source));
  }, [payload.source]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const storageKey = getSourcePanelStorageKey(payload.source);

    try {
      if (!hasCustomPanelPreferences(filters, viewMode)) {
        window.localStorage.removeItem(storageKey);
        return;
      }

      window.localStorage.setItem(storageKey, JSON.stringify({ filters, viewMode }));
    } catch {
      // Ignore local storage write failures so the dashboard remains usable.
    }
  }, [filters, payload.source, viewMode]);

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

  const clearPreferences = () => {
    setPanelPreferences({
      filters: getEmptyFilters(),
      viewMode: defaultViewMode,
    });
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

  const itemContent = viewMode === 'list' ? (
    <ul className="source-panel__stack space-y-4">
      {visibleItems.map((item) => (
        <TrackedItemCard key={item.url} item={item} showRepository />
      ))}
    </ul>
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
          <ul className="space-y-3">
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

async function fetchSource(key) {
  const response = await fetch(`${import.meta.env.BASE_URL}data/${key}.json`);
  if (!response.ok) {
    throw new Error(`Failed to load ${key}.json (${response.status})`);
  }

  return response.json();
}

export default function App() {
  const [payloads, setPayloads] = useState({});
  const [status, setStatus] = useState('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const payloadList = Object.values(payloads);
  const allItems = payloadList.flatMap((payload) => Array.isArray(payload.items) ? payload.items : []);
  const repositories = getRepositoryCatalog(payloadList);
  const authors = getAuthorDirectory(allItems);
  const tabs = [
    ...sources,
    { key: 'repositories', label: 'Repositories', icon: FolderKanban },
    { key: 'authors', label: 'Authors', icon: Users },
  ];

  useEffect(() => {
    let isActive = true;

    async function loadDashboard() {
      try {
        setStatus('loading');
        const entries = await Promise.all(sources.map(async (source) => [source.key, await fetchSource(source.key)]));

        if (!isActive) {
          return;
        }

        setPayloads(Object.fromEntries(entries));
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

  const generatedAt = payloadList
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
              <Badge className="bg-cyan-300/15 text-cyan-100 ring-1 ring-cyan-200/30">Municipio project radar</Badge>
              <div className="space-y-3">
                <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-white md:text-6xl">
                  Municipio Project Status
                </h1>
                <p className="max-w-2xl text-base text-slate-300 md:text-lg">
                  A dashboard that visualizes open GitHub issues and pull requests related to the Municipio project across multiple repositories.
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
              <CardContent className="grid gap-3 text-sm text-slate-300">
                {sources.map((source) => (
                  <div key={source.key} className="flex items-center justify-between rounded-2xl bg-white/5 px-4 py-3">
                    <span>{source.label}</span>
                    <span className="font-semibold text-white">{payloads[source.key]?.count ?? 0}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </header>

        <main className="flex-1 py-8">
          {status === 'loading' && (
            <div className="grid gap-4 md:grid-cols-2">
              {sources.map((source) => (
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
            <Tabs defaultValue={sources[0].key} className="space-y-6">
              <TabsList
                className="grid w-full max-w-4xl grid-cols-2 rounded-3xl border border-white/10 bg-slate-950/60 p-1 sm:grid-cols-4 sm:rounded-full"
              >
                {tabs.map((tab) => {
                  const Icon = tab.icon;
                  return (
                    <TabsTrigger key={tab.key} value={tab.key} className="rounded-2xl py-3 data-[state=active]:bg-white data-[state=active]:text-slate-950 sm:rounded-full sm:py-2">
                      <Icon className="mr-2 h-4 w-4 shrink-0" />
                      {tab.label}
                    </TabsTrigger>
                  );
                })}
              </TabsList>

              {sources.map((source) => {
                const Icon = source.icon;
                return (
                  <TabsContent key={source.key} value={source.key}>
                    <SourcePanel
                      payload={payloads[source.key]}
                      icon={Icon}
                      accentClassName={source.accent}
                    />
                  </TabsContent>
                );
              })}

              <TabsContent value="repositories">
                <RepositoryCatalogPanel repositories={repositories} />
              </TabsContent>

              <TabsContent value="authors">
                <AuthorDirectoryPanel authors={authors} />
              </TabsContent>
            </Tabs>
          )}
        </main>
      </div>
    </div>
  );
}
