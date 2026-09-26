import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// Build outputs are required; Turbo runs this package's build before its tests.
const path = (relative: string) => new URL(relative, import.meta.url).pathname;

const CLIENT_BUNDLE = path('../lib/vertesia-client.js');
/** `.` and `./node` in the client's exports map — the latter is `lib/nodejs/index.js`, not `lib/index.js`. */
const CLIENT_ENTRIES = [
    { label: 'client default entry (.)', file: path('../lib/index.js') },
    { label: 'client node entry (./node)', file: path('../lib/nodejs/index.js') },
];

/** Markers that prove a runtime schema import leaked into a browser artifact. */
const FORBIDDEN = ['zod', '_zod', 'ZodObject', 'api-schemas', 'toOpenApiComponents', 'ApiSchemaComponents'];

function expectNoSchemaRuntime(file: string, label: string): void {
    const contents = readFileSync(file, 'utf8');
    for (const marker of FORBIDDEN) {
        expect(contents, `${label} must not contain '${marker}'`).not.toContain(marker);
    }
}

describe('@vertesia/client consumer runtime isolation', () => {
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
