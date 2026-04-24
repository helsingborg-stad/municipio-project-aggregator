#!/usr/bin/env node

/**
 * Municipio Project Aggregator – Build Script
 *
 * Discovers GitHub repositories with the "getmunicipio" topic across all
 * organisations, fetches their open issues and pull requests via the
 * GitHub GraphQL API, then generates a static HTML file at dist/index.html.
 *
 * Requires the GITHUB_TOKEN environment variable to be set.
 */

'use strict';

const fs   = require('fs');
const path = require('path');
const https = require('https');

const TOPIC       = 'getmunicipio';
const GITHUB_API  = 'https://api.github.com/graphql';
const OUT_DIR     = path.join(__dirname, '..', 'dist');
const OUT_FILE    = path.join(OUT_DIR, 'index.html');
const PAGE_SIZE   = 100;

/**
 * Performs a single HTTPS POST request and resolves with the parsed JSON body.
 *
 * @param {string} url     - The URL to POST to.
 * @param {object} headers - HTTP headers to send.
 * @param {string} body    - The request body as a JSON string.
 * @returns {Promise<object>}
 */
function httpPost(url, headers, body) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname,
      method: 'POST',
      headers: {
        ...headers,
        'Content-Length': Buffer.byteLength(body),
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
          return;
        }
        try {
          resolve(JSON.parse(data));
        } catch (err) {
          reject(new Error(`Failed to parse response: ${data}`));
        }
      });
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

/**
 * Builds the GraphQL query for a single page of repository search results
 * filtered by the configured topic.
 *
 * @param {string|null} afterCursor - Pagination cursor (null for first page).
 * @returns {string} The GraphQL query string.
 */
function buildRepoQuery(afterCursor) {
  const queryStr = `topic:${TOPIC}`;
  const after    = afterCursor ? `, after: "${afterCursor}"` : '';

  return `{
    search(query: "${queryStr}", type: REPOSITORY, first: ${PAGE_SIZE}${after}) {
      pageInfo { hasNextPage endCursor }
      nodes {
        ... on Repository {
          nameWithOwner
          name
          owner { login }
        }
      }
    }
  }`;
}

/**
 * Builds the GraphQL query for a single page of issue or PR search results
 * within a specific repository.
 *
 * @param {'issue'|'pr'} type         - Whether to search for issues or pull requests.
 * @param {string}       repoFullName - Full repository name (owner/repo).
 * @param {string|null}  afterCursor  - Pagination cursor (null for first page).
 * @returns {string} The GraphQL query string.
 */
function buildItemQuery(type, repoFullName, afterCursor) {
  const isPr      = type === 'pr';
  const typeFlag  = isPr ? 'is:pr' : 'is:issue';
  const queryStr  = `repo:${repoFullName} ${typeFlag} is:open`;
  const after     = afterCursor ? `, after: "${afterCursor}"` : '';
  const fragment  = isPr
    ? `... on PullRequest { title url createdAt repository { nameWithOwner name } }`
    : `... on Issue       { title url createdAt repository { nameWithOwner name } }`;

  return `{
    search(query: "${queryStr}", type: ISSUE, first: ${PAGE_SIZE}${after}) {
      pageInfo { hasNextPage endCursor }
      nodes { ${fragment} }
    }
  }`;
}

/**
 * Executes a GraphQL query against the GitHub API.
 *
 * @param {string} token - GitHub personal access token / GITHUB_TOKEN.
 * @param {string} query - GraphQL query string.
 * @returns {Promise<object>} The `data` field of the GraphQL response.
 */
async function runQuery(token, query) {
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type':  'application/json',
    'User-Agent':    'municipio-project-aggregator/1.0',
  };

  const result = await httpPost(GITHUB_API, headers, JSON.stringify({ query }));

  if (result.errors) {
    throw new Error(`GraphQL errors: ${JSON.stringify(result.errors)}`);
  }

  return result.data;
}

/**
 * Fetches all repositories with the configured topic across all organisations.
 *
 * @param {string} token - GitHub token.
 * @returns {Promise<Array<{nameWithOwner: string, name: string, owner: string}>>}
 */
async function fetchRepositories(token) {
  const repos  = [];
  let cursor   = null;
  let hasNext  = true;

  while (hasNext) {
    const query = buildRepoQuery(cursor);
    const data  = await runQuery(token, query);
    const page  = data.search;

    for (const node of page.nodes) {
      if (node && node.nameWithOwner) {
        repos.push({
          nameWithOwner: node.nameWithOwner,
          name:          node.name,
          owner:         node.owner.login,
        });
      }
    }

    hasNext = page.pageInfo.hasNextPage;
    cursor  = page.pageInfo.endCursor;
  }

  return repos;
}

/**
 * Fetches all open items (issues or PRs) for a single repository.
 *
 * @param {string}       token        - GitHub token.
 * @param {'issue'|'pr'} type         - Search type.
 * @param {string}       repoFullName - Full repository name (owner/repo).
 * @returns {Promise<Array<{title: string, url: string, repository: string, createdAt: string}>>}
 */
async function fetchItemsForRepo(token, type, repoFullName) {
  const items  = [];
  let cursor   = null;
  let hasNext  = true;

  while (hasNext) {
    const query = buildItemQuery(type, repoFullName, cursor);
    const data  = await runQuery(token, query);
    const page  = data.search;

    for (const node of page.nodes) {
      if (node && node.title) {
        items.push({
          title:      node.title,
          url:        node.url,
          repository: node.repository.nameWithOwner,
          createdAt:  node.createdAt,
        });
      }
    }

    hasNext = page.pageInfo.hasNextPage;
    cursor  = page.pageInfo.endCursor;
  }

  return items;
}

/**
 * Formats an ISO 8601 date string as a human-readable relative age,
 * e.g. "3 days ago" or "2 hours ago".
 *
 * @param {string} isoDate - ISO 8601 date string.
 * @returns {string} Human-readable relative time.
 */
function relativeTime(isoDate) {
  const diffMs      = Date.now() - new Date(isoDate).getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours   = Math.floor(diffMinutes / 60);
  const diffDays    = Math.floor(diffHours / 24);
  const diffWeeks   = Math.floor(diffDays / 7);
  const diffMonths  = Math.floor(diffDays / 30);
  const diffYears   = Math.floor(diffDays / 365);

  if (diffYears   >= 1) return `${diffYears} year${diffYears   > 1 ? 's' : ''} ago`;
  if (diffMonths  >= 1) return `${diffMonths} month${diffMonths > 1 ? 's' : ''} ago`;
  if (diffWeeks   >= 1) return `${diffWeeks} week${diffWeeks   > 1 ? 's' : ''} ago`;
  if (diffDays    >= 1) return `${diffDays} day${diffDays      > 1 ? 's' : ''} ago`;
  if (diffHours   >= 1) return `${diffHours} hour${diffHours   > 1 ? 's' : ''} ago`;
  if (diffMinutes >= 1) return `${diffMinutes} minute${diffMinutes > 1 ? 's' : ''} ago`;
  return 'just now';
}

/**
 * Escapes special HTML characters to prevent XSS.
 *
 * @param {string} str - Raw string.
 * @returns {string} HTML-safe string.
 */
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Renders a list of items (issues or PRs) as an HTML unordered list,
 * grouped by repository.
 *
 * @param {Array<{title: string, url: string, repository: string, createdAt: string}>} items
 * @returns {string} HTML string.
 */
function renderGroupedList(items) {
  if (items.length === 0) {
    return '<p class="empty-state">No open items found.</p>';
  }

  const grouped = items.reduce((acc, item) => {
    if (!acc[item.repository]) {
      acc[item.repository] = [];
    }
    acc[item.repository].push(item);
    return acc;
  }, {});

  const repoNames = Object.keys(grouped).sort((a, b) => a.localeCompare(b));

  return repoNames.map((repo) => {
    const repoItems = grouped[repo];
    const listItems = repoItems.map((item) => {
      const age          = relativeTime(item.createdAt);
      const isoFormatted = new Date(item.createdAt).toISOString().slice(0, 10);
      return `
        <li class="item">
          <a class="item__title" href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(item.title)}</a>
          <span class="item__meta">
            <time class="item__date" datetime="${escapeHtml(item.createdAt)}" title="${isoFormatted}">${escapeHtml(age)}</time>
          </span>
        </li>`;
    }).join('');

    return `
      <section class="repo-group">
        <h3 class="repo-group__name">${escapeHtml(repo)}</h3>
        <ul class="item-list">${listItems}
        </ul>
      </section>`;
  }).join('');
}

/**
 * Generates the full HTML page as a string.
 *
 * @param {Array<object>} issues - Normalised issue objects.
 * @param {Array<object>} prs    - Normalised pull-request objects.
 * @returns {string} Complete HTML document.
 */
function generateHtml(issues, prs) {
  const updatedAt       = new Date().toUTCString();
  const issueCount      = issues.length;
  const prCount         = prs.length;
  const issuesHtml      = renderGroupedList(issues);
  const prsHtml         = renderGroupedList(prs);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Municipio Issues &amp; PRs</title>
  <style>
    /* =========================================================
       Base / Reset
       ========================================================= */
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    /* =========================================================
       Settings – custom properties
       ========================================================= */
    :root {
      --color-bg:          #f5f7fa;
      --color-surface:     #ffffff;
      --color-border:      #e1e4e8;
      --color-primary:     #0366d6;
      --color-primary-dk:  #0256b9;
      --color-text:        #24292e;
      --color-muted:       #586069;
      --color-tag-issue:   #d73a49;
      --color-tag-pr:      #28a745;
      --radius:            6px;
      --shadow:            0 1px 3px rgba(0,0,0,.08);
    }

    @media (prefers-color-scheme: dark) {
      :root {
        --color-bg:      #0d1117;
        --color-surface: #161b22;
        --color-border:  #30363d;
        --color-primary: #58a6ff;
        --color-primary-dk: #79b8ff;
        --color-text:    #c9d1d9;
        --color-muted:   #8b949e;
      }
    }

    /* =========================================================
       Generic
       ========================================================= */
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background: var(--color-bg);
      color: var(--color-text);
      line-height: 1.6;
      padding: 0 1rem 3rem;
    }

    a {
      color: var(--color-primary);
      text-decoration: none;
    }
    a:hover { text-decoration: underline; color: var(--color-primary-dk); }

    /* =========================================================
       Layout – page wrapper
       ========================================================= */
    .page {
      max-width: 900px;
      margin: 0 auto;
    }

    /* =========================================================
       Components – site header
       ========================================================= */
    .site-header {
      padding: 2rem 0 1.5rem;
      border-bottom: 1px solid var(--color-border);
      margin-bottom: 2rem;
    }
    .site-header__title {
      font-size: 1.75rem;
      font-weight: 700;
    }
    .site-header__subtitle {
      color: var(--color-muted);
      font-size: 0.9rem;
      margin-top: 0.35rem;
    }

    /* =========================================================
       Components – section
       ========================================================= */
    .dashboard-section {
      margin-bottom: 3rem;
    }
    .dashboard-section__header {
      display: flex;
      align-items: center;
      gap: 0.6rem;
      margin-bottom: 1.25rem;
    }
    .dashboard-section__title {
      font-size: 1.25rem;
      font-weight: 600;
    }
    .badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 1.6rem;
      height: 1.4rem;
      padding: 0 0.45rem;
      border-radius: 2rem;
      font-size: 0.75rem;
      font-weight: 600;
      background: var(--color-border);
      color: var(--color-text);
    }
    .badge--issue { background: var(--color-tag-issue); color: #fff; }
    .badge--pr    { background: var(--color-tag-pr);    color: #fff; }

    /* =========================================================
       Components – repo group
       ========================================================= */
    .repo-group {
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      border-radius: var(--radius);
      box-shadow: var(--shadow);
      margin-bottom: 1rem;
      overflow: hidden;
    }
    .repo-group__name {
      font-size: 0.9rem;
      font-weight: 600;
      padding: 0.6rem 1rem;
      background: var(--color-bg);
      border-bottom: 1px solid var(--color-border);
      color: var(--color-muted);
      letter-spacing: .02em;
      text-transform: uppercase;
    }

    /* =========================================================
       Components – item list
       ========================================================= */
    .item-list {
      list-style: none;
    }
    .item {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 1rem;
      padding: 0.75rem 1rem;
      border-bottom: 1px solid var(--color-border);
    }
    .item:last-child { border-bottom: none; }
    .item__title {
      font-size: 0.95rem;
      flex: 1;
    }
    .item__meta {
      flex-shrink: 0;
      font-size: 0.8rem;
      color: var(--color-muted);
      white-space: nowrap;
    }

    /* =========================================================
       Components – empty state
       ========================================================= */
    .empty-state {
      color: var(--color-muted);
      font-style: italic;
      padding: 1rem 0;
    }

    /* =========================================================
       Components – footer
       ========================================================= */
    .site-footer {
      border-top: 1px solid var(--color-border);
      padding-top: 1rem;
      font-size: 0.8rem;
      color: var(--color-muted);
    }
  </style>
</head>
<body>
  <div class="page">

    <header class="site-header">
      <h1 class="site-header__title">Municipio Issues &amp; PRs</h1>
      <p class="site-header__subtitle">
        Open items from repositories with the <strong>${escapeHtml(TOPIC)}</strong> topic &mdash;
        last updated <time id="updated">${escapeHtml(updatedAt)}</time>
      </p>
    </header>

    <main>

      <section class="dashboard-section">
        <div class="dashboard-section__header">
          <h2 class="dashboard-section__title">Open Issues</h2>
          <span class="badge badge--issue">${issueCount}</span>
        </div>
        ${issuesHtml}
      </section>

      <section class="dashboard-section">
        <div class="dashboard-section__header">
          <h2 class="dashboard-section__title">Open Pull Requests</h2>
          <span class="badge badge--pr">${prCount}</span>
        </div>
        ${prsHtml}
      </section>

    </main>

    <footer class="site-footer">
      <p>
        Data sourced from the
        <a href="https://docs.github.com/en/graphql" target="_blank" rel="noopener noreferrer">GitHub GraphQL API</a>.
        Automatically refreshed every hour via GitHub Actions.
      </p>
    </footer>

  </div>
</body>
</html>`;
}

/**
 * Main entry point.
 *
 * @returns {Promise<void>}
 */
async function main() {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    console.error('Error: GITHUB_TOKEN environment variable is not set.');
    process.exit(1);
  }

  console.log(`Fetching repositories with topic: ${TOPIC} …`);
  const repos = await fetchRepositories(token);
  console.log(`  Found ${repos.length} repository(ies).`);

  const allIssues = [];
  const allPrs    = [];

  for (const repo of repos) {
    console.log(`  Fetching issues and PRs for ${repo.nameWithOwner} …`);
    const [issues, prs] = await Promise.all([
      fetchItemsForRepo(token, 'issue', repo.nameWithOwner),
      fetchItemsForRepo(token, 'pr', repo.nameWithOwner),
    ]);
    allIssues.push(...issues);
    allPrs.push(...prs);
  }

  allIssues.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  allPrs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  console.log(`  Total: ${allIssues.length} issue(s) and ${allPrs.length} PR(s).`);

  const html = generateHtml(allIssues, allPrs);

  if (!fs.existsSync(OUT_DIR)) {
    fs.mkdirSync(OUT_DIR, { recursive: true });
  }

  fs.writeFileSync(OUT_FILE, html, 'utf8');
  console.log(`  Output written to: ${OUT_FILE}`);
}

main().catch((err) => {
  console.error('Build failed:', err.message);
  process.exit(1);
});
