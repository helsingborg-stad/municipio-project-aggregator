import { AlertCircle, ArrowUpRight, FolderKanban, GitPullRequest, RefreshCcw, Ticket } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatRelativeTime, formatTimestamp, getRepositoryGroups } from '@/lib/dashboard';

const sources = [
  { key: 'issues', label: 'Issues', icon: Ticket, accent: 'bg-rose-500/15 text-rose-200 ring-1 ring-rose-400/30' },
  { key: 'pull-requests', label: 'Pull Requests', icon: GitPullRequest, accent: 'bg-emerald-500/15 text-emerald-200 ring-1 ring-emerald-400/30' },
];

function SourcePanel({ payload, icon: Icon, accentClassName }) {
  const repositoryGroups = getRepositoryGroups(payload.items);
  const trackedTopics = Array.isArray(payload.topics) ? payload.topics.join(', ') : '';

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden border-white/10 bg-slate-950/50 text-card-foreground shadow-glow backdrop-blur">
        <CardHeader className="flex flex-col gap-4 border-b border-white/10 bg-white/5 md:flex-row md:items-end md:justify-between">
          <div>
            <CardTitle className="text-2xl text-white">{payload.count} open {payload.source.replace('-', ' ')}</CardTitle>
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
            <div className="rounded-2xl border border-dashed border-white/15 bg-white/5 p-8 text-center text-slate-300">
              No items available for this source yet.
            </div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
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
                      <li key={item.url} className="rounded-2xl border border-white/10 bg-white/5 p-4 transition-colors hover:border-cyan-300/40 hover:bg-white/10">
                        <a href={item.url} target="_blank" rel="noreferrer" className="group flex items-start justify-between gap-3">
                          <div>
                            <h4 className="text-sm font-medium text-slate-100 transition-colors group-hover:text-white">
                              {item.title}
                            </h4>
                            <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-400">
                              <span>{formatRelativeTime(item.createdAt)}</span>
                              <span className="text-slate-600">/</span>
                              <span>{formatTimestamp(item.createdAt)}</span>
                            </div>
                          </div>
                          <ArrowUpRight className="mt-0.5 h-4 w-4 shrink-0 text-slate-500 transition-colors group-hover:text-cyan-200" />
                        </a>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
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

  const generatedAt = Object.values(payloads)
    .map((payload) => payload.generatedAt)
    .filter(Boolean)
    .sort()
    .at(-1);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(34,211,238,0.18),_transparent_28%),linear-gradient(180deg,_#020617_0%,_#0f172a_50%,_#111827_100%)] text-foreground">
      <div className="mx-auto flex min-h-screen max-w-7xl flex-col px-4 py-8 sm:px-6 lg:px-8">
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
              <TabsList className="grid w-full max-w-xl grid-cols-2 rounded-full border border-white/10 bg-slate-950/60 p-1">
                {sources.map((source) => {
                  const Icon = source.icon;
                  return (
                    <TabsTrigger key={source.key} value={source.key} className="rounded-full data-[state=active]:bg-white data-[state=active]:text-slate-950">
                      <Icon className="mr-2 h-4 w-4" />
                      {source.label}
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
            </Tabs>
          )}
        </main>
      </div>
    </div>
  );
}