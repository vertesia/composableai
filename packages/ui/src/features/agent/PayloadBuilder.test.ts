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

it('sends only a runtime profile or defaults without stale model overrides', () => {
    const store = new PayloadBuilderStore({} as VertesiaClient);
    store.snapshot.setModel('old-model');
    store.snapshot.setModelOptions({ temperature: 0.3 });
    expect(store.snapshot.inferenceConfig).toEqual({});
    store.snapshot.setInferenceProfile('0123456789abcdef01234567');
    expect(store.snapshot.inferenceConfig).toEqual({ inference_profile: '0123456789abcdef01234567' });
    expect(store.snapshot.clone().inference_profile).toBe('0123456789abcdef01234567');
    store.snapshot.setInferenceProfile(null);
    expect(store.snapshot.inferenceConfig).toEqual({
        inference_profile: null,
        environment: undefined,
        model: 'old-model',
        model_options: { temperature: 0.3 },
    });
    store.snapshot.reset();
    expect(store.snapshot.inferenceConfig).toEqual({});
});

it.each(['0123456789abcdef01234567', null, undefined])('restores runtime profile selection %s', async (profile) => {
    const analysisProfile = 'aaaaaaaaaaaaaaaaaaaaaaaa';
    const client = {
        interactions: {
            catalog: {
                resolve: vi.fn().mockResolvedValue({
                    id: 'sys:GeneralAgent',
                    name: 'GeneralAgent',
                    type: 'sys',
                    tags: [],
                    prompts: [],
                }),
            },
        },
    } as unknown as VertesiaClient;
    const store = new PayloadBuilderStore(client);
    await store.snapshot.restoreConversation({
        type: 'ExecuteConversationWorkflow',
        tool_names: [],
        interaction: 'sys:GeneralAgent',
        interactive: true,
        config: { inference_profile: profile },
        settings: { tools: { fetch_document: { analysis: { inference_profile: analysisProfile } } } },
    });
    expect(store.snapshot.inference_profile).toBe(profile);
    expect(store.snapshot.inferencePayload.settings?.tools?.fetch_document?.analysis.inference_profile).toBe(
        analysisProfile,
    );
    await store.snapshot.restoreConversation({
        type: 'ExecuteConversationWorkflow',
        tool_names: [],
        interaction: 'sys:GeneralAgent',
        interactive: true,
        config: {},
    });
    expect(store.snapshot.inferencePayload).toEqual({ config: {} });
});

it('preserves independent run settings across profile changes and validates their availability', () => {
    const store = new PayloadBuilderStore({} as VertesiaClient);
    const profile = 'aaaaaaaaaaaaaaaaaaaaaaaa';
    const settings = { subagents: { 'sys:ResearchAgent': { inference_profile: profile } } };
    store.snapshot.setRunSettings(settings);
    settings.subagents['sys:ResearchAgent'].inference_profile = 'bbbbbbbbbbbbbbbbbbbbbbbb';
    store.snapshot.setInferenceProfile(null);
    expect(store.snapshot.inferenceProfileError).toContain('Wait for inference profiles');
    store.snapshot.setAvailableInferenceProfiles([]);
    expect(store.snapshot.inferenceProfileError).toContain('unavailable');
    store.snapshot.setAvailableInferenceProfiles([profile]);
    expect(store.snapshot.inferenceProfileError).toBeUndefined();
    expect(store.snapshot.runSettings?.subagents?.['sys:ResearchAgent'].inference_profile).toBe(profile);
    store.snapshot.setInferenceProfile(undefined);
    expect(store.snapshot.inferencePayload).toEqual({
        config: {},
        settings: { subagents: { 'sys:ResearchAgent': { inference_profile: profile } } },
    });
    store.snapshot.setRunSettings(undefined);
    expect(store.snapshot.inferencePayload).toEqual({ config: {} });
});

it('validates profile availability across builder snapshots without blocking ad hoc or defaults', () => {
    const store = new PayloadBuilderStore({} as VertesiaClient);
    const profile = '0123456789abcdef01234567';
    store.snapshot.setInferenceProfile(profile);
    expect(store.snapshot.inferenceProfileError).toContain('Wait for inference profiles');
    store.snapshot.setAvailableInferenceProfiles([]);
    expect(store.snapshot.inferenceProfileError).toContain('unavailable');
    store.snapshot.setAvailableInferenceProfiles([profile]);
    store.snapshot.setModel('manual-model');
    expect(store.snapshot.inferenceProfileError).toBeUndefined();
    store.snapshot.setAvailableInferenceProfiles(undefined);
    store.snapshot.setInferenceProfile(null);
    expect(store.snapshot.inferenceProfileError).toBeUndefined();
    store.snapshot.setInferenceProfile(undefined);
    expect(store.snapshot.inferenceProfileError).toBeUndefined();
});
