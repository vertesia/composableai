// GENERATED FILE — DO NOT EDIT.
//
// Written by `scripts/gen-intake-policy-schema.ts` from `ContentTypeEditingPolicySchema` in
// `../api-schemas/store.ts`, through the same adapter that emits the OpenAPI components. Edit the Zod
// schema and re-run `pnpm run gen:schemas`; `store.contract.test.ts` fails if this drifts from the
// canonical component, and fails too if it accepts a value the Zod schema rejects.
//
// It exists so the Studio policy editors and the server validators get a self-contained JSON
// Schema without importing Zod: the package root exports plain data, and `zod` stays out of every
// browser bundle. The component's `$ref`s are re-rooted from `#/components/schemas/` to `#/$defs/`
// so AJV and Monaco can compile it standalone.
//
// It carries the name consumers have always imported. The Zod object it was emitted from is exported
// under the same name from `../api-schemas/store.ts`, which the package root does NOT re-export —
// that split is what keeps zod out of the browser while the alias-provenance gate still sees the
// `${Name}Schema` convention it requires.

import type { JSONObject } from '../json.js';

export const ContentTypeEditingPolicySchema: JSONObject = {
    type: 'object',
    properties: {
        interaction: {
            type: 'string',
            description: 'Agent interaction used for new document-editing sessions. Defaults to sys:GeneralAgent.',
        },
    },
    additionalProperties: false,
    description: 'Per-content-type policy for collaborative document editing.',
};
