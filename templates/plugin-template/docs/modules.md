# Template Modules

The plugin template is composed from modules declared in `template.config.json`.

`create-plugin` selects modules with `--module`. If no module is provided, the conventional `default`
module is used.

Generated apps reserve `src/modules/app` for user-owned code. UI pages/routes/components should go
under `src/modules/app/ui`; Vertesia resources should go under `src/modules/app/resources`.
The `app` module is always active and does not need to be listed in `requires`.

```bash
create-plugin my-app
create-plugin my-app --module default
create-plugin my-app --module appgen
create-plugin my-app --module assistant,examples
create-plugin my-app --module assistant --module examples
```

Modules may be virtual. A virtual module has no source directory and only expands to its `requires`
dependencies.

```json
{
  "modules": {
    "default": {
      "virtual": true,
      "requires": ["assistant", "examples"]
    }
  }
}
```

If no active module declares `ui.entry`, generated apps use the built-in Studio shell entry from
`src/ui/AppEntry.tsx`. A module can declare `ui.entry` only when it needs to replace that bootstrap,
for example an app-gateway runtime entry.

The template includes an `app-gateway` module for app-gateway runtimes. It is not part of `default`;
select it explicitly when the scaffolded app is hosted by the app gateway and needs gateway routes
and token-backed shell initialization.

The `agent` module preserves agent-facing scaffold helpers under `src/modules/agent/ui`.
It does not add routes, providers, or resources. The virtual `appgen` module selects both
`app-gateway` and `agent`; combine it with app-specific modules such as `assistant` or `content-app`
when creating appgen scaffolds.

UI contributions live under the `ui` key. Vertesia resource contributions live under `resources`:

```json
{
  "modules": {
    "assistant": {
      "ui": {
        "routes": "src/modules/assistant/ui/routes",
        "provider": "src/modules/assistant/ui"
      }
    },
    "app": {
      "ui": {
        "routes": "src/modules/app/ui/routes"
      },
      "resources": "src/modules/app/resources"
    },
    "examples": {
      "resources": "src/modules/examples/resources"
    }
  }
}
```

During scaffold, `create-plugin` runs the template lifecycle script declared in `template.config.json`:

```json
{
  "lifecycle": {
    "codegen": "scripts/dist/codegen.js"
  }
}
```

The script runs from the generated package root and receives a JSON context file:

```bash
node scripts/dist/codegen.js --context .create-plugin-context.json
```

The codegen script:

1. Resolves selected modules and their `requires` dependencies.
2. Generates `src/ui/app-ui-entry.tsx`, the top-level `AppEntry` selector.
3. Generates `src/ui/app-ui-modules.tsx`, the route/provider module aggregator.
4. Generates `src/tool-server/app-server-modules.ts`, the Vertesia resource aggregator.
5. Removes inactive concrete module directories from `src/modules`.

Template maintainers can edit the generated files directly while developing the template:

- `src/ui/app-ui-entry.tsx`
- `src/ui/app-ui-modules.tsx`
- `src/tool-server/app-server-modules.ts`

Before committing, run codegen with the desired module context so the checked-in composition matches
the default template configuration.

The generated app removes `scripts/` after scaffold, so lifecycle code does not become part of user
projects.
