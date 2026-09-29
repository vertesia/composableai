import { readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';

/**
 * Keep schema-authoring code out of the common browser bundle and public root entry.
 * Build outputs are required; Turbo builds this package before running its tests.
 * Client packaging is tested by the client package.
 */
const path = (relative: string) => new URL(relative, import.meta.url).pathname;

const COMMON_BUNDLE = path('../../lib/vertesia-common.js');
const COMMON_ENTRY = path('../../lib/index.js');
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

describe('@vertesia/common runtime schema isolation', () => {
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
