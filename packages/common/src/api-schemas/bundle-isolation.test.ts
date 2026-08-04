import { existsSync, readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';

/**
 * Guards the packaging boundary that keeps schema-authoring runtime code out of ordinary
 * `@vertesia/common` and `@vertesia/client` consumers.
 *
 * `lib/index.js` is bundled wholesale into `lib/vertesia-common.js` by rolldown, and
 * `apps/composable-ui/build/shared-libs.ts` serves that single file to the browser mapped to the
 * bare specifier `@vertesia/common`. There is no per-consumer tree-shaking anywhere on that path,
 * so `import type` erasure in app code cannot save us: anything runtime-reachable from the root
 * barrel ships to every UI user.
 *
 * The rule this enforces: the root may re-export schema-derived TYPES (`export type`, erased by
 * tsc) but must never runtime-export `./api-schemas/*`. `@vertesia/client` is covered too — it is
 * shipped to the browser by the same mechanism, so a schema import there leaks just as badly. Its
 * default and Node.js entries are checked independently because this is also an SDK dependency
 * boundary for Node.js, serverless, CLI, and other JavaScript applications—not only a browser-size
 * concern.
 *
 * Runs against build output, so each artifact is skipped when it has not been built.
 */
const path = (relative: string) => new URL(relative, import.meta.url).pathname;

const COMMON_BUNDLE = path('../../lib/vertesia-common.js');
const COMMON_ENTRY = path('../../lib/index.js');
const CLIENT_BUNDLE = path('../../../client/lib/vertesia-client.js');
/** `.` and `./node` in the client's exports map — the latter is `lib/nodejs/index.js`, not `lib/index.js`. */
const CLIENT_ENTRIES = [
    { label: 'client default entry (.)', file: path('../../../client/lib/index.js') },
    { label: 'client node entry (./node)', file: path('../../../client/lib/nodejs/index.js') },
];

/** Markers that prove a runtime schema import leaked into a browser artifact. */
const FORBIDDEN = ['zod', '_zod', 'ZodObject', 'api-schemas', 'toOpenApiComponents', 'ApiSchemaComponents'];

/** Headroom over the current ~34 KB gzip; pulling zod in would add roughly 60 KB. */
const MAX_COMMON_GZIP_BYTES = 45 * 1024;

function expectNoSchemaRuntime(file: string, label: string): void {
    const contents = readFileSync(file, 'utf8');
    for (const marker of FORBIDDEN) {
        expect(contents, `${label} must not contain '${marker}'`).not.toContain(marker);
    }
}

describe.skipIf(!existsSync(COMMON_BUNDLE))('@vertesia/common runtime schema isolation', () => {
    it('does not runtime-reference the api-schemas subpath from the root entry', () => {
        expect(readFileSync(COMMON_ENTRY, 'utf8')).not.toContain('api-schemas');
    });

    it('contains no zod import or implementation code', () => {
        expectNoSchemaRuntime(COMMON_BUNDLE, 'common browser bundle');
    });

    it('stays within its gzip budget', () => {
        const gzipped = gzipSync(readFileSync(COMMON_BUNDLE)).byteLength;
        expect(
            gzipped,
            `common browser bundle grew to ${(gzipped / 1024).toFixed(1)} KB gzip — check whether a ` +
                'runtime schema export leaked into the root barrel',
        ).toBeLessThan(MAX_COMMON_GZIP_BYTES);
    });
});

describe.skipIf(!existsSync(CLIENT_BUNDLE))('@vertesia/client consumer runtime isolation', () => {
    it('contains no zod import or schema registry code', () => {
        // The client is served to the browser the same way common is, so importing
        // `@vertesia/common/api-schemas` from an SDK method would ship zod to every UI user.
        expectNoSchemaRuntime(CLIENT_BUNDLE, 'client browser bundle');
    });

    it.each(CLIENT_ENTRIES)('does not reference the api-schemas subpath from the $label', ({ label, file }) => {
        // Asserted rather than skipped: a missing artifact means the entry moved or stopped being
        // built, and silently passing would let a packaging regression through unnoticed.
        expect(existsSync(file), `${label} not found at ${file} — has the exports map changed?`).toBe(true);
        expect(readFileSync(file, 'utf8'), `${label} must not import api-schemas`).not.toContain('api-schemas');
    });
});
