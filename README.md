# Vertesia TypeScript Packages

![Build](https://github.com/vertesia/composableai/actions/workflows/main.yaml/badge.svg)
![Lint](https://github.com/vertesia/composableai/actions/workflows/lint.yaml/badge.svg)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://www.apache.org/licenses/LICENSE-2.0)

This repository contains the public TypeScript packages used to build Vertesia clients, UI plugins, workflow definitions, tools, and supporting developer utilities.

It is a pnpm and Turbo monorepo. Most packages are published under the `@vertesia/*` npm scope.

## Packages

| Package                      | Purpose                                                                                  |
| ---------------------------- | ---------------------------------------------------------------------------------------- |
| `@vertesia/common`           | Shared API types, permissions, OAuth scope helpers, store types, and platform contracts. |
| `@vertesia/client`           | Browser and Node.js client for the Vertesia APIs.                                        |
| `@vertesia/ui`               | React components, hooks, shell, layout, i18n, and shared UI features.                    |
| `@vertesia/cli`              | Command-line tools for working with Vertesia projects and resources.                     |
| `@vertesia/workflow`         | Workflow DSL and helpers for Vertesia workflow definitions.                              |
| `@vertesia/tools-sdk`        | SDK helpers for building remote tools and tool servers.                                  |
| `@vertesia/create-plugin`    | CLI for creating Vertesia UI plugins and tool-server plugins.                            |
| `@vertesia/plugin-builder`   | Vite integration for building Vertesia UI plugins.                                       |
| `@vertesia/api-fetch-client` | Fetch-based foundation for generated and hand-written REST API clients.                  |
| `@vertesia/json`             | JSON parsing, schema, and utility helpers.                                               |
| `@vertesia/converters`       | Image and content conversion helpers.                                                    |
| `@vertesia/build-tools`      | Shared Rollup, Vite, and build-time utilities.                                           |

Additional packages and templates live under `packages/`, `libraries/`, and `templates/`.

## Related Projects

- [`vertesia/llumiverse`](https://github.com/vertesia/llumiverse) is included here as the [`llumiverse/`](./llumiverse/) git submodule. It provides normalized LLM driver interfaces and provider implementations.

## Requirements

- Node.js 24.x
- pnpm 11.8.0 through Corepack

## Setup

```bash
pnpm install
```

## Common Commands

```bash
# Build all workspace packages
pnpm build

# Run Biome checks
pnpm check

# Run package tests
pnpm test

# Run the local CI sequence
pnpm ci:local
```

## Main components

### TS Client

Install the client in a Node.js or browser project:

```bash
pnpm add @vertesia/client
```

Create a client with an API key:

```typescript
import { VertesiaClient } from '@vertesia/client';

const client = new VertesiaClient({
    site: 'api.vertesia.io',
    apikey: process.env.VERTESIA_API_KEY,
});

const projects = await client.projects.list();
console.log(projects);
```

For uploads, Node.js stream helpers are available from the `/node` subpath:

```typescript
import { NodeStreamSource } from '@vertesia/client/node';
```

See [packages/client](./packages/client/) for more client examples.

### CLI

Install the Vertesia CLI globally:

```bash
pnpm add -g @vertesia/cli
```

Open the command help:

```bash
vertesia help
```

The CLI can switch projects, inspect interactions and environments, run interactions, and search run history.
See [packages/cli](./packages/cli/) and the [CLI documentation](https://docs.vertesiahq.com/cli).

### Plugins

Create a new Vertesia plugin project:

```bash
pnpm dlx @vertesia/create-plugin my-plugin
```

Then follow the prompts to choose the plugin type and configure the generated project.
The generated project is based on [templates/plugin-template](./templates/plugin-template/).

## License

Apache-2.0. See [LICENSE](./LICENSE).

## Coordinated submodule updates

Add the `skip-submodule-sync` label to a PR before merging when a coordinated PR in the parent repository
already handles the submodule update. The automatic sync checks the merged PR's label before
creating or updating a downstream sync PR. CI still runs and failure notifications remain enabled.

The opt-out applies only to that merge commit and target branch (`main` or `release/*`); later
unlabeled merges can trigger sync again. A manually dispatched downstream submodule update
bypasses the label. Adding the label after a sync has already started does not cancel that sync.

## Build and test caching

`pnpm build`, `pnpm test`, and `pnpm ci:test` use Turbo. Local commands read and write
local cache entries and only read the remote cache. Set `TURBO_CACHE_OPTS` to override
this policy (for example, `--cache=local:rw` to work without a remote cache).

The build/test workflow authenticates to Vercel Remote Cache with GitHub OIDC.
It reads the Vercel team from the `TURBO_TEAM` organization variable (`Vertesia`). Configure a Turborepo CLI OIDC policy for this repository on that team.
The setup action obtains a short-lived token; no `TURBO_TOKEN` secret is needed.
Fork pull requests skip remote authentication and use the local cache.
Test hashes distinguish CI runners from local runs and include the runner image version.

`@vertesia/common` tests cache their package-owned schemas and build artifacts. Client
bundle checks live in the client package. Downstream consumers own checks against their
published API documents and generated-client fixtures; package tests never read those files.

## Coordinated publish callers

The NPM packages workflow accepts optional `source_sha`, `version`, and
`request_id` inputs. These pin the source commit, set one exact version for the
whole package cohort, and correlate a dispatched workflow run. Existing channel
and base-version validation still applies. A successful real publish uploads
`sdk-publish-source/sdk-publish-source.json` containing the input source SHA,
published version, and pushed version-commit SHA for downstream consumers.

`dry_run=true` performs no registry uploads or branch/tag pushes.

When `llumiverse_sha` is supplied, both CLI and package builds use that immutable
Llumiverse commit. The publisher includes its submodule pointer and the updated
lockfile in the same commit as the package versions; no separate sync PR is needed.

Release retries use immutable `vX.Y.Z` or `vX.Y.Z-dev.YYYYMMDD.HHMMSSZ`
source tags. Before any Git or registry write, the publisher checks source membership
on the selected branch and ownership of every existing package version. Package
metadata records `releaseIdentity` (source commit, dependency pin, and lockfile hash).
After publishing, the tagged version commit is merged into the current branch tip;
ordinary commits that land during the build are preserved. A rejected push retries
against the new tip. Genuine version conflicts stop with the durable tag available
for recovery, without changing the artifact's source identity.

A preparation job resolves the selected Llumiverse dependency once, refreshes the
lockfile, builds `@llumiverse/common`, and regenerates all committed common schemas
and wire types. The prepared source includes generated additions, changes, and
deletions discovered through Git, so new generator outputs are passed along automatically.
CLI and package builds download the same prepared files and validate
their identity. Tagged retries restore that exact dependency and lockfile. Published
smoke tests execute helpers from the pinned caller source and consume the exact npm
versions and immutable template tag. Main, release, maintenance, and coordinated
publications require successful branch propagation before emitting the source artifact.
Independent feature-branch snapshots warn if the deploy key cannot update the branch;
the workflow still records the immutable source tag and runs the published-package smoke tests.
