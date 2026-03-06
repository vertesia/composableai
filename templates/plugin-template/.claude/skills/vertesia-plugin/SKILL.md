---
name: vertesia-plugin
description: Reference for plugin architecture, dual build system, import hooks, and deployment. Use when understanding plugin structure or build configuration. For creating resources use write-tool-server-resource; for UI use vertesia-ui; for client API use vertesia-api.
---

# Vertesia Plugin Development

This project is a Vertesia plugin with a dual architecture: a **tool server** (Hono backend) and a **UI plugin** (React frontend), built and deployed as a single unit.

The `src/tool-server/tools/examples/`, `src/tool-server/skills/examples/`, `src/tool-server/interactions/examples/`, `src/tool-server/types/examples/`, and `src/tool-server/templates/examples/` directories contain starter code demonstrating each resource type. Use them as reference, then replace with your own implementations.

For extended documentation see `README-tools.md` (tool server), `README-ui.md` (UI plugin), and `TESTING-tools.md` (testing guide) at the project root.

For full code examples of all resource types, see REFERENCE.md.

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

To create tools, skills, interactions, content types, or templates, use the **write-tool-server-resource** skill. It provides step-by-step scaffolding with full code examples.

Each resource follows the same pattern: create files → export from collection → register in `config.ts`.

## UI Plugin

For UI component APIs, routing, layout, styling, and agent conversation patterns, use the **vertesia-ui** skill.

Key entry points:
- `src/ui/plugin.tsx` — Library entry for Vertesia host (exports default component receiving `{ slot }`)
- `src/ui/main.tsx` — Standalone dev entry (VertesiaShell + AdminApp at `/`, plugin at `/app/`)
- `src/ui/routes.tsx` — Route definitions
- `src/ui/assets.ts` — `useAsset(path)` for URLs relative to the plugin bundle

## Authentication

Tool endpoints receive JWT tokens via `Authorization: Bearer {token}`. The SDK validates automatically. Access the client via `const client = await context.getClient()` in tool `run()`. For full client API reference, use the **vertesia-api** skill.

For organization access restriction and deployment details, see REFERENCE.md.

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
- All collections must be registered in `src/tool-server/config.ts`
- Skills use YAML frontmatter in `SKILL.md`; templates in `TEMPLATE.md`; prompts in `.hbs`/`.jst`/`.md` with `?prompt`
