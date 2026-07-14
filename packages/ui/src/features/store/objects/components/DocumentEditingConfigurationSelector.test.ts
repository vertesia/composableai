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
