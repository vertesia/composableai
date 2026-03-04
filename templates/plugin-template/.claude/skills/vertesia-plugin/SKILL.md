---
name: vertesia-plugin
description: Guides development of this Vertesia plugin project. Covers the dual build system (Rollup for Hono tool server, Vite for React UI plugin), creating tools/skills/interactions/types, build-tools import hooks (?skill, ?raw, ?prompt), deployment to Vercel, and plugin architecture. Use when creating or modifying tools, skills, interactions, content types, UI pages, or build configuration.
---

# Vertesia Plugin Development

This project is a Vertesia plugin with a dual architecture: a **tool server** (Hono backend) and a **UI plugin** (React frontend), built and deployed as a single unit.

The `src/tool-server/tools/examples/`, `src/tool-server/skills/examples/`, `src/tool-server/interactions/examples/`, `src/tool-server/types/examples/`, and `src/tool-server/templates/examples/` directories contain starter code demonstrating each resource type. Use them as reference, then replace with your own implementations.

For extended documentation see `README-tools.md` (tool server), `README-ui.md` (UI plugin), and `TESTING-tools.md` (testing guide) at the project root.

## Project Structure

```
src/
  tool-server/           # Backend (Hono) - compiled by Rollup
    server.ts            # Hono server entry (createToolServer from @vertesia/tools-sdk)
    server-node.ts       # Node.js HTTP adapter for local dev
    config.ts            # Server configuration - registers all collections here
    settings.ts          # JSON Schema for plugin settings
    tools/               # Tool collections
      <collection>/
        index.ts         # Exports ToolCollection with tool list
        <tool-name>/
          index.ts       # Tool definition (satisfies Tool<ParamsT>)
          schema.ts      # Input JSON Schema + TypeScript params interface
          <impl>.ts      # Implementation logic
    skills/              # Skill collections
      <collection>/
        index.ts         # Exports SkillCollection (uses ?skills auto-discovery)
        <skill-name>/
          SKILL.md       # Skill definition (YAML frontmatter + markdown body)
          properties.ts  # Optional: runtime properties (isEnabled function)
          *.tsx           # Optional: widgets (compiled to dist/widgets/)
          *.py, *.js      # Optional: scripts (copied to dist/scripts/)
    interactions/        # Interaction collections
      <collection>/
        index.ts         # Exports InteractionCollection
        <interaction-name>/
          index.ts       # InteractionSpec with prompts array
          prompt.hbs     # Handlebars prompt template (imported with ?prompt)
          prompt_schema.ts
          result_schema.ts
    types/               # Content type collections
      <collection>/
        index.ts         # Exports ContentTypesCollection
        <type-name>.ts   # InCodeTypeSpec with object_schema + table_layout
    templates/           # Template collections (for document/presentation generation)
      <collection>/
        index.ts         # Exports RenderingTemplateCollection (uses ?templates auto-discovery)
        <template-name>/
          TEMPLATE.md    # Template definition (YAML frontmatter + markdown body)
          *.svg, *.latex, *.png  # Asset files (auto-discovered, copied to dist/templates/)
    mcp/                 # MCP provider integrations
      index.ts           # Exports MCPProviderConfig[]
  ui/                    # Frontend (React) - compiled by Vite
    plugin.tsx           # Library entry - default export component for Vertesia host
    main.tsx             # Standalone app entry for dev mode
    app.tsx              # Main App component
    routes.tsx           # Route definitions (NestedRouterProvider)
    pages.tsx            # Page components
    env.ts               # Environment config (VITE_APP_NAME)
    assets.ts            # Asset URL resolution (plugin mode vs dev mode)
    index.css            # Tailwind CSS 4 with @source directives
api/
  index.js               # Vercel serverless adapter (forwards to Hono fetch)
dist/                    # Build outputs
lib/                     # Compiled server JS (ESM)
```

## Build System

This project has two independent build pipelines:

| Build | Tool | Entry | Output | Config Files |
|-------|------|-------|--------|--------------|
| Tool Server | Rollup | `src/tool-server/server.ts` | `lib/*.js` (ESM) | `rollup.config.js`, `tsconfig.tool-server.json` |
| UI Plugin (library) | Vite | `src/ui/plugin.tsx` | `dist/lib/plugin.js` | `vite.config.ts --mode lib`, `tsconfig.ui.json` |
| UI App (standalone) | Vite | `src/ui/main.tsx` | `dist/ui/` | `vite.config.ts --mode app`, `tsconfig.ui.json` |
| Skill Widgets | Rollup (via build-tools) | `skills/**/*.tsx` | `dist/widgets/*.js` | `tsconfig.widgets.json` |

### Commands

```bash
# Full build
pnpm build                 # Server + UI (both lib and app)

# Server only
pnpm build:server          # Rollup compile
pnpm dev                   # Build server + start on port 3000

# UI only
pnpm dev:ui                # Vite dev server with HMR (https://localhost:5173)
pnpm build:ui:lib          # Plugin library build (dist/lib/plugin.js)
pnpm build:ui:app          # Standalone app build (dist/ui/)

# Server runtime
pnpm start                 # Run compiled server
pnpm start:watch           # Run with --watch (auto-restart on lib/ changes)
pnpm start:debug           # Run with --inspect for Node debugger
```

## Import Hooks (@vertesia/build-tools)

The Rollup server build uses special import transformations. These only work in `src/tool-server/` code compiled by Rollup:

### Skill Import

```typescript
import mySkill from './my-skill/SKILL.md';        // Convention-based
import mySkill from './definition.md?skill';       // Query-based
// Produces: SkillDefinition object { name, description, instructions, ... }
```

### Skill Collection Auto-Discovery

```typescript
import skills from './all?skills';
// Virtual module - scans directory for subdirs containing SKILL.md
// Produces: SkillDefinition[]
```

### Template Import

```typescript
import myTemplate from './my-template/TEMPLATE.md';     // Convention-based
import myTemplate from './definition.md?template';       // Query-based
// Produces: RenderingTemplateDefinition object { name, description, instructions, type, path, assets, ... }
```

### Template Collection Auto-Discovery

```typescript
import templates from './all?templates';
// Virtual module - scans directory for subdirs containing TEMPLATE.md
// Produces: RenderingTemplateDefinition[]
```

### Prompt Import

```typescript
import PROMPT from './prompt.hbs?prompt';
// Parses YAML frontmatter (role, content_type, schema ref) + template body
// Produces: PromptDefinition { role, content, content_type, schema? }
```

### Raw File Import

```typescript
import html from './template.html?raw';
// Produces: raw string content of the file
```

## Creating a Tool

1. Create `src/tool-server/tools/<collection>/<tool-name>/`
2. Define input schema and params type:

```typescript
// schema.ts
export interface SearchParams { query: string; limit?: number; }

export const Schema = {
    type: "object",
    properties: {
        query: { type: "string", description: "Search query" },
        limit: { type: "number", description: "Max results" }
    },
    required: ["query"]
};
```

3. Implement the tool:

```typescript
// index.ts
import { Tool } from "@vertesia/tools-sdk";
import { SearchParams, Schema } from "./schema.js";

export const SearchTool = {
    name: "search",
    description: "Search for documents matching a query",
    input_schema: Schema,
    async run(payload, context) {
        const { query, limit } = payload.tool_use.tool_input;
        const client = await context.getClient();
        const results = await client.store.objects.query({ name: query, limit });
        return { is_error: false, content: JSON.stringify(results) };
    }
} satisfies Tool<SearchParams>;
```

4. Add the tool to its collection's `index.ts`, then register the collection in `src/tool-server/config.ts`.

## Creating a Skill

1. Create `src/tool-server/skills/<collection>/<skill-name>/`
2. Write `SKILL.md` with YAML frontmatter:

```markdown
---
name: my-skill
title: My Skill
description: What this skill does
keywords: [keyword1, keyword2]
tools: [tool-name-to-enable]
---

# Instructions

Markdown instructions for the AI agent when this skill is active...
```

**Frontmatter fields:** `name` (required), `description` (required), `title`, `keywords` (for auto-activation), `tools` (related tools to unlock), `language`/`packages` (for code execution), `widgets` (UI widgets).

3. Optional `properties.ts` for runtime behavior:

```typescript
import { ToolUseContext } from "@vertesia/tools-sdk";
export default {
    isEnabled: async (context: ToolUseContext) => {
        return !!context.configuration?.myFeature;
    }
};
```

4. Optional `.tsx` widgets (compiled to `dist/widgets/`), `.py`/`.js` scripts (copied to `dist/scripts/`).

5. Skills are auto-discovered: the collection `index.ts` uses `import skills from './all?skills'` to find all subdirectories with `SKILL.md`.

## Creating an Interaction

1. Create `src/tool-server/interactions/<collection>/<name>/`
2. Write a prompt template with frontmatter:

```handlebars
---
role: user
content_type: handlebars
schema: ./prompt_schema.ts
---
Analyze the following: {{input}}
```

3. Define the interaction spec:

```typescript
// index.ts
import { InteractionSpec } from "@vertesia/common";
import PROMPT from "./prompt.hbs?prompt";
import result_schema from "./result_schema.js";

export default {
    name: "analyze",
    title: "Analyze Content",
    description: "Analyzes content and returns structured results",
    result_schema,
    prompts: [PROMPT],
    tags: ["analysis"]
} satisfies InteractionSpec;
```

4. Register in the collection's `index.ts` and add to `config.ts`.

## Creating a Content Type

```typescript
// src/tool-server/types/<collection>/<type-name>.ts
import { InCodeTypeSpec } from "@vertesia/common";

export const ArticleType = {
    name: "article",
    description: "A blog article with title, body, and metadata",
    object_schema: {
        type: "object",
        properties: {
            title: { type: "string" },
            body: { type: "string" },
            author: { type: "string" }
        }
    },
    table_layout: [
        { name: "Title", field: "properties.title", type: "string" },
        { name: "Author", field: "properties.author", type: "string" },
        { name: "Status", field: "status", type: "string" }
    ],
    is_chunkable: true,
    strict_mode: false
} satisfies InCodeTypeSpec;
```

Register in the collection and add to `config.ts`.

## Creating a Template

Templates are used for PDF/presentation generation. Each template consists of a `TEMPLATE.md` file (YAML frontmatter + instructions) plus asset files.

1. Create `src/tool-server/templates/<collection>/<template-name>/`
2. Write `TEMPLATE.md` with YAML frontmatter:

```markdown
---
title: My Template
description: What this template generates
tags: [report, pdf]
type: document
---

# Template Instructions

Instructions for the document generation system...
```

**Frontmatter fields:** `description` (required), `type` (required: `'document'` or `'presentation'`), `title`, `tags`. The `name` and `id` are inferred from the directory structure.

3. Add asset files (SVG slides, LaTeX files, images) in the same directory. All non-`.md`/`.ts`/`.js` files are auto-discovered and copied to `dist/templates/<collection>/<name>/`.

4. Templates are auto-discovered: the collection `index.ts` uses `import templates from './all?templates'` to find all subdirectories with `TEMPLATE.md`.

5. Create the collection:

```typescript
// src/tool-server/templates/<collection>/index.ts
import { RenderingTemplateCollection } from "@vertesia/tools-sdk";
import templates from './all?templates';

export const MyTemplates = new RenderingTemplateCollection({
    name: "my-collection",
    description: "My template collection",
    templates
});
```

6. Register in `src/tool-server/templates/index.ts` and add to `config.ts`.

## Admin UI (`@vertesia/tools-admin-ui`)

The admin UI is a shared React library that provides a browsable interface for all resources exposed by the plugin. It is mounted alongside the plugin app in dev mode.

### How it integrates

In `src/ui/main.tsx`, the admin UI is mounted at the root path while the plugin app lives under `/app/`:

```typescript
import { AdminApp } from '@vertesia/tools-admin-ui'

const routes: Route[] = [
    { path: "*", Component: AdminApp },      // Admin UI at /
    { path: "app/*", Component: AppWrapper }, // Plugin app at /app/
]
```

### What the admin UI shows

The admin UI fetches the tool server's per-type API endpoints in parallel:

| Endpoint | Data |
|----------|------|
| `GET /api` | Server info (name, version, endpoints) |
| `GET /api/interactions` | Interaction collections and refs |
| `GET /api/tools` | Tool collections and definitions |
| `GET /api/skills` | Skill collections (exposed as tools) |
| `GET /api/types` | Content type collections and schemas |
| `GET /api/templates` | Template collections and refs |
| `GET /api/package?scope=widgets` | Widget info per skill collection |

The home page shows collection cards grouped by type. Clicking a collection navigates to its detail page. A search bar filters across all individual resources.

### Admin UI pages

| Route | Shows |
|-------|-------|
| `/` | Collection cards grouped by type, or search results |
| `/tools/:collection` | Tool definitions with input schemas |
| `/skills/:collection` | Skill list with widgets summary |
| `/skills/:collection/:name` | Full skill: widgets, scripts, instructions, schema |
| `/interactions/:collection` | Interaction list |
| `/interactions/:collection/:name` | Prompts, result schema, agent runner flags |
| `/types/:collection` | Content type list |
| `/types/:collection/:name` | Object schema, table layout, flags |
| `/templates/:collection` | Template list |
| `/templates/:collection/:name` | Instructions, assets, type |

### Developing the admin UI itself

The admin UI package has its own dev mode for standalone development:

```bash
cd composableai/packages/tools-admin-ui
cp .env.local.example .env.local  # Set VITE_API_BASE_URL to your running tool server
pnpm dev                          # Vite dev server on http://localhost:5174
```

The dev entry point wraps AdminApp in `VertesiaShell` for authentication context.

## UI Plugin Development

The UI uses React 19, Tailwind CSS 4, and `@vertesia/ui` components.

### Plugin Entry (`plugin.tsx`)
- Exports a default component receiving `{ slot: string }`
- `slot === "page"` renders the app wrapped in `PortalContainerProvider`
- This component is loaded by the Vertesia host application

### Standalone Dev Mode (`main.tsx`)
- Wraps the app in `VertesiaShell` from `@vertesia/ui/shell` with `RouterProvider`
- Mounts `AdminApp` at root (`/`) and the plugin app at `/app/`
- Requires `VITE_APP_NAME` env var (set in `.env.local`)
- Access at `https://localhost:5173` (HTTPS required for Firebase auth)

### Routing
- Use `NestedRouterProvider` from `@vertesia/ui/router` for nested routing
- Define routes in `routes.tsx`

### Styling
- Use Tailwind semantic classes: `text-success`, `bg-attention`, `border-destructive`, `text-muted`, `bg-info`, `text-done`
- Use `@vertesia/ui/core` components (Button, Input, SelectBox, Modal, Spinner, etc.)
- Never hardcode colors — always use theme variables

### Assets
- Use `useAsset(path)` from `./assets.ts` for URLs relative to the plugin bundle

## Authentication

Tool endpoints receive JWT tokens via `Authorization: Bearer {token}`. The SDK validates them automatically. Access an authenticated Vertesia client:

```typescript
async run(payload, context) {
    const client = await context.getClient();
    // client.store.objects.list(), client.store.collections.retrieve(), etc.
}
```

### Organization Access Restriction

To restrict a tool server to specific Vertesia organizations, set the `VERTESIA_ALLOWED_ORGS` environment variable to a comma-separated list of organization IDs:

```bash
VERTESIA_ALLOWED_ORGS=org_abc123,org_def456
```

When set, only requests from the listed organizations are allowed. Requests from other organizations receive a `403 Forbidden` response. When not set, all authenticated organizations can access the server.

This is enforced automatically by `@vertesia/tools-sdk`'s `authorize()` middleware — no code changes are needed in the plugin. The org ID is read from the JWT token's `account.id` field.

**Vercel:** Set via Project Settings > Environment Variables or `vercel env add VERTESIA_ALLOWED_ORGS`.
**Docker/Node.js:** Set as a standard environment variable.

## Deployment

### Vercel (Primary)
The `vercel.json` routes `/api/*` to the serverless function in `api/index.js`. Static files are served from `dist/`.

```bash
pnpm build && vercel deploy
```

### Node.js / Docker
```bash
pnpm build && pnpm start   # Runs on port 3000 (or PORT env var)
```

The Node server (`server-node.ts`) serves static files from `dist/` via `@hono/node-server/serve-static`.

## Key Dependencies

| Package | Role |
|---------|------|
| `@vertesia/tools-sdk` | Tool server framework: `createToolServer`, `ToolCollection`, `SkillCollection`, auth |
| `@vertesia/tools-admin-ui` | Admin UI: browsable interface for all plugin resources (tools, skills, interactions, types, templates) |
| `@vertesia/build-tools` | Rollup import plugins: `?skill`, `?skills`, `?template`, `?templates`, `?prompt`, `?raw` transformers |
| `@vertesia/plugin-builder` | Vite plugin for UI library builds (CSS extraction/injection) |
| `@vertesia/client` | Vertesia API client for tool implementations |
| `@vertesia/common` | Shared types: `InteractionSpec`, `InCodeTypeSpec`, etc. |
| `@vertesia/ui` | UI component library: `core`, `features`, `router`, `layout`, `session`, `shell` |
| `hono` | Lightweight web framework for the tool server |
| `@hono/node-server` | Node.js HTTP adapter for local dev and non-serverless deployment |

## Code Conventions

- ESM with `.js` import extensions: `import { x } from "./foo.js"`
- Type-safe definitions with inference: `{} satisfies Tool<T>`, `{} satisfies InCodeTypeSpec`
- Icons are SVG strings exported as default from `.ts` files
- All collections must be registered in `src/tool-server/config.ts`
- Skills use YAML frontmatter in `SKILL.md`; templates use YAML frontmatter in `TEMPLATE.md`; prompts use frontmatter in `.hbs`/`.jst`/`.md` files with `?prompt`
