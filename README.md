<p align="center">
  <img src="apps/web/public/brand/yonaris-wordmark-navy.png" alt="Yonaris" width="400">
</p>

# Yonaris

Self-hosted AI visibility tracking and optimization for Answer Engine Optimization (AEO), Generative Engine Optimization (GEO), and LLM Optimization (LLMO).

Yonaris tracks how AI answer engines such as ChatGPT, Claude, Perplexity, Gemini, DeepSeek, and Google AI surfaces mention, cite, and describe a brand. It helps teams benchmark competitors, inspect source citations, and measure visibility over time while keeping deployment data under their control.

## Quick start

Yonaris currently uses the upstream-compatible CLI distribution:

```bash
# Install the compatible CLI
npm install -g @elmohq/cli

# Initialize a Yonaris deployment
elmo init

# Start the stack
elmo compose up -d
```

The dashboard is available at `http://localhost:1515` by default.

## Compatibility identifiers

The product shown to users is **Yonaris**. The following identifiers intentionally remain compatible with the upstream deployment tooling:

- npm package: `@elmohq/cli`
- CLI command: `elmo`
- config directory and file: `~/.elmo` and `elmo.yaml`
- Docker images: `elmohq/elmo-*`
- encryption variables: `ELMO_ENCRYPTION_KEY` and `ELMO_ENCRYPTION_KEY_OLD`

Do not rename these identifiers in an existing deployment without a migration plan. Changing the Compose project, image, database, or volume names can create a parallel stack that appears to have lost its existing data.

## Documentation

- [Introduction](packages/docs/content/docs/index.mdx)
- [Quick start](packages/docs/content/docs/getting-started.mdx)
- [User guide](packages/docs/content/docs/user-guide/index.mdx)
- [API overview](packages/docs/content/docs/api/index.mdx)

## Architecture

Yonaris runs as a Docker Compose stack:

- the web service provides the dashboard and REST API;
- the worker schedules model evaluations, citations, and reports;
- PostgreSQL stores product data and the background-job queue;
- configured scraper and model providers collect the evaluated responses.

## Tech stack

- [Docker Compose](https://docs.docker.com/compose/)
- [PostgreSQL](https://www.postgresql.org/)
- [TypeScript](https://www.typescriptlang.org/)
- [TanStack Start](https://tanstack.com/start/latest)
- [pg-boss](https://github.com/timgit/pg-boss)

## Upstream and licensing

Yonaris is based on the MIT-licensed [Elmo upstream project](https://github.com/elmohq/elmo). The upstream technical identifiers above are retained so its published CLI and Docker images continue to work. See [LICENSE.md](LICENSE.md) for the required copyright and license notice.
