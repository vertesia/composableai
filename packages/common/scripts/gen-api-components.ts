/**
 * Generates `src/api-contract/components.generated.json` — the published `components.schemas` for
 * every documented endpoint, emitted from the Zod registry.
 *
 * The authored source is the Zod schemas in `src/api-schemas/*.ts`. This writes their emission —
 * through the SAME adapter that produces the OpenAPI components, so the artifact and the published
 * contract cannot describe different shapes — into a plain JSON document that
 * `src/api-contract/index.ts` imports.
 *
 * Why an artifact at all: building the Zod object graph costs ~85 MB of heap at module load, and
 * every Node service that enforces API contracts was paying it just to re-derive JSON Schema that
 * never changes between builds. AJV validates from JSON, so the conversion belongs at build time.
 * See the comment at the top of `src/api-contract/index.ts`.
 *
 * Run through `tsx` and imports `../src`, NOT `../lib` — same reasoning as
 * `gen-intake-policy-schema.ts`: reading the build output would make the declared command fail on a
 * clean checkout, silently generate from the previous build after a source edit, and leave the
 * packaged `lib` stale whenever it did run.
 *
 * The output is COMPILED OUTPUT, not a second definition:
 * `src/api-contract/components.contract.test.ts` fails if it drifts from the Zod registry. Run
 * `pnpm run gen:schemas` after editing any API schema.
 *
 * Written with `JSON.stringify(..., 2)` and a trailing newline, which is what Biome's JSON formatter
 * produces, so the result is committable without a follow-up format pass.
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { buildApiSchemaComponents } from '../src/api-schemas/registry.js';

const output = fileURLToPath(new URL('../src/api-contract/components.generated.json', import.meta.url));

const components = buildApiSchemaComponents();
writeFileSync(output, `${JSON.stringify(components, null, 2)}\n`);

console.log(`Wrote ${Object.keys(components).length} components to ${output}`);
