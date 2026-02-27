# @vertesia/tools-admin-ui

Shared admin UI for Vertesia tool servers. Provides a browsable interface for all resources exposed by a plugin: tools, skills, interactions, content types, rendering templates, and MCP providers.

## How it works

The admin UI is a React component library that ships as a single ES module (`lib/tools-admin-ui.js`) with CSS inlined into the bundle. It is designed to be embedded in two contexts:

1. **Plugin dev mode** — mounted at the root path (`/`) alongside the plugin app (at `/app/`)
2. **Standalone dev mode** — run directly via `pnpm dev` for working on the admin UI itself

### Data flow

On load, the admin UI fetches the tool server's API endpoints in parallel:

| Endpoint | Returns |
|----------|---------|
| `GET /api` | Server info (name, version, endpoints) |
| `GET /api/interactions` | Interaction collections and refs |
| `GET /api/tools` | Tool collections and definitions |
| `GET /api/skills` | Skill collections (exposed as tools) |
| `GET /api/types` | Content type collections and schemas |
| `GET /api/templates` | Template collections and refs |

MCP providers are derived from the server info (`endpoints.mcp`).

### Pages and routing

| Route | Page | Description |
|-------|------|-------------|
| `/` | Home | Collection cards grouped by type, or search results |
| `/tools/:collection` | Tool collection | Lists tools with input schemas |
| `/skills/:collection` | Skill collection | Lists skills with widgets summary |
| `/skills/:collection/:name` | Skill detail | Full definition: instructions, schema, related tools |
| `/interactions/:collection` | Interaction collection | Lists interactions in a collection |
| `/interactions/:collection/:name` | Interaction detail | Prompts, result schema, agent runner flags |
| `/types/:collection` | Type collection | Lists content types |
| `/types/:collection/:name` | Type detail | Object schema, table layout, flags |
| `/templates/:collection` | Template collection | Lists rendering templates |
| `/templates/:collection/:name` | Template detail | Instructions, assets, type |

The home page has two modes:
- **Browse** (no search) — shows collection cards grouped by resource type
- **Search** — filters across all individual resources and shows matching cards

## Development

### Prerequisites

A running tool server with the API endpoints above. This is typically a plugin project started from the plugin template.

### Setup

```bash
# From the monorepo root
pnpm install

# Create your local env file
cp packages/tools-admin-ui/.env.local.example packages/tools-admin-ui/.env.local
```

Edit `.env.local` to point to your running tool server:

```
VITE_API_BASE_URL=http://localhost:3000/api
```

### Dev mode

```bash
cd packages/tools-admin-ui
pnpm dev
```

Starts a Vite dev server on `http://localhost:5174`. The dev entry point (`src/dev/main.tsx`) wraps the admin app in `VertesiaShell` for authentication and routing context.

The dev environment is configured in `src/dev/env.ts` and connects to Vertesia APIs for auth.

### Build

```bash
pnpm build
```

This runs two steps:
1. `tsc --build` — emits type declarations to `lib/`
2. `vite build --mode lib` — bundles the React components into `lib/tools-admin-ui.js`

All external dependencies (React, `@vertesia/*`) are externalized — only the admin UI code and its CSS are bundled.

## Usage in a plugin

The plugin template mounts the admin UI at the root path:

```tsx
import { AdminApp } from '@vertesia/tools-admin-ui'

const routes: Route[] = [
    { path: "*", Component: AdminApp },
    { path: "app/*", Component: AppWrapper },
]
```

The `AdminApp` component accepts an optional `baseUrl` prop (defaults to `'/api'`).

## Exports

```ts
// Components
export { AdminApp } from './AdminApp'

// Context
export { AdminContext, useAdminContext } from './AdminContext'

// Types
export type { AdminAppProps, AdminContextValue, ServerInfo, ResourceType, ResourceItem, CollectionInfo }

// Utilities
export { buildResourceData, filterResources }
```
