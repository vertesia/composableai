# Vertesia Plugin Reference

Additional details for the plugin architecture. Referenced from SKILL.md.

## Table of Contents

- [Admin UI](#admin-ui)
- [CSS Customization](#css-customization)
- [Deployment](#deployment)

For resource creation code examples (tools, skills, interactions, types, templates), use the **write-tool-server-resource** skill.

---

## Admin UI

The admin UI (`@vertesia/tools-admin-ui`) provides a browsable interface for all plugin resources. It is mounted alongside the plugin app in dev mode.

### Integration in `main.tsx`

```typescript
import { AdminApp } from '@vertesia/tools-admin-ui'

const routes: Route[] = [
    { path: "*", Component: AdminApp },      // Admin UI at /
    { path: "app/*", Component: AppWrapper }, // Plugin app at /app/
]
```

### API endpoints fetched

| Endpoint | Data |
|----------|------|
| `GET /api` | Server info (name, version, endpoints) |
| `GET /api/interactions` | Interaction collections and refs |
| `GET /api/tools` | Tool collections and definitions |
| `GET /api/skills` | Skill collections (exposed as tools) |
| `GET /api/types` | Content type collections and schemas |
| `GET /api/templates` | Template collections and refs |
| `GET /api/package?scope=widgets` | Widget info per skill collection |

### Routes

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

### Standalone development

```bash
cd composableai/packages/tools-admin-ui
cp .env.local.example .env.local  # Set VITE_API_BASE_URL to your running tool server
pnpm dev                          # Vite dev server on http://localhost:5174
```

---

## CSS Customization

Override CSS custom properties **after** the shared `@vertesia/ui` import in `index.css`:

```css
@layer base {
  :root {
    --primary: oklch(55% 0.2 145);            /* light mode */
    --primary-background: oklch(97% 0.02 145);
  }
  .dark {
    --primary: oklch(75% 0.18 145);            /* dark mode */
    --primary-background: oklch(75% 0.18 145 / 0.2);
  }
}
```

Available tokens: `--primary`, `--success`, `--attention`, `--destructive`, `--done`, `--info`, `--muted` (each with a `-background` variant), plus `--background`, `--foreground`, `--card-*`, `--sidebar-*`, `--topnav-*`, `--border`, `--input`, `--ring`. See `@vertesia/ui/src/css/color.css` for all values.

---

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

### Organization Access Restriction

Set `VERTESIA_ALLOWED_ORGS` to restrict to specific orgs:

```bash
VERTESIA_ALLOWED_ORGS=org_abc123,org_def456
```

Enforced by `@vertesia/tools-sdk`'s `authorize()` middleware — no code changes needed. Requests from unlisted orgs get `403 Forbidden`.
