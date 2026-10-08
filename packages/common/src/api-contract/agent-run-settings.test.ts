import { describe, expect, it } from 'vitest';
import { AgentRunSettingsSchema, MAX_RUN_SETTINGS_SUBAGENTS } from '../api-schemas/agent-run-settings.js';
import type { AsyncConversationExecutionPayload, CreateAgentRunPayload } from '../index.js';
import { ApiSchemaComponents, validateApiRequest } from './index.js';

const profile = 'a'.repeat(24);

describe('agent run settings wire contract', () => {
    it('preserves existing launch requests without settings in SDK types and runtime validation', () => {
        const run: CreateAgentRunPayload = { interaction: 'sys:GeneralAgent' };
        const conversation: AsyncConversationExecutionPayload = {
            type: 'conversation',
            interaction: 'sys:GeneralAgent',
        };
        expect(validateApiRequest('CreateAgentRunPayload', run)).toMatchObject({ valid: true, data: run });
        expect(validateApiRequest('AsyncConversationExecutionPayload', conversation)).toMatchObject({
            valid: true,
            data: conversation,
        });
    });

    it('accepts independent tool and subagent profiles on both launch APIs', () => {
        const settings = {
            tools: { fetch_document: { analysis: { inference_profile: profile } } },
            subagents: { 'sys:ResearchAgent': { inference_profile: profile } },
        };
        expect(
            validateApiRequest('CreateAgentRunPayload', { interaction: 'sys:GeneralAgent', settings }),
        ).toMatchObject({ valid: true, data: { settings } });
        expect(
            validateApiRequest('AsyncConversationExecutionPayload', {
                type: 'conversation',
                interaction: 'sys:GeneralAgent',
                settings,
            }),
        ).toMatchObject({ valid: true, data: { settings } });
    });

    it.each([
        { tools: { mcp_search: { analysis: { inference_profile: profile } } } },
        { tools: { web_search_serper: { inference_profile: profile } } },
        { tools: { fetch_document: { analysis: { inference_profile: 'missing' } } } },
        { tools: { fetch_document: { analysis: { inference_profile: profile, model: 'override' } } } },
        { subagents: { constructor: { inference_profile: profile } } },
        { unknown: true },
    ])('rejects unsupported or invalid settings: %j', (settings) => {
        expect(validateApiRequest('CreateAgentRunPayload', { interaction: 'sys:GeneralAgent', settings }).valid).toBe(
            false,
        );
    });

    // The snapshot is resolved by the server and carried only by the workflow, never accepted from callers.
    it('does not accept or publish a caller-supplied snapshot on the launch APIs', () => {
        expect(
            validateApiRequest('CreateAgentRunPayload', {
                interaction: 'sys:GeneralAgent',
                settings_snapshot: {},
            }).valid,
        ).toBe(false);
        const conversation = ApiSchemaComponents.AsyncConversationExecutionPayload as {
            properties: Record<string, unknown>;
        };
        expect(conversation.properties).toHaveProperty('settings');
        expect(conversation.properties).not.toHaveProperty('settings_snapshot');
    });

    it(`accepts up to ${MAX_RUN_SETTINGS_SUBAGENTS} named subagents in the contract and the schema`, () => {
        const subagents = (count: number) =>
            Object.fromEntries(
                Array.from({ length: count }, (_, i) => [`sys:Agent${i}`, { inference_profile: profile }]),
            );
        const within = { subagents: subagents(MAX_RUN_SETTINGS_SUBAGENTS) };
        const over = { subagents: subagents(MAX_RUN_SETTINGS_SUBAGENTS + 1) };

        expect(
            validateApiRequest('CreateAgentRunPayload', { interaction: 'sys:GeneralAgent', settings: within }).valid,
        ).toBe(true);
        expect(
            validateApiRequest('CreateAgentRunPayload', { interaction: 'sys:GeneralAgent', settings: over }).valid,
        ).toBe(false);
        expect(AgentRunSettingsSchema.safeParse(within).success).toBe(true);
        expect(AgentRunSettingsSchema.safeParse(over).success).toBe(false);
    });
});
