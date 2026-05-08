# Vertesia Plugin Template

Dual-architecture plugin: **Hono tool server** (backend) + **React UI plugin** (frontend), built and deployed as a single unit.

## Skill Auto-Invocation

IMPORTANT: You MUST invoke the relevant skill using the Skill tool BEFORE starting implementation for the task types below. Skills contain detailed, up-to-date patterns beyond what this file covers.

| When the task involves...                                                       | INVOKE this skill first         |
| ------------------------------------------------------------------------------- | ------------------------------- |
| Reviewing requirement docs, discovery notes, or feature/demo asks               | `vertesia-gap-assessment`       |
| Understanding plugin architecture, dual build system, or `config.ts`            | `vertesia-plugin`               |
| Adding tools, skills, interactions, content types, or rendering templates       | `vertesia-tool-server-resource` |
| Building or modifying React UI pages or components                              | `vertesia-ui`                   |
| Calling the Vertesia client API (objects, workflows, interactions, files)       | `vertesia-api`                  |
| Writing or debugging DSL workflows that call remote activities                  | `vertesia-dsl-workflow`         |
| Seeding the store with realistic demo objects                                   | `vertesia-demo-content`         |

### Typical "build a feature" loop

1. If the requirement is fuzzy or comes from a discovery doc → `vertesia-gap-assessment` first.
2. Need plugin context (build, layout, deployment) → `vertesia-plugin`.
3. Pick the implementation skill:
   - Backend resources (tools/skills/interactions/types/templates) → `vertesia-tool-server-resource`
   - UI page or component → `vertesia-ui`
   - Multi-step orchestration → `vertesia-dsl-workflow`
4. Add `vertesia-api` whenever the implementation reads or writes the platform.
5. Add `vertesia-demo-content` if you need real seed objects to exercise the feature end-to-end.

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

| Component   | Bundler | Entry                       | tsconfig                    | Output                |
|-------------|---------|-----------------------------|-----------------------------|-----------------------|
| Tool Server | Rollup  | `src/tool-server/server.ts` | `tsconfig.tool-server.json` | `lib/*.js`            |
| UI Plugin   | Vite    | `src/ui/plugin.tsx`         | `tsconfig.ui.json`          | `dist/lib/plugin.js`  |
| UI App      | Vite    | `src/ui/main.tsx`           | `tsconfig.ui.json`          | `dist/ui/`            |
| Widgets     | Rollup  | `skills/**/*.tsx`           | `tsconfig.widgets.json`     | `dist/widgets/`       |

## Key Files

| File                          | Purpose                                              |
|-------------------------------|------------------------------------------------------|
| `src/tool-server/config.ts`   | Registers all collections — add new resources here   |
| `src/tool-server/settings.ts` | Plugin settings JSON Schema                          |
| `src/ui/plugin.tsx`           | Library entry for the Vertesia host app              |
| `src/ui/main.tsx`             | Standalone dev entry (VertesiaShell + AdminApp)      |
| `src/ui/routes.tsx`           | Route definitions (NestedRouterProvider)             |
| `src/ui/index.css`            | Tailwind CSS 4 entry with shared styles import       |

## Plugin-Specific Conventions

- ESM with `.js` import extensions in tool-server code: `import { x } from "./foo.js"`
- Type-safe definitions: `{} satisfies Tool<T>`, `{} satisfies InCodeTypeSpec`, `{} satisfies InteractionSpec`
- All collections must be registered in `src/tool-server/config.ts` (or its per-type index files)
- Standalone dev requires HTTPS (Firebase auth): <https://localhost:5173>
- Set `VITE_APP_NAME` in `.env.app`; use `.env.app.local` for local overrides
- Icons are SVG strings exported as default from `.ts` files

## Cross-Cutting Pitfalls

Fast-path reminders — these bite often enough to flag here even though the relevant skill covers them:

- **Import hooks are Rollup-only**: `?skill`, `?skills`, `?prompt`, `?raw`, `?template`, `?templates` fail silently or error in Vite UI code. They work only in tool-server code.
- **Must register in `config.ts`**: a collection that isn't wired into `config.ts` (or its per-type index) won't be served.
- **`Input.onChange` takes the value directly** (`onChange={setValue}`), not a React event — `Textarea` uses standard events.

For full UI patterns (tables, filters, sort, security) see `vertesia-ui`; for tool-server scaffolding conventions see `vertesia-tool-server-resource`.
