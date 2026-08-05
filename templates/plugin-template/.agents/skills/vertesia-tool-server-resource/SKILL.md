---
name: vertesia-tool-server-resource
description: Creates tools, skills, interactions, content types, rendering templates, hooks, and event subscriptions for the Vertesia plugin tool server. Handles file scaffolding and module resource index wiring. Use when adding new tool server resources to this plugin.
---

# Vertesia Tool Server Resource

Step-by-step guide for creating tool server resources. Each resource follows the same workflow:

1. Create files in the appropriate `src/modules/app/resources/<type>/<collection>/` directory
2. Export from the collection's `index.ts`
3. Register the collection in `src/modules/app/resources/<type>/index.ts` (only when adding a new collection)

For full code templates of every resource type, see `REFERENCE.md`.

Application hooks and event subscriptions are definitions rather than resource collections. They are still app-owned
contributions: register hooks under `src/modules/app/resources/hooks/` and subscriptions under
`src/modules/app/resources/subscriptions/`.

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

### Application Hooks

Use an install or uninstall hook when the app must initialize or clean up project data as part of its installation
lifecycle. Hooks receive an authenticated context with the current project token and `getClient()`.

- Implement hooks in `src/modules/app/resources/hooks/install.ts` or `uninstall.ts`.
- Register named hook definitions in `src/modules/app/resources/hooks/index.ts`.
- Make install behavior idempotent. Studio may invoke it again during a reinstall or an explicit recovery.
- Do not use hooks to materialize app-owned package types as project-local types. Use portable `app:<app>:<type>` refs.

→ Code in `REFERENCE.md` § Application lifecycle hooks.

Use an event hook for authenticated event-bus webhook deliveries. Event hooks receive the platform event envelope and
the same authenticated client context as tools.

- Implement event hooks in `src/modules/app/resources/hooks/<hook-name>.ts`.
- Use a kebab-case name; `install` and `uninstall` are reserved.
- Register `{ kind: 'event', name, description, handler }` in the hooks index.
- Inspect registered event hooks through `/api/package?scope=hooks`.

→ Code in `REFERENCE.md` § Application event hooks.

### Event Subscription

Use an app-owned subscription to route matching platform events to an event hook registered by the same app.

- Register definitions in `src/modules/app/resources/subscriptions/index.ts`.
- Give each definition a stable kebab-case `id`.
- Set `hook` to an `AppEventHookDefinition.name`; lifecycle hooks are not valid targets.
- Define the event `filter` and required `run_as_role`, normally `automation`.
- Do not set a URL or scope. Studio derives the project scope and deployed hook URL during installation.
- Inspect contributions through `/api/package?scope=subscriptions`.

→ Code in `REFERENCE.md` § Application event subscriptions.

## Collection registration

Once a collection is exported from `src/modules/app/resources/<type>/<collection>/index.ts`, add it to the array in `src/modules/app/resources/<type>/index.ts`:

```typescript
// src/modules/app/resources/tools/index.ts
import { MyTools } from "./my-collection/index.js";

export const tools = [MyTools];
```

`src/tool-server/app-server-modules.ts` is generated from active modules and `config.ts` imports from it, so no further server wiring is needed.

Do not add app-owned registries directly under `src/tool-server`. When the platform introduces a new contribution
type, add its typed empty default under `src/modules/app/resources`, export it from the module resource index, and
update the template codegen `SERVER_RESOURCES` list so the generated aggregator includes it.

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
