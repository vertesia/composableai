import type { Project } from '@vertesia/common';
import { describe, expect, it } from 'vitest';
import { getDocumentEditingProjectDefault } from './DocumentEditingConfigurationSelector.js';

describe('document editing configuration', () => {
    it('prefers the project agent default over the base default', () => {
        const project = {
            configuration: {
                defaults: {
                    base: { environment: 'base-env', model: 'base-model' },
                    system: { agent: { environment: 'agent-env', model: 'agent-model' } },
                },
            },
        } as Pick<Project, 'configuration'>;

        expect(getDocumentEditingProjectDefault(project)).toEqual({
            environment: 'agent-env',
            model: 'agent-model',
        });
    });

    it('falls back to the project base default', () => {
        const project = {
            configuration: {
                defaults: { base: { environment: 'base-env', model: 'base-model' } },
            },
        } as Pick<Project, 'configuration'>;

        expect(getDocumentEditingProjectDefault(project)).toEqual({
            environment: 'base-env',
            model: 'base-model',
        });
    });
});

it('retains the stable profile ID with its display configuration', () => {
    const project = { configuration: { embeddings: {} } } satisfies Pick<Project, 'configuration'>;
    const profile = {
        id: '507f1f77bcf86cd799439011',
        name: 'Editing',
        project: 'project',
        environment: 'env',
        model: 'model',
        model_options: { _option_id: 'text-fallback' as const, temperature: 0.3 },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
    };
    expect(getDocumentEditingProjectDefault(project, profile)).toEqual({
        inference_profile: profile.id,
        environment: 'env',
        model: 'model',
        model_options: profile.model_options,
    });
});
