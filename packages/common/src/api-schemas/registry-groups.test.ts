import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { type ApiComponentName, ApiSchemaComponents, mergeComponentGroups } from './registry.js';

/**
 * Covers the one way the group split can corrupt the registry.
 *
 * The registry is declared in several objects because the compiler cannot serialize it as one, and
 * the two public types are assembled from those objects: `ApiComponentName` is a union of `keyof`,
 * `ApiComponentType` a conditional testing the groups IN ORDER. A plain spread merge would accept a
 * name listed twice and keep the LAST group's schema, while `ApiComponentType` would resolve to the
 * FIRST group's — validation enforcing one shape while every handler is typed against another, with
 * nothing downstream to report it. The grouping is a compiler accommodation, so this failure mode is
 * pure accident: a component moved between groups and left behind, or added to whichever group the
 * author had open.
 *
 * The real groups are covered by the call itself, which runs at module load — a duplicate there
 * throws on import and takes every test in the package with it. What is tested here is that the
 * merge actually refuses, which no import of a correct registry can show.
 */
describe('mergeComponentGroups', () => {
    const A = z.strictObject({ a: z.string() });
    const B = z.strictObject({ b: z.number() });

    it('merges disjoint groups into one object', () => {
        const merged = mergeComponentGroups([{ Alpha: A }, { Beta: B }]);

        expect(Object.keys(merged).sort()).toEqual(['Alpha', 'Beta']);
        expect(merged.Alpha).toBe(A);
        expect(merged.Beta).toBe(B);
    });

    it('refuses a name registered in two groups', () => {
        expect(() => mergeComponentGroups([{ Alpha: A }, { Alpha: B }])).toThrow(
            /registered in more than one group: Alpha/,
        );
    });

    it('names every colliding component, not just the first', () => {
        expect(() => mergeComponentGroups([{ Beta: B, Alpha: A }, { Alpha: B }, { Beta: A }])).toThrow(
            /components registered in more than one group: Alpha, Beta/,
        );
    });

    it('reports a collision across non-adjacent groups', () => {
        // The failure is a name in ANY two groups, not only in two that happen to be listed together.
        expect(() => mergeComponentGroups([{ Alpha: A }, { Beta: B }, { Alpha: B }])).toThrow(
            /registered in more than one group: Alpha/,
        );
    });

    it('emits a component from every group', () => {
        // The merge takes a list, so a group can be dropped from it as easily as duplicated in it —
        // and dropping one is silent in a different way: `ApiComponentName` still names those
        // components, so the code compiles and only the emitted document loses them. One known name
        // per group is what notices.
        const perGroup: ApiComponentName[] = ['Account', 'ProjectModelDefaults', 'CopyFilePayload'];

        for (const name of perGroup) {
            expect(ApiSchemaComponents).toHaveProperty(name);
        }
    });
});
