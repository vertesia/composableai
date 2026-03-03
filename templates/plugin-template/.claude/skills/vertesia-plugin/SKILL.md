---
name: vertesia-plugin
description: Guides development of this Vertesia plugin project. Covers the dual build system (Rollup for Hono tool server, Vite for React UI plugin), creating tools/skills/interactions/types, build-tools import hooks (?skill, ?raw, ?prompt), deployment to Vercel, and plugin architecture. Use when creating or modifying tools, skills, interactions, content types, UI pages, or build configuration.
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

Each resource type follows the same pattern: create files in the appropriate directory, register in collection `index.ts`, add collection to `config.ts`.

### Tool

1. Create `src/tool-server/tools/<collection>/<tool-name>/` with `schema.ts` (params interface + JSON Schema) and `index.ts` (tool definition with `satisfies Tool<ParamsT>`)
2. Access authenticated client via `const client = await context.getClient()` in `run()`
3. Register in collection, add collection to `config.ts`

### Skill

1. Create `src/tool-server/skills/<collection>/<skill-name>/SKILL.md` with YAML frontmatter (`name`, `description` required; optional: `title`, `keywords`, `tools`, `language`, `packages`, `widgets`)
2. Optional: `properties.ts` for `isEnabled()`, `.tsx` widgets, `.py`/`.js` scripts
3. Auto-discovered via `import skills from './all?skills'`

### Interaction

1. Create `src/tool-server/interactions/<collection>/<name>/` with prompt template (`.hbs` with YAML frontmatter) and `index.ts` (`satisfies InteractionSpec`)
2. Use `?prompt` import for templates, define `result_schema` for structured output
3. Register in collection, add to `config.ts`

### Content Type

1. Create `src/tool-server/types/<collection>/<type-name>.ts` with `satisfies InCodeTypeSpec`
2. Define `object_schema` (JSON Schema) and `table_layout` (column definitions)
3. Register in collection, add to `config.ts`

### Template

1. Create `src/tool-server/templates/<collection>/<template-name>/TEMPLATE.md` with YAML frontmatter (`description`, `type: 'document' | 'presentation'` required)
2. Add asset files (SVG, LaTeX, images) in same directory — auto-discovered
3. Auto-discovered via `import templates from './all?templates'`

For full code examples of each resource type, see REFERENCE.md.

## UI Plugin Development

The UI uses React 19, Tailwind CSS 4, and `@vertesia/ui` components. For the full component API reference, see `composableai/packages/ui/llms.txt` (also shipped with the `@vertesia/ui` npm package).

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
- Define routes in `routes.tsx` as `Route[]` array
- `useParams()` returns `Record<string, string>` — use with parameterized routes like `/chat/:runId/:workflowId`
- `useNavigate()` returns a navigate function for programmatic navigation
- `useLocation()` returns `{ pathname }` for current path matching

### Agent Conversation UI

Use `ModernAgentConversation` from `@vertesia/ui/features` for agent chat interfaces.

**Key props:**
- `run` — `{ runId, workflowId } | undefined` — pass to show/stream an active conversation
- `startWorkflow` — `(initialMessage?: string) => Promise<{ run_id, workflow_id } | undefined>` — called to start a new conversation
- `resetWorkflow` — `() => void` — called when user wants a new conversation
- `title`, `placeholder`, `startButtonText` — UI text customization
- `hideObjectLinking` — hide document linking UI
- `interactive` — enable user input during conversation

**Persisting conversations in URL:**
- Use parameterized routes: `/chat/:runId/:workflowId`
- Derive `run` from URL params instead of React state
- After `startWorkflow`, navigate to `/chat/${result.runId}/${result.workflowId}`
- `resetWorkflow` navigates back to `/chat`

**Listing past conversations (sidebar):**
- Use `client.store.workflows.listConversations({ interaction, page_size })` from `@vertesia/client`
- Returns `{ runs: WorkflowRun[] }` — each has `run_id`, `workflow_id`, `started_at`, `status`, `topic`
- **Important:** `listConversations` does NOT return the `input` field. Only `topic` is available for labeling. Fall back to date/time if no topic.
- `client.store.workflows.getRunDetails(runId, workflowId)` returns full details including `input` and history
- Use `SidebarSection` and `SidebarItem` from `@vertesia/ui/layout` for the conversation list
- Wrap long labels in `<span className="truncate">` with `className="overflow-hidden"` on `SidebarItem`

### Styling
- Shared styles: `@import "@vertesia/ui/styles.css"` in `index.css`
- Use Tailwind semantic classes: `text-success`, `bg-attention`, `border-destructive`, `text-muted`, `bg-info`, `text-done`
- Use `@vertesia/ui/core` components (Button, Input, SelectBox, Modal, Spinner, etc.)
- Never hardcode colors — always use theme variables
- For CSS customization and available tokens, see REFERENCE.md
- For full CSS/component/styling guidance, see the `vertesia-app-ui` skill

### Assets
- Use `useAsset(path)` from `./assets.ts` for URLs relative to the plugin bundle

## Authentication

Tool endpoints receive JWT tokens via `Authorization: Bearer {token}`. The SDK validates them automatically:

```typescript
async run(payload, context) {
    const client = await context.getClient();
    // client.store.objects.list(), client.store.collections.retrieve(), etc.
}
```

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
