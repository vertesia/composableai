# Vertesia Plugin Reference

Detailed code examples and templates for the plugin architecture. Referenced from SKILL.md.

## Table of Contents

- [Tool Creation](#tool-creation)
- [Skill Creation](#skill-creation)
- [Interaction Creation](#interaction-creation)
- [Content Type Creation](#content-type-creation)
- [Template Creation](#template-creation)
- [Admin UI](#admin-ui)
- [CSS Customization](#css-customization)
- [Deployment](#deployment)

---

## Tool Creation

### Schema file (`schema.ts`)

```typescript
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

### Tool definition (`index.ts`)

```typescript
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

Register the tool in its collection's `index.ts`, then add the collection to `src/tool-server/config.ts`.

---

## Skill Creation

### SKILL.md with YAML frontmatter

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

### Optional `properties.ts` for runtime behavior

```typescript
import { ToolUseContext } from "@vertesia/tools-sdk";
export default {
    isEnabled: async (context: ToolUseContext) => {
        return !!context.configuration?.myFeature;
    }
};
```

Optional `.tsx` widgets (compiled to `dist/widgets/`), `.py`/`.js` scripts (copied to `dist/scripts/`).

Skills are auto-discovered: the collection `index.ts` uses `import skills from './all?skills'` to find all subdirectories with `SKILL.md`.

---

## Interaction Creation

### Prompt template (`prompt.hbs`)

```handlebars
---
role: user
content_type: handlebars
schema: ./prompt_schema.ts
---
Analyze the following: {{input}}
```

### Interaction spec (`index.ts`)

```typescript
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

Register in the collection's `index.ts` and add to `config.ts`.

---

## Content Type Creation

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

---

## Template Creation

### TEMPLATE.md with YAML frontmatter

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

Asset files (SVG, LaTeX, images) in the same directory are auto-discovered and copied to `dist/templates/<collection>/<name>/`.

### Collection setup

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

Register in `src/tool-server/templates/index.ts` and add to `config.ts`.

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
