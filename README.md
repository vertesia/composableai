# Vertesia TypeScript Packages

![Build](https://github.com/vertesia/composableai/actions/workflows/main.yaml/badge.svg)
![Lint](https://github.com/vertesia/composableai/actions/workflows/lint.yaml/badge.svg)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://www.apache.org/licenses/LICENSE-2.0)

This repository contains the public TypeScript packages used to build Vertesia clients, UI plugins, workflow definitions, tools, and supporting developer utilities.

It is a pnpm and Turbo monorepo. Most packages are published under the `@vertesia/*` npm scope.

## Packages

| Package | Purpose |
| --- | --- |
| `@vertesia/common` | Shared API types, permissions, OAuth scope helpers, store types, and platform contracts. |
| `@vertesia/client` | Browser and Node.js client for the Vertesia APIs. |
| `@vertesia/ui` | React components, hooks, shell, layout, i18n, and shared UI features. |
| `@vertesia/cli` | Command-line tools for working with Vertesia projects and resources. |
| `@vertesia/workflow` | Workflow DSL and helpers for Vertesia workflow definitions. |
| `@vertesia/tools-sdk` | SDK helpers for building remote tools and tool servers. |
| `@vertesia/create-plugin` | CLI for creating Vertesia UI plugins and tool-server plugins. |
| `@vertesia/plugin-builder` | Vite integration for building Vertesia UI plugins. |
| `@vertesia/api-fetch-client` | Fetch-based foundation for generated and hand-written REST API clients. |
| `@vertesia/json` | JSON parsing, schema, and utility helpers. |
| `@vertesia/converters` | Image and content conversion helpers. |
| `@vertesia/build-tools` | Shared Rollup, Vite, and build-time utilities. |

Additional packages and templates live under `packages/`, `libraries/`, and `templates/`.

## Related Projects

- [`vertesia/llumiverse`](https://github.com/vertesia/llumiverse) is included here as the [`llumiverse/`](./llumiverse/) git submodule. It provides normalized LLM driver interfaces and provider implementations.

## Requirements

- Node.js 24
- pnpm 11.3.0

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
