import { describe, expect, it } from 'vitest';
import type { AsyncConversationExecutionPayload, CreateAgentRunPayload } from '../index.js';
import { validateApiRequest } from './index.js';

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

    it('does not accept a caller-supplied snapshot on run creation', () => {
        expect(
            validateApiRequest('CreateAgentRunPayload', {
                interaction: 'sys:GeneralAgent',
                settings_snapshot: {},
            }).valid,
        ).toBe(false);
    });
});
