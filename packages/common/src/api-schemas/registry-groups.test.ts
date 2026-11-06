import { describe, expect, expectTypeOf, it } from 'vitest';
import { z } from 'zod';
import type { NamedInteractionExecutionPayloadSchema } from './interaction.js';
import {
    type ApiComponentName,
    type ApiComponentType,
    buildApiSchemaComponents,
    mergeComponentGroups,
} from './registry.js';

/**
 * Covers the one way the group split can corrupt the registry.
 *
 * The registry is declared in several objects, one per API domain. A plain spread merge would accept
 * a name listed twice and silently keep the LAST group's schema, so validation would enforce one
 * shape while the author edited another. That is pure accident: a component moved between groups and
 * left behind, or added to whichever group the author had open.
 *
 * The real groups are covered by the call itself, which runs at module load — a duplicate there
 * throws on import and takes every test in the package with it. What is tested here is that the
 * merge actually refuses, which no import of a correct registry can show.
 */
describe('mergeComponentGroups', () => {
    it('preserves execution payload types and rejects unregistered component names', () => {
        expectTypeOf<ApiComponentType<'NamedInteractionExecutionPayload'>>().toEqualTypeOf<
            z.infer<typeof NamedInteractionExecutionPayloadSchema>
        >();
        expectTypeOf<'UnregisteredExecutionComponent'>().not.toMatchTypeOf<ApiComponentName>();
    });

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

    it('emits a component from every group', { timeout: 30_000 }, () => {
        // The merge takes a list, so a group can be dropped from it as easily as duplicated in it —
        // and dropping one is silent in a different way: the generated names still list those
        // components until the next `gen:schemas`, so the code compiles and only the emitted
        // document loses them. A known name from each of these groups, looked up in a fresh
        // emission rather than the committed artifact, notices.
        const perGroup = [
            'Account',
            'ProjectModelDefaults',
            'OAuthProvider',
            'ExecutionEnvironment',
            'JSONValue',
            'Interaction',
            'GenerateTestDataPayload',
            'AgentRunnerOptions',
            'ExecutionRunStatus',
            'RenderPromptResponse',
            'AggregatedTool',
            'OAuthAuthStatus',
            'AuditTrailResponse',
            'ViewExperience',
            'CopyFilePayload',
        ] as const satisfies readonly ApiComponentName[];

        const emitted = buildApiSchemaComponents();
        for (const name of perGroup) {
            expect(emitted).toHaveProperty(name);
        }
    });
});
