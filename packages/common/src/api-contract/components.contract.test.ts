import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildApiSchemaComponents } from '../api-schemas/registry.js';
import { ApiSchemaComponents } from './index.js';

/**
 * Guards the two properties that make `components.generated.json` safe to serve from.
 *
 * 1. It is COMPILED OUTPUT, not a second source of truth. The Zod registry remains the authority;
 *    the artifact is its emission. If they diverge, servers enforce a contract the spec no longer
 *    describes — silently, since nothing else compares them.
 * 2. Nothing reachable from the subpath imports zod. That is the entire reason the artifact exists:
 *    building the Zod graph costs ~85 MB of heap in every process that enforces contracts, which is
 *    enough to push a small API process past its memory limit.
 */
describe('api-contract components artifact', () => {
    it('matches the Zod registry exactly', { timeout: 30_000 }, () => {
        // Fails when an API schema was edited without re-running the generator, and equally when the
        // artifact was regenerated but not committed — a CI checkout then has new Zod against old JSON.
        // Rebuilding the full registry is CPU-heavy and can exceed Vitest's default timeout under parallel CI.
        expect(
            ApiSchemaComponents,
            'components.generated.json is stale — run `pnpm run gen:schemas` in packages/common',
        ).toEqual(buildApiSchemaComponents());
    });

    it('round-trips through JSON without loss', () => {
        // The artifact is only equivalent to the in-memory emission if every value survives
        // serialization. An `undefined` property would vanish on write and change the contract.
        expect(JSON.parse(JSON.stringify(ApiSchemaComponents))).toEqual(ApiSchemaComponents);
    });
});

const BUILT_ENTRY = new URL('../../lib/api-contract/index.js', import.meta.url).pathname;

/**
 * Every module Node actually resolves while importing the built subpath.
 *
 * Inspecting the entry file alone is not enough: it imports `adapter.js` and `parameters.js`, and if
 * either ever grows a zod import — directly or through a package of its own — the entry's own text
 * still mentions nothing and a text check passes while the servers load zod again. A `resolve` hook
 * records the real graph, transitively, including everything under `node_modules`.
 *
 * Run in a child process because the hook has to be installed before the first import, and this test
 * file has already imported the registry (and therefore zod) into its own process.
 */
function resolveRuntimeGraph(entry: string): string[] {
    const probe = `
        import { registerHooks } from 'node:module';
        const resolved = [];
        registerHooks({
            resolve(specifier, context, nextResolve) {
                const result = nextResolve(specifier, context);
                resolved.push(result.url);
                return result;
            },
        });
        await import(${JSON.stringify(entry)});
        console.log(JSON.stringify(resolved));
    `;
    const out = execFileSync(process.execPath, ['--input-type=module', '-e', probe], { encoding: 'utf8' });
    return JSON.parse(out.trim().split('\n').pop() as string) as string[];
}

const packageOf = (url: string): string | undefined =>
    url.match(/node_modules\/(?:\.pnpm\/[^/]+\/node_modules\/)?((?:@[^/]+\/)?[^/]+)/)?.[1];

describe.skipIf(!existsSync(BUILT_ENTRY))('api-contract zod isolation', () => {
    it('does not reference zod or the Zod registry from the entry file', () => {
        // `index.ts` imports `ApiComponentName`/`ApiComponentType` from the registry with
        // `import type`, which tsc elides. Dropping the `type` keyword would compile fine and quietly
        // pull the whole graph back into every server, so assert on the emitted JavaScript.
        const emitted = readFileSync(BUILT_ENTRY, 'utf8');
        for (const marker of ['zod', '_zod', 'ZodObject', 'registry.js']) {
            expect(emitted, `built api-contract entry must not reference '${marker}'`).not.toContain(marker);
        }
    });

    it('loads no zod module anywhere in its transitive runtime graph', () => {
        const graph = resolveRuntimeGraph(BUILT_ENTRY);
        // Guards against a vacuous pass: an entry that failed to import, or a hook that recorded
        // nothing, would otherwise satisfy every assertion below.
        expect(graph.length, 'resolve hook recorded no modules — the probe did not run').toBeGreaterThan(10);

        const packages = [...new Set(graph.map(packageOf).filter(Boolean))].sort();
        const offenders = graph.filter((url) => /node_modules\/(?:\.pnpm\/)?zod[@/]/.test(url));
        expect(
            offenders,
            `zod reached the api-contract runtime graph — the ~85 MB object graph is back in every ` +
                `server that enforces contracts. Packages resolved: ${packages.join(', ')}`,
        ).toEqual([]);

        expect(
            graph.filter((url) => /api-schemas\/registry\.js$/.test(url)),
            'the Zod registry is in the runtime graph — an `import type` lost its `type` keyword',
        ).toEqual([]);
    });
});
