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
pnpm check                 # Lint, typecheck, and app quality checks
pnpm build                 # Full service build with lint
pnpm build:app             # Vite: standalone app publish build -> dist/app/
pnpm build:service         # Vite app + plugin lib + tool server package build
pnpm build:server          # Server build only → lib/

pnpm dev                   # Vite dev server with API middleware (https://localhost:5173)
pnpm start                 # Preview production build (build:service + vite preview)
```

## Dual Build System

| Component   | Bundler | Entry                       | tsconfig                    | Output                |
|-------------|---------|-----------------------------|-----------------------------|-----------------------|
| Tool Server | Rolldown | `src/tool-server/server.ts` | `tsconfig.tool-server.json` | `lib/*.js`            |
| UI Plugin   | Vite    | `src/ui/plugin.tsx`         | `tsconfig.ui.json`          | `dist/lib/plugin.js`  |
| UI App      | Vite    | `src/ui/main.tsx`           | `tsconfig.ui.json`          | `dist/app/`           |
| Widgets     | Rolldown | `skills/**/*.tsx`           | `tsconfig.widgets.json`     | `dist/widgets/`       |

## Key Files

| File                          | Purpose                                              |
|-------------------------------|------------------------------------------------------|
| `src/tool-server/config.ts`   | Registers all collections — add new resources here   |
| `src/tool-server/settings.ts` | Plugin settings JSON Schema                          |
| `src/ui/plugin.tsx`           | Library entry for the Vertesia host app              |
| `src/ui/main.tsx`             | Standalone dev entry (VertesiaShell + plugin app)    |
| `src/ui/app/App.tsx`          | App root (NestedRouterProvider)                      |
| `src/ui/app/routes.tsx`       | Route definitions                                    |
| `src/ui/index.css`            | Tailwind CSS 4 entry with shared styles import       |

## UI Directory Structure

User application code lives under `src/ui/app/`. Place new files according to the layout below — `app/README.md` has the full convention and the "add a feature" recipe.

```text
src/ui/
├── main.tsx, plugin.tsx, env.ts, index.css   ← bootstrap / wiring (don't add app code here)
├── i18n/
└── app/                                       ← user application code
    ├── App.tsx, routes.tsx, constants.ts
    ├── components/    ← cross-feature shared components (generic primitives)
    ├── hooks/         ← cross-feature shared hooks
    ├── layouts/       ← plugin chrome (PluginLayout, PluginSidebar, …)
    ├── pages/         ← thin route-level wrappers (one file per route)
    └── features/<name>/
        ├── components/, hooks/, types.ts, utils.ts
        ├── <Feature>View.tsx
        └── index.ts   ← public barrel
```

Rules of thumb:

- A new route → thin component in `app/pages/` that imports its feature.
- Self-contained business logic → `app/features/<name>/` with its own components/hooks/types.
- A primitive used by ≥2 features (e.g. a sortable header) → promote to `app/components/`.
- A hook used by ≥2 features → promote to `app/hooks/`.

## Visual Defaults

Generated apps should look like compact Vertesia Studio product surfaces. Default
to a light operational UI with restrained brand accents unless the user
explicitly asks for a dark, immersive, or heavily branded treatment.

- Use `@vertesia/ui` components and semantic tokens (`bg-background`,
  `bg-card`, `border-border`, `text-muted`, `text-success`, `text-attention`,
  `text-destructive`) before hardcoded colors.
- Prefer tables, queues, filters, split panes, detail pages, and process
  timelines over hero sections, oversized cards, or presentation-style
  dashboards.
- Keep typography dense and restrained. Use `text-xl`/`text-2xl` for page
  titles and smaller headings inside panels.
- Do not force black/near-black backgrounds, neon palettes, or dark-first
  panels unless requested. If dark mode is useful, implement it with `.dark`
  variants and semantic tokens.
- Translate customer brand material into small accents, badges, labels, chart
  colors, and optional theme variables rather than full-page theming.

## App name is one value

The app name is a single value that MUST be identical in **four** places:

1. `package.json` `name`
2. `import.meta.env.VITE_APP_NAME` (set in `.env.app`)
3. The plugin manifest name
4. The `app:<name>:` namespace used for app-owned type ids, interaction ids, and activity ids

Always derive `app:` ids from `import.meta.env.VITE_APP_NAME` — e.g. `` `app:${import.meta.env.VITE_APP_NAME}:bookmark` `` — **never** a hardcoded string literal. A literal silently drifts from the real app name and breaks portability.

> **App-owned types are in-code strings, not ObjectIds.** A content object's `type` is EITHER a stored-type ObjectId OR an in-code-type string `app:<app-name>:<local>`. Portable apps MUST pass the in-code string directly: `client.objects.create({ type: 'app:<name>:<local>', ... })` is correct (the platform resolves it from the app's package, including during preview for the owner). NEVER resolve an app-owned type to a project-local ObjectId (e.g. a `useTypeIds`/`types.list`→id hook) — that is non-portable and an anti-pattern.

> **For TYPES, `<local>` is the declared type `name` — bare, no collection segment.** `app:<name>:contract` is correct; `app:<name>:contracts:contract` is the legacy alias. The `ContentTypesCollection` a type is registered in is code organization only and is NOT part of the type's identity — so type names MUST be unique across collections (the package build fails otherwise). This differs from interactions/activities/tools, where the collection IS part of the id (`app:<name>:<collection>:<interaction>`).

> **For INTERACTIONS / ACTIVITIES / TOOLS, name the collection `main`** unless you have a real reason to split into multiple collections. The id is `app:<name>:<collection>:<interaction>`, so a `main` collection gives the clean, predictable `app:<name>:main:<extract-furniture-item>`. **Never name the collection after the app** — `new InteractionCollection({ name: '<app-name>', ... })` produces the confusing double id `app:<name>:<name>:<interaction>`, and your code (and callers) will then reference the single-name form `app:<name>:<interaction>` and get 404 "Interaction not found". Pick `main` and reference `app:<name>:main:<interaction>` everywhere consistently.

## Publish target

An app that registers any backend resources (types, interactions, activities, tools, or skills) in `src/tool-server/config.ts` MUST publish as `service`. `static` is only for pure-UI apps with no `config.ts` registrations — a `static` publish ships no tool server, so app-owned types/interactions/activities won't resolve.

## Seeding

Seed the Store with demo/real objects from a **standalone script you launch during the build/test loop** — never from inside the app. Put it in `scripts/` (e.g. `scripts/seed.ts`) and run it yourself (`execute_shell`) so it creates objects via the Vertesia client against the app-owned in-code type: `client.objects.create({ type: 'app:<name>:<local>', ... })`. See the `vertesia-demo-content` skill.

Do **not**:

- add an in-app `/api/seed` route or a UI "Seed" button (the app must only **read** data, never own seeding — quality checks reject visible seed controls);
- auto-seed on UI load;
- seed with hardcoded Mongo ObjectIds or a different type id than the app-owned `app:<name>:<local>` the UI queries (that mismatch is why seeded rows don't show up).

A launched script keeps seeding a dev-time concern, idempotent, and decoupled from the runtime — much cleaner than a seed route that drifts from the app's types.

## Plugin-Specific Conventions

- ESM with `.js` import extensions in tool-server code: `import { x } from "./foo.js"`
- Type-safe definitions: `{} satisfies Tool<T>`, `{} satisfies InCodeTypeSpec`, `{} satisfies InteractionSpec`
- All collections must be registered in `src/tool-server/config.ts` (or its per-type index files)
- Standalone dev requires HTTPS (Firebase auth): <https://localhost:5173>
- Set `VITE_APP_NAME` in `.env.app`; use `.env.app.local` for local overrides
- Icons are SVG strings exported as default from `.ts` files

## Cross-Cutting Pitfalls

Fast-path reminders — these bite often enough to flag here even though the relevant skill covers them:

- **Import hooks are server-build only**: `?skill`, `?skills`, `?prompt`, `?raw`, `?template`, `?templates` fail silently or error in Vite UI code. They work only in tool-server code.
- **Must register in `config.ts`**: a collection that isn't wired into `config.ts` (or its per-type index) won't be served — and is silently dropped from the published package at publish.
- **`Input.onChange` takes the value directly** (`onChange={setValue}`), not a React event — `Textarea` uses standard events.

For full UI patterns (tables, filters, sort, security) see `vertesia-ui`; for tool-server scaffolding conventions see `vertesia-tool-server-resource`.
