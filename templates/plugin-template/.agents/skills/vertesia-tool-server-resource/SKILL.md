---
name: vertesia-tool-server-resource
description: Creates tools, skills, interactions, content types, and rendering templates for the Vertesia plugin tool server. Handles file scaffolding and module resource index wiring. Use when adding new tool server resources to this plugin.
---

# Vertesia Tool Server Resource

Step-by-step guide for creating tool server resources. Each resource follows the same workflow:

1. Create files in the appropriate `src/modules/app/resources/<type>/<collection>/` directory
2. Export from the collection's `index.ts`
3. Register the collection in `src/modules/app/resources/<type>/index.ts` (only when adding a new collection)

For full code templates of every resource type, see `REFERENCE.md`.

## Conventions

- All imports use `.js` extensions: `import { x } from "./foo.js"`
- Use `satisfies` for type validation (`{} satisfies Tool<T>`, `{} satisfies InCodeTypeSpec`, …)
- Icons are SVG strings exported as default from `.ts` files
- Import hooks (`?skill`, `?skills`, `?prompt`, `?template`, `?templates`, `?raw`) only work in Rollup-compiled tool-server code, **not** in UI code
- Snake_case for resource names (`my_tool`, `my_type`); PascalCase for TypeScript exports (`MyTool`, `MyType`)
- User-owned resources live in `src/modules/app/resources/<type>/`
- See `src/modules/examples/resources/<type>/` for working starter code when the examples module is available

## Resource types

### Tool

Three files in `src/modules/app/resources/tools/<collection>/<tool-name>/`:

| File | Purpose |
|------|---------|
| `schema.ts` | TypeScript interface + JSONSchema (`satisfies JSONSchema`) |
| `<impl>.ts` | The `run` function — uses `ToolExecutionPayload<P>`, returns `ToolResultContent` |
| `index.ts` | `Tool<P>` definition (`satisfies Tool<ParamsT>`) |

Then export from `src/modules/app/resources/tools/<collection>/index.ts` as a `ToolCollection`.

→ Code in `REFERENCE.md` § Tool.

### Skill

Files in `src/modules/app/resources/skills/<collection>/<skill-name>/`:

| File | Required | Purpose |
|------|----------|---------|
| `SKILL.md` | yes | YAML frontmatter + instructions for the agent |
| `properties.ts` | no | Runtime gating (`isEnabled`) |
| `*.tsx` | no | Widgets (compiled to `dist/widgets/`) |
| `*.py`, `*.js` | no | Scripts (copied to `dist/scripts/`) |

Skills are auto-discovered: the collection imports `./all?skills` — no per-skill imports needed.

→ Code in `REFERENCE.md` § Skill.

### Interaction

Two flavors:

- **Template-based** — `prompt.hbs` + `prompt_schema.ts` + `result_schema.ts` + `index.ts` (`InteractionSpec` importing the prompt via `?prompt`).
- **Code-based** — `index.ts` only, with `prompts: [{ role, content, content_type }, …]` inline. Use this for agents/conversations.

Then export from `src/modules/app/resources/interactions/<collection>/index.ts` as an `InteractionCollection`.

→ Code in `REFERENCE.md` § Interaction (template-based) and § Interaction (code-based).

### Content Type

One file per type in `src/modules/app/resources/types/<collection>/<type-name>.ts` (`InCodeTypeSpec`), then a `ContentTypesCollection` in `types/<collection>/index.ts`.

Key fields: `name` (snake_case), `object_schema` (JSON Schema with `additionalProperties: false`), `table_layout` (columns for the UI), `is_chunkable`, `strict_mode`.

The type's public app id is its bare `name`: `app:<app-name>:<type-name>`. The collection is code organization
only for content types and is not part of the public id. Type names must therefore be unique across collections.

→ Code in `REFERENCE.md` § Content Type.

### Rendering Template

Folder per template in `src/modules/app/resources/templates/<collection>/<template-name>/`:

- `TEMPLATE.md` with YAML frontmatter (`description`, `type: 'document' | 'presentation'`, optional `title`, `tags`)
- Asset files (SVG, LaTeX, PNG) — auto-discovered, copied to `dist/templates/`

Templates are auto-discovered: the collection imports `./all?templates`.

→ Code in `REFERENCE.md` § Rendering Template.

## Collection registration

Once a collection is exported from `src/modules/app/resources/<type>/<collection>/index.ts`, add it to the array in `src/modules/app/resources/<type>/index.ts`:

```typescript
// src/modules/app/resources/tools/index.ts
import { MyTools } from "./my-collection/index.js";

export const tools = [MyTools];
```

`src/tool-server/app-server-modules.ts` is generated from active modules and `config.ts` imports from it, so no further server wiring is needed.

Each collection needs an SVG `icon.svg.ts` (default string export). Code in `REFERENCE.md` § Collection registration & icons.

For interactions and activities, prefer naming the default collection `main`. Runtime ids include the collection
name, so `main` gives stable ids like `app:<app-name>:main:<interaction-name>`. Avoid naming a collection after
the app, which creates redundant ids such as `app:<app-name>:<app-name>:<interaction-name>`.

## Verification

After creating a resource:

1. `pnpm build:server`
2. `pnpm start`
3. Check the admin UI at `http://localhost:3000/` — your resource should appear.
4. Or hit the API: `curl http://localhost:3000/api/tools` (or `/skills`, `/interactions`, `/types`, `/templates`).
