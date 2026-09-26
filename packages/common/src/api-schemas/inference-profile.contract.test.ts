import { describe, expect, it } from 'vitest';
import { InferenceProfileSchema, ProjectInferenceProfilesSchema } from './inference-profile.js';
import { InteractionExecutionConfigurationSchema } from './store.js';

describe('inference profile wire contract', () => {
    const environment = '507f1f77bcf86cd799439011';

    it('accepts profile-only execution and explicit opt-out', () => {
        expect(InteractionExecutionConfigurationSchema.parse({ inference_profile: environment })).toEqual({
            inference_profile: environment,
        });
        expect(InteractionExecutionConfigurationSchema.parse({ inference_profile: null })).toEqual({
            inference_profile: null,
        });
    });

    it('requires an environment and accepts tagged or untagged provider options', () => {
        expect(InferenceProfileSchema.safeParse({ model: 'model' }).success).toBe(false);
        expect(InferenceProfileSchema.safeParse({ environment, model_options: { temperature: 0.2 } }).success).toBe(
            true,
        );
        expect(
            InferenceProfileSchema.safeParse({
                environment,
                model_options: { _option_id: 'text-fallback', temperature: 0.2 },
            }).success,
        ).toBe(true);
    });

    it('rejects invalid IDs and unrecognized profile settings', () => {
        expect(ProjectInferenceProfilesSchema.safeParse({ profiles: { 'fast.model': { environment } } }).success).toBe(
            false,
        );
        expect(InferenceProfileSchema.safeParse({ environment, api_key: 'secret' }).success).toBe(false);
    });
    it('rejects name references and embedded profile definitions', () => {
        expect(InteractionExecutionConfigurationSchema.safeParse({ inference_profile: 'fast' }).success).toBe(false);
        expect(ProjectInferenceProfilesSchema.safeParse({ profiles: { [environment]: { environment } } }).success).toBe(
            false,
        );
    });

    it('accepts ObjectId references independently of editable names', () => {
        const id = '507f1f77bcf86cd799439012';
        const settings = { default_profile: id, modality: { image: id } };
        expect(ProjectInferenceProfilesSchema.parse(settings)).toEqual(settings);
        expect(InteractionExecutionConfigurationSchema.parse({ inference_profile: id }).inference_profile).toBe(id);
        expect(InferenceProfileSchema.safeParse({ name: '   ', environment }).success).toBe(false);
    });
});
