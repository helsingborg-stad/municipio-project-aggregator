# municipio-project-aggregator

Aggregates open issues and pull requests from repositories tagged for Municipio work into separate JSON sources and renders them in a React dashboard with issue, pull request, repository, and contributor views.

Issue and pull request aggregation uses GitHub repository-topic discovery plus paginated GraphQL item queries per matched repository, which reduces the number of follow-up API calls compared with expanding every item through multiple REST endpoints.

## Architecture

- `backend/` contains the PHP aggregation layer. It follows a small SOLID-oriented structure with explicit contracts, immutable data objects, and source-specific services.
- `public/data/` contains generated JSON files such as `issues.json` and `pull-requests.json`.
- `src/` contains the React UI built with Vite, Tailwind CSS, and shadcn-style components.
- `dist/` contains the production build published by GitHub Pages.
- Repository selection is based on GitHub repository topics across all of GitHub, currently `municipio-se` and `getmunicipio`.

## Run locally

The aggregator can use a GitHub token for higher API limits, but it can also fall back to public GitHub REST endpoints for public repositories.

1. Create a personal access token if you need higher GitHub API limits.
2. Provide the token in one of these ways:

```bash
export GITHUB_TOKEN=your-token
export ITEM_LOOKBACK_DAYS=365
npm run build:data
```

```bash
printf 'GITHUB_TOKEN=your-token\nITEM_LOOKBACK_DAYS=365\n' > .env.local
npm run build:data
```

The PHP backend reads `.env` and `.env.local` from the project root for local debugging.
`ITEM_LOOKBACK_DAYS` is optional and defaults to `365`, which limits gathered issues and pull requests to the last year.

## Commands

```bash
composer install
npm install
```

## Dev Container

The repository includes a `.devcontainer/devcontainer.json` setup for VS Code Dev Containers or GitHub Codespaces.
It provisions Node.js, PHP 8.2, and Composer, then runs `npm install && composer install` after the container is created.

After opening the project in the container, use the same project commands as usual:

```bash
npm run dev
npm run build:data
composer test
```

```bash
npm run build:data
```

Generates `public/data/issues.json`, `public/data/pull-requests.json`, and release pages from repositories across GitHub tagged with the tracked topics.

Use `BUILD_TARGETS` to refresh only the datasets you need:

```bash
BUILD_TARGETS=issues php backend/bin/build.php
BUILD_TARGETS=pull-requests,releases php backend/bin/build.php
BUILD_TARGETS=sprints php backend/bin/build.php
```

Sprint refreshes query GitHub Project v2 data and require a token with project read access, including the `read:project` scope.

```bash
npm run dev
```

Starts the React UI locally. The UI reads the generated JSON files from `public/data/`.

```bash
npm run build
```

Runs the PHP aggregation step first and then builds the production UI into `dist/`.

The GitHub Actions deployment is split so pushes rebuild only the UI bundle, while scheduled jobs refresh deployed data files directly once per hour in staggered slices:

- minute `5`: issues
- minute `25`: pull requests
- minute `45`: releases
- minute `55`: sprints

That keeps the published app shell stable and lowers the peak GitHub API usage per run.

```bash
npm run preview:caddy
```

Serves the built site from `dist/` through Caddy at `http://127.0.0.1:5400`. Run `npm run build` first so the latest UI and JSON files are available.

## Testing

```bash
composer test
npm test
```
