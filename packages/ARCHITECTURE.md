# Package Architecture

This monorepo follows a strict layering: lower-level packages cannot depend on
higher-level ones. The bottom layer (`common`) is the bedrock — pure types,
constants, and schemas. Everything else builds upward.

## Layering

```
                ┌──────────────────────────────────────────────────────┐
   apps:        │  studio-server, token-server, zeno-server, …         │
                │  composable-ui, admin-ui, auth-ui, tools, docs, …    │
                └──────────────────────────────────────────────────────┘
                                       ↑
                ┌──────────────────────────────────────────────────────┐
   shared       │  @vertesia/studio-utils, @vertesia/ui                │
   logic:       │  @vertesia/client (SDK)                              │
                └──────────────────────────────────────────────────────┘
                                       ↑
                ┌──────────────────────────────────────────────────────┐
   bedrock:     │  @vertesia/common                                    │
                └──────────────────────────────────────────────────────┘
```

Arrows go upward only. A package may depend on anything strictly below it.

## Package contracts

### `@vertesia/common` — types & shared vocabulary

**Purpose**: The shared type/enum/constant foundation. Everything that crosses
package boundaries as DATA (wire shapes, validation schemas, enums) lives here.

**Allowed contents:**

- TypeScript types, interfaces, and type aliases (wire shapes, generic types)
- Enums and `as const` arrays/objects (data-only, no behavior)
- Zod schemas (validation specs as inert data)
- Simple type guards (pure narrowing, no compute)

**Forbidden contents:**

- Classes with methods (anything beyond a plain data shape)
- Functions that compute, validate at runtime, transform, or call out to anything
- Module-level mutable state, registries, side-effectful initializers
- Runtime dependencies on other workspace packages

**Dependencies**: Build-time only — `@vertesia/tsconfig`. Runtime: none.
(Exception: `@llumiverse/common` may be allowed for AI type primitives.)

**Consumers**: Anyone — client SDK, UI, server apps, studio-utils, build
tooling.

### `@vertesia/studio-utils` — shared logic

**Purpose**: Shared LOGIC between server and UI. Class hierarchies, registries,
helpers, validators, anything that has runtime behavior and is reused across
two or more applications.

**Allowed contents:**

- Classes with behavior (constructors, methods, hierarchies)
- Functions that compute, validate at runtime, transform, dispatch
- Module-level registries and state
- Interfaces / type aliases co-located with the logic that references them
  (e.g., a `RolePartition` interface that references the `Role` class lives in
  studio-utils alongside `Role`, not in common)

**Dependencies**: May depend on `@vertesia/common` and external libraries.
May not depend on other workspace packages (no `studio-server`, no `ui`,
no application-specific imports).

**Consumers**: Server apps (`studio-server`, `token-server`, `zeno-server`,
…) and UI apps (`composable-ui`, `admin-ui`, …). The client SDK should
ideally not depend on studio-utils — keep client SDK logic-thin and pull
shared helpers in at the application layer.

### `@vertesia/client` — JS SDK

**Purpose**: HTTP client for the Vertesia API. Provides typed methods
mirroring the server endpoints.

**Allowed contents**: ApiTopic classes (mostly trivial typed wrappers over
`fetch`), per-endpoint method signatures, request/response type imports.

**Dependencies**: `@vertesia/common`, `@vertesia/api-fetch-client`. Should
not depend on `studio-utils` (keep SDK lean for downstream consumers).

### `@vertesia/ui` — component library

**Purpose**: Reusable React components, hooks, i18n.

**Dependencies**: `@vertesia/common` (for wire types), `@vertesia/client`
(for SDK methods), `@vertesia/studio-utils` (for shared logic if needed).

## Hard rules

1. **`common` MUST NOT depend on any workspace package** (except possibly
   `@llumiverse/common`). This is the bedrock principle. If common depended
   on studio-utils, the layering would collapse into a cycle.

2. **Workspace packages depend in one direction only.** From the layering
   diagram: apps → shared logic → common. Never the reverse, never sideways
   in a way that creates a cycle.

3. **`client` should avoid depending on `studio-utils`**, even though it is
   technically allowed by the layering. The SDK is meant to be a thin typed
   wrapper. Heavy logic belongs in studio-utils or in application code.

## Operational tests at PR review time

When deciding where a new file belongs, apply these questions in order. The
first "yes" determines the package:

| Question | If yes |
|---|---|
| Does the file have a class with methods or constructor logic? | studio-utils |
| Does the file declare module-level mutable state, a registry, or a side-effectful initializer? | studio-utils |
| Does the file export functions that compute, validate at runtime, transform, or have side effects? | studio-utils |
| Does the file import from another workspace package (other than `@vertesia/common`)? | studio-utils |
| Could the file have a `.test.ts` next to it that tests behavior? | studio-utils |
| None of the above — only types, interfaces, enums, `as const` data, or Zod schemas? | common |

A quick rule of thumb: **if you'd write tests for it, it doesn't belong in
common.**

## Concrete example: the Roles system

This is the canonical example of the layering. The roles system has both
pure-type concerns (used by wire shapes) and rich logic concerns (class
hierarchy, registry, partition pattern).

### What lives in `common`

`composableai/packages/common/src/roles/types.ts`:

- `AbacScopes` — `as const` array of valid ABAC scope strings
- `AbacScope` — string union type derived from the array
- `RoleDomain` — string union for partition domain names
- `RoleDefinition<P>` — wire-shape interface returned by the IAM API
- `SystemRoleDefinition` — type alias for `RoleDefinition<Permission>`

These are pure data/types. No classes, no functions, no module-level state.
They are referenced by `RoleDefinition` (wire shape) and the IAM endpoint
response.

### What belongs in `studio-utils`

Everything else in `composableai/packages/common/src/roles/`:

- `classes.ts` — `Role<P>`, `SystemRole`, `AbacRole` classes; `RolePartition`
  interface (lives here because it references the `Role` class type)
- `system.ts` — the `system` role partition: 16 role classes + the partition
  registration object
- `content.ts` — the `content` role partition: 3 role classes + the partition
  registration object
- `index.ts` — the registry (`partitions: RolePartition[]`), public lookup
  functions (`getRoleByName`, `listRoles`, `listRolesByDomain`,
  `listAbacRolesForScope`, `listSystemRoles`, `getAllRoleNames`,
  `getPermissionsForRoles`), and the `RoleList` class
- `index.test.ts` — tests for the registry behavior

These files violate the common contract (classes, registries, side-effectful
imports) and will be relocated to `@vertesia/studio-utils` in a planned
migration.

### How adding a new partition works

When adding e.g. a `tasks` partition:

1. **In common (`roles/types.ts`)**: add `'task'` to `AbacScopes` if a new
   scope is introduced; add `'tasks'` to `RoleDomain`. Pure-type edits.

2. **In studio-utils (post-migration) / common roles/ (today)**: create
   `roles/tasks.ts` with the partition's role enum, role class definitions,
   and partition registration object. Register the partition in
   `roles/index.ts`.

The split mirrors the conceptual change: common changes when the WIRE
VOCABULARY expands (a shared concern); studio-utils changes when the LOGIC
expands (an implementation concern).

### Why client SDK and UI don't depend on studio-utils for role types

The client SDK and UI consume the IAM `/roles` and `/roles/system` endpoints
and receive `RoleDefinition[]` / `SystemRoleDefinition[]`. Both types live
in `common`. The internal class hierarchy (`Role`, `SystemRole`, `AbacRole`)
is purely server-side — clients work with the wire shape, not the classes.

So the client SDK imports `RoleDefinition` and `SystemRoleDefinition` from
`@vertesia/common` directly — no dependency on studio-utils needed.

The UI's `UserPermissionsProvider` is similar: it consumes
`SystemRoleDefinition[]` from the typed `listSystem()` SDK method. The
permission strings inside are `Permission` enum values, also in common. No
studio-utils dependency.

## Adding new shared types

If a new wire shape or constant is needed across packages:

1. Define it in `@vertesia/common` (in an existing file if it fits, or a new
   one if not).
2. Re-export from the package's `index.ts`.
3. Consumers `import { … } from '@vertesia/common'`.

If you find yourself wanting to add a class, function, or registry to common,
**stop** — that belongs in studio-utils. The operational test above is the
quickest way to settle the placement.
