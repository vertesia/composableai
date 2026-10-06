import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
    ExperimentalAgentConversationUpgradePayloadSchema,
    ExperimentalAgentConversationUpgradeResponseSchema,
} from './agent-runs.js';
import { ApiSchemaComponents, validateApiRequest } from './registry.js';

describe('authenticated bounded upgrade wire contract', () => {
    it('emits generator-enforced discriminator enums with the exact original literal domains', () => {
        const contracts = [
            {
                component: ApiSchemaComponents.ExperimentalAgentConversationUpgradePayload,
                field: 'action',
                values: ['begin', 'advance', 'finish'],
            },
            {
                component: ApiSchemaComponents.ExperimentalAgentConversationUpgradeResponse,
                field: 'status',
                values: ['pending', 'ready_to_finish', 'completed'],
            },
        ];
        const componentSchema = z.object({
            oneOf: z.array(z.object({ properties: z.record(z.string(), z.unknown()) })),
        });
        for (const contract of contracts) {
            const branches = componentSchema.parse(contract.component).oneOf;
            expect(branches).toHaveLength(contract.values.length);
            for (const [index, value] of contract.values.entries()) {
                const branch = branches[index];
                if (!branch) throw new Error('Published upgrade branch missing');
                expect(branch.properties[contract.field]).toEqual({ type: 'string', enum: [value] });
                const singleton = z.enum([value]);
                const literal = z.literal(value);
                for (const candidate of [...contract.values, 'unknown', '', null, undefined, 1, {}, []]) {
                    expect(singleton.safeParse(candidate).success).toBe(literal.safeParse(candidate).success);
                }
            }
        }
    });

    it('validates the same published branch and invalid-shape corpus used by generated Java/Go clients', () => {
        const corpus = z
            .object({
                requests: z.record(z.string(), z.unknown()),
                responses: z.record(z.string(), z.unknown()),
                invalid_requests: z.record(z.string(), z.unknown()),
                invalid_responses: z.record(z.string(), z.unknown()),
            })
            .parse(
                JSON.parse(
                    readFileSync(
                        new URL('../../test-fixtures/canonical-conversation-upgrade.json', import.meta.url),
                        'utf8',
                    ),
                ),
            );
        for (const value of Object.values(corpus.requests)) {
            expect(ExperimentalAgentConversationUpgradePayloadSchema.parse(value)).toEqual(value);
            expect(validateApiRequest('ExperimentalAgentConversationUpgradePayload', value).valid).toBe(true);
        }
        for (const value of Object.values(corpus.responses)) {
            expect(ExperimentalAgentConversationUpgradeResponseSchema.parse(value)).toEqual(value);
            expect(validateApiRequest('ExperimentalAgentConversationUpgradeResponse', value).valid).toBe(true);
        }
        for (const value of Object.values(corpus.invalid_requests)) {
            expect(ExperimentalAgentConversationUpgradePayloadSchema.safeParse(value).success).toBe(false);
            expect(validateApiRequest('ExperimentalAgentConversationUpgradePayload', value).valid).toBe(false);
        }
        for (const value of Object.values(corpus.invalid_responses)) {
            expect(ExperimentalAgentConversationUpgradeResponseSchema.safeParse(value).success).toBe(false);
            expect(validateApiRequest('ExperimentalAgentConversationUpgradeResponse', value).valid).toBe(false);
        }
    });

    it.each([
        ['ExperimentalAgentConversationUpgradePayload', 'action'],
        ['ExperimentalAgentConversationUpgradeResponse', 'status'],
    ] as const)('publishes %s with its registered discriminator', (component, tag) => {
        expect(ApiSchemaComponents[component]).toMatchObject({
            type: 'object',
            required: [tag],
            discriminator: { propertyName: tag },
            additionalProperties: true,
        });
    });

    it('requires an exact begin source and excludes caller physical progress/profile/time', () => {
        const begin = {
            action: 'begin',
            operation_id: 'upgrade:one',
            expected_head: { conversation_id: 'one', revision: 2 },
        };
        for (const valid of [
            begin,
            { action: 'advance', operation_id: 'upgrade:one' },
            { action: 'finish', operation_id: 'upgrade:one' },
        ]) {
            expect(ExperimentalAgentConversationUpgradePayloadSchema.safeParse(valid).success).toBe(true);
            expect(validateApiRequest('ExperimentalAgentConversationUpgradePayload', valid).valid).toBe(true);
        }
        for (const invalid of [
            { action: 'begin', operation_id: 'upgrade:one' },
            { ...begin, progress: {} },
            { ...begin, profile: 'caller' },
            { ...begin, recorded_at: '2026-10-06T00:00:00.000Z' },
            { ...begin, root: {} },
            { ...begin, expected_head: { conversation_id: 'one', revision: -1 } },
            { action: 'advance', operation_id: 'upgrade:one', expected_head: begin.expected_head },
        ]) {
            expect(ExperimentalAgentConversationUpgradePayloadSchema.safeParse(invalid).success).toBe(false);
            expect(validateApiRequest('ExperimentalAgentConversationUpgradePayload', invalid).valid).toBe(false);
        }
    });
});
