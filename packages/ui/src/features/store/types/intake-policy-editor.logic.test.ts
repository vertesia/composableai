import type { ContentTypeIntakePolicy, InteractionExecutionConfiguration } from '@vertesia/common';
import { describe, expect, it } from 'vitest';
import {
    replaceIntakeRange,
    updateExecutionEnvironment,
    updateExecutionModel,
    updateExecutionProfile,
    updateIntakePolicy,
} from './intake-policy-editor.logic.js';

const MODEL_OPTIONS = { temperature: 0 } as unknown as NonNullable<InteractionExecutionConfiguration['model_options']>;

describe('updateIntakePolicy', () => {
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

describe('inference profile selection', () => {
    it('replaces manual routing and model options while preserving unrelated execution settings', () => {
        const config = { environment: 'env', model: 'model', model_options: MODEL_OPTIONS, do_validate: true };
        expect(updateExecutionProfile(config, 'profile')).toEqual({ inference_profile: 'profile', do_validate: true });
        expect(config.model).toBe('model');
    });
    it('distinguishes inheritance from explicitly bypassing profile defaults', () => {
        expect(updateExecutionProfile({ inference_profile: 'profile' }, undefined)).toBeUndefined();
        expect(updateExecutionProfile(undefined, null)).toEqual({ inference_profile: null });
        expect(updateExecutionProfile({ environment: 'env', model: 'model' }, null)).toEqual({
            environment: 'env',
            model: 'model',
            inference_profile: null,
        });
    });
    it('clears named profiles when choosing manual routing but preserves explicit bypass', () => {
        expect(updateExecutionEnvironment({ inference_profile: 'profile' }, 'env')).toEqual({ environment: 'env' });
        expect(updateExecutionModel({ inference_profile: 'profile', environment: 'env' }, 'model')).toEqual({
            environment: 'env',
            model: 'model',
        });
        expect(updateExecutionEnvironment({ inference_profile: null }, 'env')).toEqual({
            environment: 'env',
            inference_profile: null,
        });
    });
    it('updates one media profile without replacing interactions or other media settings', () => {
        const policy: ContentTypeIntakePolicy = {
            media_analysis: {
                image: { interaction: 'Image@stable', config: { inference_profile: 'old' } },
                audio: { interaction: 'Audio@3' },
            },
        };
        expect(
            updateIntakePolicy(
                policy,
                ['media_analysis', 'image', 'config'],
                updateExecutionProfile(policy.media_analysis?.image?.config, 'new'),
            ),
        ).toEqual({
            media_analysis: {
                image: { interaction: 'Image@stable', config: { inference_profile: 'new' } },
                audio: { interaction: 'Audio@3' },
            },
        });
    });
});
