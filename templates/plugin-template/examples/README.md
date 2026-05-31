# Examples — working reference implementations

These are **real, working** Vertesia plugin features kept as a reference. They are
**not part of the build**: `examples/` sits outside `src/`, so vite, rollup, and
the typecheckers ignore it. The default app surface (`src/ui/app/`) ships minimal
on purpose — a Home page plus the built-in assistant chat — so you build only what
the request needs instead of deleting scaffolding you don't.

## How to use these

Read the example that matches what you're building, then **copy the relevant
files into `src/` and adapt them** (fix the relative import paths — examples were
authored at `src/ui/app/...`, so `../layouts` etc. become whatever's correct from
their new location). Wire any new page into `src/ui/app/routes.tsx`; register any
app-owned tool/type/interaction into `src/tool-server/<kind>/index.ts`.

Don't ship the examples as-is, and don't leave example routes/resources the app
doesn't use.

## What's here

### `ui/` — UI feature references (client-side, read data via `useUserSession().client.*`)
- `features/content-objects/` + `pages/ContentObjectsPage.tsx`, `pages/ContentObjectDetailPage.tsx`
  — the canonical **Store-object list + detail**: `client.objects.search`, table with
  sortable headers, inline filters, infinite scroll, a detail view. This is the
  pattern for any data viewer/list/dashboard.
- `features/conversations/` + `pages/ConversationsPage.tsx` — listing agent runs
  via `client.runs.*`.
- `pages/SettingsPage.tsx` — a settings page pattern.

### `tool-server/` — server-capability references (only for apps that OWN server behavior)
- `tools/` — a `calculator` tool (params schema + handler).
- `interactions/` — `assistant` and `what_color` interactions (`.hbs?prompt` + schemas).
- `types/` — an `article` content type (`InCodeTypeSpec`).
- `skills/`, `templates/`, `activities/` — skill, rendering-template, and activity references.

Register these in the matching `src/tool-server/<kind>/index.ts` (the defaults are
empty arrays) and publish with `target: "service"`. A read-only data viewer needs
**none** of this — it's a static UI calling the client directly.
