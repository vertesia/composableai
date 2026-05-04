# Vertesia Plugin Template

Dual-architecture plugin: **Hono tool server** (backend) + **React UI plugin** (frontend), built and deployed as a single unit.

## Build & Dev Commands

```bash
pnpm build                 # Full build (server + UI), lint runs as prebuild
pnpm build:server          # Rollup: tool server only → lib/
pnpm build:ui:lib          # Vite: plugin library → dist/lib/plugin.js
pnpm build:ui:app          # Vite: standalone app → dist/ui/

pnpm dev                   # Vite dev server with API middleware (https://localhost:5173)
pnpm start                 # Preview production build (build:server + vite preview)
```

## Dual Build System

| Component | Bundler | Entry | tsconfig | Output |
|-----------|---------|-------|----------|--------|
| Tool Server | Rollup | `src/tool-server/server.ts` | `tsconfig.tool-server.json` | `lib/*.js` |
| UI Plugin | Vite | `src/ui/plugin.tsx` | `tsconfig.ui.json` | `dist/lib/plugin.js` |
| UI App | Vite | `src/ui/main.tsx` | `tsconfig.ui.json` | `dist/ui/` |
| Widgets | Rollup | `skills/**/*.tsx` | `tsconfig.widgets.json` | `dist/widgets/` |

## Code Style

- ESM with `.js` import extensions in tool-server code: `import { x } from "./foo.js"`
- Type-safe definitions: `{} satisfies Tool<T>`, `{} satisfies InCodeTypeSpec`, `{} satisfies InteractionSpec`
- All tool/skill/interaction/type/template collections must be registered in `src/tool-server/config.ts`
- Import hooks (`?skill`, `?skills`, `?prompt`, `?raw`, `?template`, `?templates`) only work in Rollup-compiled tool-server code, not in UI code
- Icons are SVG strings exported as default from `.ts` files

## Key Files

| File | Purpose |
|------|---------|
| `src/tool-server/config.ts` | Registers all collections — add new resources here |
| `src/tool-server/settings.ts` | Plugin settings JSON Schema |
| `src/ui/plugin.tsx` | Library entry for Vertesia host app |
| `src/ui/main.tsx` | Standalone dev entry (VertesiaShell + AdminApp) |
| `src/ui/routes.tsx` | Route definitions (NestedRouterProvider) |
| `src/ui/index.css` | Tailwind CSS 4 entry with shared styles import |

## UI Development

- React 19, Tailwind CSS 4, `@vertesia/ui` component library
- Component API reference: `composableai/packages/ui/llms.txt` (also shipped with npm package)
- Use `@vertesia/ui/core` for components, `@vertesia/ui/router` for navigation, `@vertesia/ui/session` for auth
- Standalone dev requires HTTPS (Firebase auth): https://localhost:5173
- Set `VITE_APP_NAME` in `.env.app`; use `.env.app.local` for local overrides

## Development Practices

- Extract components from map callbacks when the body has logic or is more than 2-3 lines
- Use `flex flex-col gap-{n}` for vertical spacing (not `space-y-*`)
- Debounce expensive search/filter operations
- Guard form submissions with `isSubmitting` state to prevent double-clicks
- Show generic user-facing error messages; log details to console
- Never hardcode secrets or API keys — use environment variables (`VITE_*` prefix for client-side)
- Validate user inputs before passing to API calls
- Never use `dangerouslySetInnerHTML` without sanitization

## Common Pitfalls

- **Import hooks are Rollup-only**: `?skill`, `?prompt`, `?raw` imports fail silently or error in Vite UI code
- **Must register in config.ts**: Creating a collection without adding it to `config.ts` means it won't be served
- **Input onChange API**: `@vertesia/ui` Input passes value directly (`onChange={setValue}`), not a React event — Textarea uses standard events
- **listConversations limitations**: Does not return the `input` field — only `topic` is available for labeling conversations; fall back to date/time
- **getRunDetails** for full data: Use `client.store.workflows.getRunDetails(runId, workflowId)` when you need `input` or history

## Skills

| Skill | Use when |
|-------|----------|
| `write-tool-server-resource` | Adding new tools, skills, interactions, content types, or templates to the tool server |
| `vertesia-plugin` | Understanding plugin architecture, build system, or configuration |
| `vertesia-api` | Working with the Vertesia client API (objects, workflows, interactions, auth) |
| `vertesia-ui` | Building UI pages and components (routing, layout, styling, agent conversation) |
