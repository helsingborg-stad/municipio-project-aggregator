# municipio-project-aggregator

Aggregates open issues and pull requests from repositories tagged for Municipio work into separate JSON sources and renders them in a React dashboard with issue, pull request, repository, and contributor views.

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

```bash
npm run build:data
```

Generates `public/data/issues.json` and `public/data/pull-requests.json` from repositories across GitHub tagged with the tracked topics.

```bash
npm run dev
```

Starts the React UI locally. The UI reads the generated JSON files from `public/data/`.

```bash
npm run build
```

Runs the PHP aggregation step first and then builds the production UI into `dist/`.

```bash
composer serve
```

Serves the built site from `dist/` at `http://127.0.0.1:8000`. Run `npm run build` first so the latest UI and JSON files are available.

## Testing

```bash
composer test
npm test
```
