import { describe, expect, it } from 'vitest';
import { PromptRole } from '@llumiverse/common';
import { PROCESS_DEFINITION_FORMAT_VERSION, TemplateType } from '@vertesia/common';
import { ContentTypesCollection } from '../ContentTypesCollection.js';
import { InteractionCollection } from '../InteractionCollection.js';
import { buildAppPackage } from './app-package.js';
import type { ToolServerConfig } from './types.js';

describe('buildAppPackage', () => {
    it('builds the same package artifact inventory used by the package route', async () => {
        const config = {
            interactions: [
                new InteractionCollection({
                    name: 'claims',
                    interactions: [
                        {
                            name: 'review',
                            title: 'Review Claim',
                            prompts: [
                                {
                                    role: PromptRole.user,
                                    content: '{{user_prompt}}',
                                    content_type: TemplateType.handlebars,
                                },
                            ],
                        },
                    ],
                }),
            ],
            types: [
                new ContentTypesCollection({
                    name: 'claims',
                    types: [
                        {
                            name: 'claim',
                            object_schema: {
                                type: 'object',
                                properties: {
                                    status: { type: 'string' },
                                },
                            },
                        },
                    ],
                }),
            ],
            processes: [
                {
                    id: 'claims:intake',
                    name: 'Claims Intake',
                    definition: {
                        format_version: PROCESS_DEFINITION_FORMAT_VERSION,
                        process: 'claims_intake',
                        initial: 'done',
                        context: {
                            schema: {
                                type: 'object',
                                additionalProperties: true,
                            },
                            initial: {},
                        },
                        nodes: {
                            done: { type: 'final', title: 'Done' },
                        },
                    },
                },
            ],
            dashboards: [
                {
                    id: 'claims:ops',
                    title: 'Claims Ops',
                    spec: {},
                },
            ],
            uiConfig: {
                src: '/lib/plugin.js',
                available_in: ['app_portal'],
            },
        } satisfies ToolServerConfig;

        const pkg = await buildAppPackage(config, {
            origin: 'https://apps.example.test',
            scope: 'all',
        });

        expect(pkg.interactions?.map((interaction) => interaction.id)).toEqual(['claims:review']);
        expect(pkg.types?.map((type) => type.id)).toEqual(['claims:claim']);
        expect(pkg.processes?.map((process) => process.id)).toEqual(['claims:intake']);
        expect(pkg.dashboards?.map((dashboard) => dashboard.id)).toEqual(['claims:ops']);
        expect(pkg.ui?.src).toBe('https://apps.example.test/lib/plugin.js');
    });

    it('honors package scopes', async () => {
        const config = {
            interactions: [
                new InteractionCollection({
                    name: 'claims',
                    interactions: [{ name: 'review', prompts: [] }],
                }),
            ],
            types: [
                new ContentTypesCollection({
                    name: 'claims',
                    types: [{ name: 'claim' }],
                }),
            ],
        } satisfies ToolServerConfig;

        const pkg = await buildAppPackage(config, { scope: 'types' });

        expect(pkg.types?.map((type) => type.id)).toEqual(['claims:claim']);
        expect(pkg.interactions).toBeUndefined();
    });
});
