# @vertesia/appgen-docs

Generated SDK declarations and focused development guidance used by Vertesia app agents.

The package build reads the current composableai workspace outputs for `@vertesia/ui`,
`@vertesia/client`, and `@vertesia/common`, then writes the published documentation under
`lib/docs/` so the package entrypoint and documentation are restored together from build caches.

Consumers can locate the installed documentation with:

```ts
import { appgenDocsRoot } from '@vertesia/appgen-docs';
```

The stable `frontend-imports.md` guidance intentionally does not contain a bundled CDN catalog.
Consumers add the import specifiers exposed by their actual runtime UI deployment.
