# @vertesia/appgen-docs

Generated SDK declarations and focused development guidance used by Vertesia app agents.

`build` compiles only the package entrypoint. `build:docs` reads the current composableai workspace
outputs for `@vertesia/ui`, `@vertesia/client`, and `@vertesia/common`, then writes the published
documentation under `lib/docs/`. The two are separate Turbo tasks so that packages depending on this
one (Studio's workflows, and through it every backend service) do not wait for the `@vertesia/ui`
build; only a consumer that reads the documentation depends on `build:docs`. The tool-server resource
guide is copied from the plugin template's canonical
`.agents/skills/vertesia-tool-server-resource/REFERENCE.md` during `build:docs`.

Consumers can locate the installed documentation with:

```ts
import { appgenDocsRoot } from '@vertesia/appgen-docs';
```

The stable `frontend-imports.md` guidance intentionally does not contain a bundled CDN catalog.
Consumers add the import specifiers exposed by their actual runtime UI deployment.
