import { describe, expect, it } from 'vitest';
import { validateApiRequest } from './registry.js';

describe('subscription override wire contracts', () => {
    const payload = {
        name: 'Normal intake',
        overrides_system_subscription_id: 'sys:StandardIntake',
        filter: {},
        target: { type: 'workflow', endpoint: 'StandardIntake' },
        run_as_role: 'automation',
    };

    it('accepts full replacement on creation and keeps it immutable on update', () => {
        expect(validateApiRequest('CreateEventSubscriptionPayload', payload).valid).toBe(true);
        expect(
            validateApiRequest('UpdateEventSubscriptionPayload', {
                overrides_system_subscription_id: 'sys:StandardIntake',
            }).valid,
        ).toBe(false);
    });

    it('rejects an empty replacement reference', () => {
        expect(
            validateApiRequest('CreateEventSubscriptionPayload', {
                ...payload,
                overrides_system_subscription_id: '',
            }).valid,
        ).toBe(false);
    });

    it('validates per-media interaction and inference profile settings', () => {
        expect(
            validateApiRequest('IntakeMediaAnalysisOverrides', {
                image: { interaction: 'custom:Image', config: { inference_profile: '111111111111111111111111' } },
                video: { config: { inference_profile: null } },
                audio: { interaction: 'custom:Audio' },
            }).valid,
        ).toBe(true);
        expect(
            validateApiRequest('IntakeMediaAnalysisOverrides', {
                image: { config: { inference_profile: 42 } },
            }).valid,
        ).toBe(false);
    });
});
