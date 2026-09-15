import type { VertesiaClient } from '@vertesia/client';
import type { InCodeInteraction, JSONSchema } from '@vertesia/common';
import { describe, expect, it, vi } from 'vitest';
import { PayloadBuilderStore } from './PayloadBuilder';

describe('PayloadBuilder', () => {
    it('accepts a resolved interaction with no prompt segments', () => {
        const store = new PayloadBuilderStore({} as VertesiaClient);
        const interaction: InCodeInteraction = {
            type: 'sys',
            id: 'sys:GeneralAgent',
            name: 'GeneralAgent',
            tags: ['agent', 'general-purpose'],
            title: 'General Agent',
            description: 'A general-purpose agent.',
            agent_runner_options: {
                is_agent: true,
                request_template: '{{user_prompt}}',
            },
            prompts: [],
        };
        const listener = vi.fn();
        store.subscribe(listener);

        store.snapshot.setInteraction(interaction);

        expect(store.snapshot.interaction).toMatchObject(interaction);
        expect(store.snapshot.interactionParamsSchema).toBeNull();
        expect(listener).toHaveBeenCalled();
    });

    it('updates draft prompt data without notifying every builder consumer', () => {
        const store = new PayloadBuilderStore({} as VertesiaClient);
        const listener = vi.fn();
        store.subscribe(listener);

        store.snapshot.setDraftData({ task: 'Write a summary' });

        expect(store.snapshot.data).toEqual({ task: 'Write a summary' });
        expect(listener).not.toHaveBeenCalled();

        store.snapshot.setModel('model-id');

        expect(listener).toHaveBeenCalledOnce();
        expect(store.snapshot.data).toEqual({ task: 'Write a summary' });
    });

    it('validates the latest draft prompt data without requiring a published snapshot', () => {
        const store = new PayloadBuilderStore({} as VertesiaClient);
        const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
        const schema: JSONSchema = {
            type: 'object',
            properties: {
                task: { type: 'string', minLength: 1, format: 'textarea' },
            },
            required: ['task'],
        };
        store.snapshot.interactionParamsSchema = schema;

        store.snapshot.setDraftData({});
        expect(store.snapshot.validateInput().isValid).toBe(false);

        store.snapshot.setDraftData({ task: 'Write a summary' });
        expect(store.snapshot.validateInput()).toEqual({ isValid: true });
        expect(consoleWarn).not.toHaveBeenCalled();
        consoleWarn.mockRestore();
    });
});
