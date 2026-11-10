import { describe, expect, it } from 'vitest';
import { emitDeclaration } from '../../test/declaration-emit.js';

/**
 * The registry groups' inferred types re-print every schema they register. They stay out of the published
 * declarations only while no exported declaration depends on a group, which nothing but declaration emit shows.
 */
describe('registry declarations', () => {
    it('do not carry the schema groups', { timeout: 120_000 }, () => {
        expect(
            emitDeclaration('api-schemas/registry.d.ts'),
            'registry.d.ts names a schema group: derive exported types from the generated ApiComponentTypes map',
        ).not.toMatch(/_SCHEMAS\b|API_SCHEMA_GROUPS/);
    });
});
