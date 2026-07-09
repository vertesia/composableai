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
for example a gateway-app runtime entry.

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
2. Generates `src/ui/app-ui-modules.tsx`.
3. Generates `src/tool-server/app-server-modules.ts`.
4. Removes inactive concrete module directories from `src/modules`.

Template maintainers can edit `src/ui/app-ui-modules.tsx` and `src/tool-server/app-server-modules.ts`
directly while developing the template. Before committing, run codegen with the desired module context
so the checked-in composition matches the default template configuration.

The generated app removes `scripts/` after scaffold, so lifecycle code does not become part of user
projects.
