/**
 * Generates the browser-safe JSON Schema for `ContentTypeIntakePolicy`.
 *
 * The authored source is the Zod schema in `src/api-schemas/store.ts`. This writes its emission —
 * through the SAME adapter that produces the OpenAPI components, so the artifact and the published
 * component cannot describe different shapes — into a plain TypeScript module that the package root
 * re-exports. That is what lets zeno-server, the workflow tool and the Studio intake-policy editor
 * keep compiling a plain JSON Schema without any of them importing Zod.
 *
 * Run through `tsx` and imports `../src`, NOT `../lib`. Reading the build output would make the
 * declared command fail on a clean checkout (nothing tracked under `lib`), silently generate from the
 * previous build after a source edit, and leave the packaged `lib` stale whenever it did run. The
 * source is the input for the same reason it is the source of truth.
 *
 * The output is COMPILED OUTPUT, not a second definition: `src/api-schemas/store.contract.test.ts`
 * fails if it drifts from the component. Run `pnpm run gen:schemas` after editing the Zod schema.
 *
 * `gen:schemas` runs `biome format --write` over the result, because `JSON.stringify` and Biome
 * disagree about quotes and array wrapping. Without it the declared command leaves the repository
 * failing `format:check`, and the artifact would only become committable after someone remembered to
 * run a second, undeclared command.
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { buildApiSchemaComponents, bundleCanonicalComponent } from '../src/api-schemas/registry.js';

/** Canonical component -> the artifact module that publishes it as plain JSON Schema. */
const ARTIFACTS = [
    { component: 'ContentTypeIntakePolicy', output: 'intake-policy-schema.generated.ts' },
    { component: 'ContentTypeEditingPolicy', output: 'editing-policy-schema.generated.ts' },
];

const header = (component: string) => `// GENERATED FILE — DO NOT EDIT.
//
// Written by \`scripts/gen-intake-policy-schema.ts\` from \`${component}Schema\` in
// \`../api-schemas/store.ts\`, through the same adapter that emits the OpenAPI components. Edit the Zod
// schema and re-run \`pnpm run gen:schemas\`; \`store.contract.test.ts\` fails if this drifts from the
// canonical component, and fails too if it accepts a value the Zod schema rejects.
//
// It exists so the Studio policy editors and the server validators get a self-contained JSON
// Schema without importing Zod: the package root exports plain data, and \`zod\` stays out of every
// browser bundle. The component's \`$ref\`s are re-rooted from \`#/components/schemas/\` to \`#/$defs/\`
// so AJV and Monaco can compile it standalone.
//
// It carries the name consumers have always imported. The Zod object it was emitted from is exported
// under the same name from \`../api-schemas/store.ts\`, which the package root does NOT re-export —
// that split is what keeps zod out of the browser while the alias-provenance gate still sees the
// \`\${Name}Schema\` convention it requires.

`;

// Emitted fresh from the Zod schemas rather than read from `api-contract/components.generated.json`.
// That artifact is another generator's output, so bundling from it would derive these policies from
// whatever contract was committed last — and, depending on the order `gen:schemas` happens to run its
// steps in, could leave the two generated files describing different shapes from a single run.
const components = buildApiSchemaComponents();

for (const { component, output } of ARTIFACTS) {
    const schema = bundleCanonicalComponent(component, components);
    // Annotated as `JSONObject` rather than left to infer, and not for brevity: an `as const` literal
    // of this size becomes a 1700-line literal type in the emitted `.d.ts`, and the OpenAPI scanner
    // then walks it — which drags the submodule's SOURCE tree into its program alongside the built
    // `.d.ts` files and makes every canonical alias look declared twice. Consumers treat it as opaque.
    const body =
        `import type { JSONObject } from '../json.js';\n\n` +
        `export const ${component}Schema: JSONObject = ${JSON.stringify(schema, null, 4)};\n`;
    const path = fileURLToPath(new URL(`../src/store/${output}`, import.meta.url));
    writeFileSync(path, header(component) + body);
    console.log(`wrote ${path} (${Object.keys(schema.$defs ?? {}).length} $defs)`);
}
