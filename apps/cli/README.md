<p align="center">
  <img src="../web/public/brand/yonaris-wordmark-navy.png" alt="Yonaris" width="400">
</p>

# Yonaris deployment CLI

The deployment CLI for Yonaris, a self-hosted AI visibility tracking and optimization platform.

The current distribution deliberately keeps the upstream npm package and command names so existing Docker images, configuration files, and upgrades remain compatible.

## Installation

```bash
npm install -g @elmohq/cli
```

Requires [Docker](https://docs.docker.com/get-docker/) and Docker Compose.

## Quick start

```bash
# Walk through the interactive Yonaris setup wizard
elmo init

# Start the stack
elmo compose up -d

# Open http://localhost:1515
```

`elmo init` configures the database and AI providers, then generates `elmo.yaml` and `.env`. These filenames are compatibility identifiers; the application name written into the generated environment is `Yonaris`.

## Commands

| Command | Description |
| --- | --- |
| `elmo init` | Set up a local Yonaris instance |
| `elmo compose <args...>` | Run a Docker Compose command against the Yonaris stack |
| `elmo edit <env\|compose>` | Change API keys, scrape targets, or the Compose YAML |
| `elmo upgrade` | Run registered migrations, re-pin image versions, and restart the stack when needed |

Run `elmo --help` or `elmo <command> --help` for the complete command reference.

Useful options:

- `--dir <path>` points a command at a specific config directory; the default remains `~/.elmo`.
- `elmo init --dev` builds images from a local checkout instead of pulling the published images.

## Telemetry and privacy

Yonaris-generated deployments set `DISABLE_TELEMETRY=1`. The CLI contains no Elmo PostHog key or endpoint and does not ask for a newsletter email.

CLI events remain a no-op unless a future Yonaris-owned deployment explicitly provides both `YONARIS_POSTHOG_KEY` and an HTTPS `YONARIS_POSTHOG_HOST`, and removes `DISABLE_TELEMETRY`. Supplying only one setting does not enable telemetry.

## Compatibility identifiers

The following names are intentionally unchanged:

- npm package: `@elmohq/cli`
- executable: `elmo`
- config: `~/.elmo` and `elmo.yaml`
- images: `elmohq/elmo-web`, `elmohq/elmo-worker`, and `elmohq/elmo-db-migrate`
- encryption variables: `ELMO_ENCRYPTION_KEY` and `ELMO_ENCRYPTION_KEY_OLD`

They identify the currently published tooling and storage contracts, not the product name shown to customers.

## Upstream source

The compatible CLI and image release history come from the MIT-licensed [Elmo upstream repository](https://github.com/elmohq/elmo). Report compatibility defects against the relevant upstream version or track them in the Yonaris product workflow.
