# Vertesia Plugin Template

Dual-architecture plugin: **Hono tool server** (backend) + **React UI plugin** (frontend), built and deployed as a single unit.

## Skill Auto-Invocation

IMPORTANT: You MUST invoke the relevant skill using the Skill tool BEFORE starting implementation for the task types below. Skills contain detailed, up-to-date patterns beyond what this file covers.

| When the task involves...                                                       | INVOKE this skill first         |
| ------------------------------------------------------------------------------- | ------------------------------- |
| Reviewing requirement docs, discovery notes, or feature/demo asks               | `vertesia-gap-assessment`       |
| Understanding plugin architecture, dual build system, or `config.ts`            | `vertesia-plugin`               |
| Adding tools, skills, interactions, types, templates, hooks, or subscriptions   | `vertesia-tool-server-resource` |
| Building or modifying React UI pages or components                              | `vertesia-ui`                   |
| Calling the Vertesia client API (objects, workflows, interactions, files)       | `vertesia-api`                  |
| Writing or debugging DSL workflows that call remote activities                  | `vertesia-dsl-workflow`         |
| Seeding the store with realistic demo objects                                   | `vertesia-demo-content`         |

### Typical "build a feature" loop

1. If the requirement is fuzzy or comes from a discovery doc → `vertesia-gap-assessment` first.
2. Need plugin context (build, layout, deployment) → `vertesia-plugin`.
3. Pick the implementation skill:
   - Backend resources (tools/skills/interactions/types/templates/hooks/subscriptions) → `vertesia-tool-server-resource`
   - UI page or component → `vertesia-ui`
   - Multi-step orchestration → `vertesia-dsl-workflow`
4. Add `vertesia-api` whenever the implementation reads or writes the platform.
5. Add `vertesia-demo-content` if you need real seed objects to exercise the feature end-to-end.

## Build & Dev Commands

```bash
{{PM_RUN}} build                 # Full build (server + UI), lint runs as prebuild
{{PM_RUN}} build:server          # Vertesia build tools: tool server only → lib/
{{PM_RUN}} build:ui:lib          # Vite: plugin library → dist/lib/plugin.js
{{PM_RUN}} build:ui:app          # Vite: standalone app → dist/app/
{{PM_RUN}} service:build         # Vertesia service build: UI + service runtime + app package metadata
{{PM_RUN}} service:build:server  # Vertesia service runtime and package metadata only

{{PM_RUN}} dev                   # Vite dev server with API middleware (https://localhost:5173)
{{PM_RUN}} start                 # Preview production build (build:server + vite preview)
{{PM_RUN}} test:unit             # Vitest regression suite (must contain app-owned behavioral tests)
PLAYWRIGHT_BASE_URL=<public-url> {{PM_RUN}} test:e2e  # Playwright primary-flow suite
```

Every generated app must keep at least one focused unit test and one app-owned Playwright test for its primary user-visible
workflow. Add or update both proportionally as behavior changes. A source-token search, screenshot-only assertion, or
placeholder/no-test command is not behavioral coverage. Playwright tests must be deterministic: mock the network boundary or
use uniquely owned fixtures with cleanup; never rely on mutable shared-project data. Assert user-observable responsive
behavior rather than a specific layout mechanism; only require horizontal overflow when scrolling is itself a requirement.
For intentional table scrolling, constrain the full flex/grid ancestor chain (`min-w-0` plus bounded widths), keep document
overflow at zero, and let only the labeled inner region scroll. Bring each vertically distant control into view immediately
before asserting it; do not require controls at opposite ends of the page to occupy the viewport simultaneously.

## Dual Build System

| Component   | Build path           | Entry                       | tsconfig                    | Output               |
| ----------- | -------------------- | --------------------------- | --------------------------- | -------------------- |
| Tool Server | Vertesia build tools | `src/tool-server/server.ts` | `tsconfig.tool-server.json` | `lib/`               |
| UI Plugin   | Vite                 | `src/ui/plugin.tsx`         | `tsconfig.ui.json`          | `dist/lib/plugin.js` |
| UI App      | Vite                 | `src/ui/main.tsx`           | `tsconfig.ui.json`          | `dist/app/`          |
| Widgets     | Vertesia build tools | `skills/**/*.tsx`           | `tsconfig.widgets.json`     | `dist/widgets/`      |

## Key Files

| File                          | Purpose                                              |
|-------------------------------|------------------------------------------------------|
| `src/tool-server/config.ts`   | Registers generated module collections               |
| `src/tool-server/settings.ts` | Plugin settings JSON Schema                          |
| `src/ui/plugin.tsx`           | Library entry for the Vertesia host app              |
| `src/ui/main.tsx`             | Standalone dev entry (VertesiaShell + AdminApp)      |
| `src/ui/shell/App.tsx`        | Shared app runtime (module providers + router)       |
| `src/modules/app/ui/routes.tsx` | User app route definitions                         |
| `src/modules/app/resources/`  | User app Vertesia resource definitions               |
| `src/ui/index.css`            | Tailwind CSS 4 entry with shared styles import       |

## UI Directory Structure

User application code lives under `src/modules/app/`. Place new app pages, features, and resources
there — `src/modules/app/README.md` has the full convention and the "add a feature" recipe.

```text
src/ui/
├── main.tsx, plugin.tsx, env.ts, index.css   ← bootstrap / wiring (don't add app code here)
├── i18n/
└── shell/                                     ← shared app runtime/chrome
    ├── App.tsx
    ├── components/
    └── layouts/

src/modules/app/                              ← user-owned app module
├── ui/
│   ├── routes.tsx
│   ├── pages/
│   ├── components/
│   ├── hooks/
│   └── features/<name>/
└── resources/
    ├── activities/
    ├── dashboards/
    ├── hooks/
    ├── interactions/
    ├── mcp/
    ├── skills/
    ├── subscriptions/
    ├── templates/
    ├── tools/
    └── types/
```

Rules of thumb:

- A new route → thin component in `src/modules/app/ui/pages/` that imports its feature.
- Self-contained business logic → `src/modules/app/ui/features/<name>/` with its own components/hooks/types.
- A primitive used by multiple app features → promote to `src/modules/app/ui/components/`.
- A hook used by multiple app features → promote to `src/modules/app/ui/hooks/`.

## Plugin-Specific Conventions

- ESM with `.js` import extensions in tool-server code: `import { x } from "./foo.js"`
- Type-safe definitions: `{} satisfies Tool<T>`, `{} satisfies InCodeTypeSpec`, `{} satisfies InteractionSpec`
- User contributions must be exported from `src/modules/app/resources/<type>/index.ts`
- Hooks use explicit definitions in `src/modules/app/resources/hooks/index.ts`: lifecycle hooks are `install`/`uninstall`; event hooks use kebab-case names and receive the canonical `{ event, delivery }` envelope
- Event subscriptions live in `src/modules/app/resources/subscriptions/index.ts` and reference a registered event hook by its local `name`; do not hardcode a deployed hook URL
- Standalone dev requires HTTPS (Firebase auth): <https://localhost:5173>
- Set `VITE_APP_NAME` in `.env.app`; use `.env.app.local` for local overrides
- Icons are SVG strings exported as default from `.ts` files

## App Identity And Portable IDs

The app name must stay aligned across `package.json` `name`, `VITE_APP_NAME`, the app manifest name,
and the `app:<name>:` namespace used for app-owned ids.

- App-owned content type refs are strings, not ObjectIds: use `app:<app-name>:<type-name>` directly in `client.objects.create({ type, ... })`.
- Do not resolve app-owned types through `client.types.list()` or store a project-local type ObjectId in app code.
- For content types, `<type-name>` is the declared type `name` and does not include the collection name.
- For interactions and activities, use the full id `app:<app-name>:<collection>:<name>`. Prefer a `main` collection unless there is a real reason to split collections.
- Do not name a collection after the app; that creates confusing ids like `app:<app-name>:<app-name>:<name>`.

## Version Build Target And Seeding

If the app registers backend resources under `src/modules/app/resources` or another active module, build the
version with target `service`. A `static` version contains only UI assets, so app-owned types, interactions,
activities, tools, skills, templates, and processes will not resolve.

Seed demo or test content from standalone scripts launched during development, not from the app UI or app API.
Do not add visible "Seed" buttons, auto-seed on UI load, or create `/api/seed` routes. App runtime code should
read real objects; seeding is a build/test concern.

## Cross-Cutting Pitfalls

Fast-path reminders — these bite often enough to flag here even though the relevant skill covers them:

- **Import hooks are server-build only**: `?skill`, `?skills`, `?prompt`, `?raw`, `?template`, `?templates` fail silently or error in Vite UI code. They work only in tool-server code.
- **Must export from module resource indexes**: a contribution that isn't added to `src/modules/app/resources/<type>/index.ts` won't be served. New contribution types also need an empty app-module default and must be added to the codegen `SERVER_RESOURCES` list so generated `src/tool-server/app-server-modules.ts` includes them.
- **Generated wiring is not user code**: do not hand-edit `src/tool-server/app-server-modules.ts`, `src/ui/app-ui-modules.tsx`, or `src/ui/app-ui-entry.tsx`; change module resource/route/provider exports instead.
- **`Input.onChange` takes the value directly** (`onChange={setValue}`), not a React event — `Textarea` uses standard events.

For full UI patterns (tables, filters, sort, security) see `vertesia-ui`; for tool-server scaffolding conventions see `vertesia-tool-server-resource`.
