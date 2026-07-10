---
name: vertesia-plugin
description: Reference for plugin architecture, dual build system, import hooks, and deployment. Use when understanding plugin structure or build configuration. For creating resources use vertesia-tool-server-resource; for UI use vertesia-ui; for client API use vertesia-api.
---

# Vertesia Plugin Development

This project is a Vertesia plugin with a dual architecture: a **tool server** (Hono backend) and a **UI plugin** (React frontend), built and deployed as a single unit.

User-owned app code lives in `src/modules/app`. Add UI under `src/modules/app/ui` and tool-server resources under `src/modules/app/resources`. The optional `src/modules/examples/resources` module contains starter code demonstrating each resource type. Use it as reference, then put your own implementation in the app module.

For extended documentation see `README-tools.md` (tool server), `README-ui.md` (UI plugin), and `TESTING-tools.md` (testing guide) at the project root.

For full code examples of all resource types, see REFERENCE.md.

## Project Structure

```
src/
  tool-server/           # Backend (Hono) - compiled by Rollup
    server.ts            # Hono server entry (createToolServer from @vertesia/tools-sdk)
    server-node.ts       # Node.js HTTP adapter for local dev
    config.ts            # Server configuration - imports generated module collections
    app-server-modules.ts # Generated resource aggregator
    settings.ts          # JSON Schema for plugin settings
    mcp/                 # MCP provider integrations
      index.ts           # Exports MCPProviderConfig[]
  ui/                    # Frontend (React) - compiled by Vite
    plugin.tsx           # Library entry - default export component for Vertesia host
    main.tsx             # Standalone app entry for dev mode
    app-ui-entry.tsx     # Generated AppEntry selector
    app-ui-modules.tsx   # Generated route/provider aggregator
    shell/               # Shared runtime shell/chrome, not app business logic
      App.tsx            # Wraps module providers and NestedRouterProvider
      AppEntry.tsx       # Default Studio shell entry
      layouts/           # Shared app layout primitives
      components/        # Shared shell primitives
    env.ts               # Environment config (VITE_APP_NAME)
    assets.ts            # Asset URL resolution (plugin mode vs dev mode)
    index.css            # Tailwind CSS 4 with @source directives
  modules/
    app/                 # User-owned app module; always active
      ui/
        routes.tsx       # User app route definitions
        pages/           # Route-level user pages
        features/        # User feature folders
      resources/
        tools/           # Tool collections
        skills/          # Skill collections
        interactions/    # Interaction collections
        types/           # Content type collections
        templates/       # Rendering template collections
        activities/      # Remote activity collections
    assistant/           # Optional assistant UI module
    examples/            # Optional example resource module
    app-gateway/         # Optional app-gateway runtime entry
    agent/               # Optional agent-facing helper components
api/
  index.js               # Vercel serverless adapter (forwards to Hono fetch)
dist/                    # Build outputs
lib/                     # Compiled server JS (ESM)
```

## Build System

Two independent build pipelines:

| Build | Tool | Entry | Output | Config Files |
|-------|------|-------|--------|--------------|
| Tool Server | Rollup | `src/tool-server/server.ts` | `lib/*.js` (ESM) | `rollup.config.js`, `tsconfig.tool-server.json` |
| UI Plugin (library) | Vite | `src/ui/plugin.tsx` | `dist/lib/plugin.js` | `vite.config.ts --mode lib`, `tsconfig.ui.json` |
| UI App (standalone) | Vite | `src/ui/main.tsx` | `dist/ui/` | `vite.config.ts --mode app`, `tsconfig.ui.json` |
| Skill Widgets | Rollup (via build-tools) | `skills/**/*.tsx` | `dist/widgets/*.js` | `tsconfig.widgets.json` |

### Commands

```bash
pnpm build                 # Full build: server + UI (lib and app)
pnpm build:server          # Rollup server only
pnpm dev                   # Build server + start on port 3000
pnpm dev:ui                # Vite dev server with HMR (https://localhost:5173)
pnpm build:ui:lib          # Plugin library build (dist/lib/plugin.js)
pnpm build:ui:app          # Standalone app build (dist/ui/)
pnpm start                 # Run compiled server
pnpm start:watch           # Run with --watch (auto-restart on lib/ changes)
pnpm start:debug           # Run with --inspect for Node debugger
```

## Import Hooks (@vertesia/build-tools)

These Rollup import transformations only work in `src/tool-server/` code:

| Import | Produces |
|--------|----------|
| `import x from './my-skill/SKILL.md'` | `SkillDefinition` object (convention-based) |
| `import x from './definition.md?skill'` | `SkillDefinition` object (query-based) |
| `import x from './all?skills'` | `SkillDefinition[]` (auto-discovers subdirs with SKILL.md) |
| `import x from './my-template/TEMPLATE.md'` | `RenderingTemplateDefinition` object |
| `import x from './all?templates'` | `RenderingTemplateDefinition[]` (auto-discovers TEMPLATE.md) |
| `import x from './prompt.hbs?prompt'` | `PromptDefinition { role, content, content_type, schema? }` |
| `import x from './file.html?raw'` | Raw string content |

## Creating Resources

To create tools, skills, interactions, content types, or templates, use the **vertesia-tool-server-resource** skill. It provides step-by-step scaffolding with full code examples.

Each user resource follows the same pattern: create files under `src/modules/app/resources/<type>/<collection>/`, export from the collection, then add the collection to `src/modules/app/resources/<type>/index.ts`. `src/tool-server/config.ts` imports the generated `app-server-modules.ts` arrays.

## UI Plugin

For UI component APIs, routing, layout, styling, and agent conversation patterns, use the **vertesia-ui** skill.

When the task includes UI work, do not stop at "it renders". The UI pass should start with a `@vertesia/ui` component inventory and end with a conformance check for duplicated primitives such as raw tables, native selects, local page headers, and inline styles.

Key entry points:
- `src/ui/plugin.tsx` — Library entry for Vertesia host (exports default component receiving `{ slot }`)
- `src/ui/main.tsx` — Standalone dev entry (VertesiaShell + AdminApp at `/`, plugin at `/app/`)
- `src/ui/shell/App.tsx` — Shared shell runtime wrapping module providers and routes
- `src/modules/app/ui/routes.tsx` — User app route definitions
- `src/ui/app-ui-entry.tsx` and `src/ui/app-ui-modules.tsx` — Generated module wiring
- `src/ui/assets.ts` — `useAsset(path)` for URLs relative to the plugin bundle

## Authentication

Tool endpoints receive JWT tokens via `Authorization: Bearer {token}`. The SDK validates automatically. Access the client via `const client = await context.getClient()` in tool `run()`. For full client API reference, use the **vertesia-api** skill.

For organization access restriction and deployment details, see REFERENCE.md.

## Local Runtime Exposure

For project-connected testing, the local plugin server is not enough by itself. The installed Vertesia app manifest must point to a reachable package endpoint.

Use this sequence:

1. run the local HTTPS dev server
2. expose it with a tunnel such as Cloudflare Tunnel
3. update the installed app manifest `endpoint` to `<public-url>/api/package`
4. verify the app package from the public URL before debugging project-side failures

If the project does not see updated types, interactions, or activities, check the manifest endpoint before changing app code.

When auth expires during this flow:

1. refresh auth first
2. verify the currently running dev server port still works
3. verify the current public tunnel still resolves
4. verify the installed app manifest still points to that live tunnel
5. only then decide whether a new server or tunnel is needed

Do not keep spawning new local ports and quick tunnels after an auth failure. The project can easily end up pointing at a dead tunnel even while the local app appears healthy.

## Key Dependencies

| Package | Role |
|---------|------|
| `@vertesia/tools-sdk` | Tool server framework: `createToolServer`, `ToolCollection`, `SkillCollection`, auth |
| `@vertesia/tools-admin-ui` | Admin UI: browsable interface for all plugin resources |
| `@vertesia/build-tools` | Rollup import plugins: `?skill`, `?skills`, `?template`, `?templates`, `?prompt`, `?raw` |
| `@vertesia/plugin-builder` | Vite plugin for UI library builds (CSS extraction/injection) |
| `@vertesia/client` | Vertesia API client for tool implementations |
| `@vertesia/common` | Shared types: `InteractionSpec`, `InCodeTypeSpec`, etc. |
| `@vertesia/ui` | UI component library: `core`, `features`, `router`, `layout`, `session`, `shell` |
| `hono` | Lightweight web framework for the tool server |

## Code Conventions

- ESM with `.js` import extensions: `import { x } from "./foo.js"`
- Type-safe definitions with inference: `{} satisfies Tool<T>`, `{} satisfies InCodeTypeSpec`
- Icons are SVG strings exported as default from `.ts` files
- User collections must be exported from `src/modules/app/resources/<type>/index.ts`; do not hand-edit generated `src/tool-server/app-server-modules.ts`
- Skills use YAML frontmatter in `SKILL.md`; templates in `TEMPLATE.md`; prompts in `.hbs`/`.jst`/`.md` with `?prompt`
