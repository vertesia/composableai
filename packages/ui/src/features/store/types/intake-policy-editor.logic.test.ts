import type { ContentTypeIntakePolicy, InteractionExecutionConfiguration } from '@vertesia/common';
import { describe, expect, it } from 'vitest';
import {
    replaceIntakeRange,
    updateExecutionEnvironment,
    updateExecutionModel,
    updateIntakePolicy,
} from './intake-policy-editor.logic.js';

const MODEL_OPTIONS = { temperature: 0 } as unknown as NonNullable<InteractionExecutionConfiguration['model_options']>;

describe('updateIntakePolicy', () => {
    it('edits memory settings while preserving inherited values and other intake steps', () => {
        const policy: ContentTypeIntakePolicy = {
            extraction: { enabled: true },
            memory: { enabled: true, scope: 'intake-memory', config: { model: 'model-a' } },
        };
        const updated = updateIntakePolicy(policy, ['memory', 'max_entities'], 25);
        expect(updated).toEqual({
            extraction: { enabled: true },
            memory: { enabled: true, scope: 'intake-memory', config: { model: 'model-a' }, max_entities: 25 },
        });
        expect(updateIntakePolicy(updated, ['memory', 'enabled'], undefined).memory?.enabled).toBeUndefined();
        expect(policy.memory?.max_entities).toBeUndefined();
    });

    it('keeps an explicit memory disable distinct from inherited policy', () => {
        const inherited = updateIntakePolicy({}, ['memory', 'enabled'], undefined);
        const disabled = updateIntakePolicy(inherited, ['memory', 'enabled'], false);
        expect(inherited.memory).toBeUndefined();
        expect(disabled.memory).toEqual({ enabled: false });
        expect(updateIntakePolicy(disabled, ['memory', 'enabled'], undefined).memory).toBeUndefined();
    });

    it('updates a nested field without losing sibling or advanced fields', () => {
        const policy = {
            extraction: {
                enabled: true,
                grounding: {
                    enabled: true,
                    config: {
                        model: 'model-a',
                        model_options: { temperature: 0 },
                    },
                },
            },
        } as ContentTypeIntakePolicy;

        const updated = updateIntakePolicy(policy, ['extraction', 'grounding', 'config', 'model'], 'model-b');

        expect(updated.extraction?.grounding).toEqual({
            enabled: true,
            config: {
                model: 'model-b',
                model_options: { temperature: 0 },
            },
        });
        expect(policy.extraction?.grounding?.config?.model).toBe('model-a');
    });

    it('removes cleared fields and prunes empty containers', () => {
        const policy: ContentTypeIntakePolicy = {
            identification: {
                guidance: 'Invoices',
            },
            default_view: 'pdf',
        };

        expect(updateIntakePolicy(policy, ['identification', 'guidance'], undefined)).toEqual({
            default_view: 'pdf',
        });
    });

    it('creates missing containers for a new nested value', () => {
        expect(updateIntakePolicy({}, ['extraction', 'vision', 'max_pages_per_call'], 8)).toEqual({
            extraction: {
                vision: {
                    max_pages_per_call: 8,
                },
            },
        });
    });
});

describe('replaceIntakeRange', () => {
    it('updates one endpoint without mutating the source range', () => {
        const ranges: [number, number][] = [
            [1, 3],
            [-1, -1],
        ];

        expect(replaceIntakeRange(ranges, 0, 1, 5)).toEqual([
            [1, 5],
            [-1, -1],
        ]);
        expect(ranges[0]).toEqual([1, 3]);
    });
});

describe('execution configuration selection', () => {
    it('clears a stale model and model options when the environment changes', () => {
        expect(
            updateExecutionEnvironment(
                {
                    environment: 'environment-a',
                    model: 'model-a',
                    model_options: MODEL_OPTIONS,
                    do_validate: true,
                },
                'environment-b',
            ),
        ).toEqual({
            environment: 'environment-b',
            do_validate: true,
        });
    });

    it('clears model options only when the model changes', () => {
        const config = {
            environment: 'environment-a',
            model: 'model-a',
            model_options: MODEL_OPTIONS,
        };

        expect(updateExecutionModel(config, 'model-a')).toEqual(config);
        expect(updateExecutionModel(config, 'model-b')).toEqual({
            environment: 'environment-a',
            model: 'model-b',
        });
    });
});
