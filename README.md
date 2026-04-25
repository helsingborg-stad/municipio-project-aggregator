# municipio-project-aggregator

Aggregates Municipio-related GitHub issues and pull requests into separate JSON sources and renders them in a React dashboard.

## Architecture

- `backend/` contains the PHP aggregation layer. It follows a small SOLID-oriented structure with explicit contracts, immutable data objects, and source-specific services.
- `public/data/` contains generated JSON files such as `issues.json` and `pull-requests.json`.
- `src/` contains the React UI built with Vite, Tailwind CSS, and shadcn-style components.
- `dist/` contains the production build published by GitHub Pages.

## Run locally

The aggregator requires a GitHub token that can read organisation issues and pull requests.

1. Create a personal access token and make sure it can query the repositories you need.
2. Provide the token in one of these ways:

```bash
export GITHUB_TOKEN=your-token
npm run build:data
```

```bash
printf 'GITHUB_TOKEN=your-token\n' > .env.local
npm run build:data
```

The PHP backend reads `.env` and `.env.local` from the project root for local debugging.

## Commands

```bash
composer install
npm install
```

```bash
npm run build:data
```

Generates `public/data/issues.json` and `public/data/pull-requests.json`.

```bash
npm run dev
```

Starts the React UI locally. The UI reads the generated JSON files from `public/data/`.

```bash
npm run build
```

Runs the PHP aggregation step first and then builds the production UI into `dist/`.

## Testing

```bash
composer test
npm test
```
