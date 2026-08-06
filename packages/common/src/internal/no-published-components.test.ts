import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import * as internal from './index.js';

/**
 * The public/internal split in this package is easy to get wrong in one specific direction.
 *
 * "Is it imported by `@vertesia/client` or `@vertesia/ui`" is NOT the test for whether a type is
 * public. A type can be a published wire contract that no TypeScript consumer ever names, because
 * the generated Java, Go and Python clients are generated from the OpenAPI document instead. Moving
 * such a type behind `@vertesia/common/internal` silently narrows the published API surface while
 * every TypeScript build in the monorepo stays green.
 *
 * So the OpenAPI component list is the authority: anything published as a named component is public,
 * full stop, and must be reachable from the package root rather than from here.
 */
const SPEC = join(dirname(fileURLToPath(import.meta.url)), '../../../../../packages/api-specs/vertesia-openapi.json');

describe('@vertesia/common/internal', () => {
    it('exports nothing that is a published OpenAPI component', () => {
        const spec = JSON.parse(readFileSync(SPEC, 'utf8'));
        const components = new Set(Object.keys(spec.components?.schemas ?? {}));
        expect(components.size).toBeGreaterThan(0);

        const published = Object.keys(internal).filter((name) => components.has(name));

        expect(
            published,
            `These names are published as OpenAPI components, so they are part of the public API ` +
                `contract even if no TypeScript consumer imports them. Export them from the package ` +
                `root instead of from src/internal/index.ts.`,
        ).toEqual([]);
    });
});
