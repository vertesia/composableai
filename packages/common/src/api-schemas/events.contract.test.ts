import { describe, expect, it } from 'vitest';
import { validateApiRequest, validateApiResponse } from './registry.js';

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

it.each(['', '   ', '\t\n'])('rejects blank replacement ids and media interaction names: %j', (value) => {
    expect(
        validateApiRequest('CreateEventSubscriptionPayload', {
            name: 'Intake',
            filter: {},
            target: { type: 'workflow', endpoint: 'StandardIntake' },
            run_as_role: 'automation',
            overrides_system_subscription_id: value,
        }).valid,
    ).toBe(false);
    expect(validateApiRequest('IntakeMediaAnalysisOverrides', { image: { interaction: value } }).valid).toBe(false);
});
it('keeps custom workflow variables opaque, including their own media_analysis shape', () => {
    expect(
        validateApiRequest('CreateEventSubscriptionPayload', {
            name: 'Custom',
            filter: {},
            target: {
                type: 'workflow',
                endpoint: 'CustomWorker',
                vars: { media_analysis: 'custom-layout', nested: [1, true, null] },
            },
            run_as_role: 'automation',
        }).valid,
    ).toBe(true);
});

it('supports optional code-defined execution metadata in workflow catalog responses', () => {
    const workflow = {
        endpoint: 'Workflow',
        title: 'Workflow',
        description: '',
        variables_schema: {},
        variables_template: {},
    };
    expect(validateApiResponse('SubscriptionWorkflowCatalog', { workflows: [workflow] }).valid).toBe(true);
    expect(
        validateApiResponse('SubscriptionWorkflowCatalog', {
            workflows: [
                { ...workflow, system_targets: [{ run_as_role: 'content_processor', task_queue: 'packaged-worker' }] },
            ],
        }).valid,
    ).toBe(true);
    expect(
        validateApiResponse('SubscriptionWorkflowCatalog', {
            workflows: [{ ...workflow, system_targets: [{ run_as_role: 'unknown-role' }] }],
        }).valid,
    ).toBe(false);
});

it('accepts named workflow templates and retains compatibility with a single default template', () => {
    const workflow = {
        endpoint: 'Workflow',
        title: 'Workflow',
        description: '',
        variables_schema: {},
        variables_template: {},
    };
    const template = {
        name: 'media_intake',
        title: 'Media intake parameters',
        description: 'Media parameters',
        variables: { media_analysis: {} },
    };
    expect(
        validateApiResponse('SubscriptionWorkflowCatalog', { workflows: [{ ...workflow, templates: [template] }] })
            .valid,
    ).toBe(true);
    expect(validateApiResponse('SubscriptionWorkflowCatalog', { workflows: [workflow] }).valid).toBe(true);
    expect(
        validateApiResponse('SubscriptionWorkflowCatalog', { workflows: [{ ...workflow, templates: [] }] }).valid,
    ).toBe(false);
});
