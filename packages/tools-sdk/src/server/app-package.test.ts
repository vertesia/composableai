import { PromptRole } from '@llumiverse/common';
import { PROCESS_DEFINITION_FORMAT_VERSION, SystemRoles, TemplateType } from '@vertesia/common';
import { describe, expect, it } from 'vitest';
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
            hooks: [{ kind: 'lifecycle', name: 'install', handler: async () => undefined }],
        } satisfies ToolServerConfig;

        const pkg = await buildAppPackage(config, {
            origin: 'https://apps.example.test',
            scope: 'all',
        });

        expect(pkg.interactions?.map((interaction) => interaction.id)).toEqual(['claims:review']);
        expect(pkg.types?.map((type) => type.id)).toEqual(['claim']);
        expect(pkg.processes?.map((process) => process.id)).toEqual(['claims:intake']);
        expect(pkg.dashboards?.map((dashboard) => dashboard.id)).toEqual(['claims:ops']);
        expect(pkg.ui?.src).toBe('https://apps.example.test/lib/plugin.js');
        expect(pkg.hooks).toEqual({ install: '/api/hooks/install' });
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

        expect(pkg.types?.map((type) => type.id)).toEqual(['claim']);
        expect(pkg.interactions).toBeUndefined();
    });

    it('returns lifecycle and event hook metadata for the hooks scope', async () => {
        const config = {
            interactions: [
                new InteractionCollection({
                    name: 'claims',
                    interactions: [{ name: 'review', prompts: [] }],
                }),
            ],
            hooks: [
                { kind: 'lifecycle', name: 'install', handler: async () => undefined },
                { kind: 'lifecycle', name: 'uninstall', handler: async () => undefined },
                {
                    kind: 'event',
                    name: 'content-updated',
                    description: 'Processes updated content.',
                    handler: async () => undefined,
                },
            ],
        } satisfies ToolServerConfig;

        const pkg = await buildAppPackage(config, { scope: 'hooks' });

        expect(pkg.hooks).toEqual({
            install: '/api/hooks/install',
            uninstall: '/api/hooks/uninstall',
            events: [
                {
                    name: 'content-updated',
                    path: '/api/hooks/content-updated',
                    description: 'Processes updated content.',
                },
            ],
        });
        expect(pkg.interactions).toBeUndefined();
    });

    it('returns subscriptions that reference registered event hooks', async () => {
        const config = {
            hooks: [
                {
                    kind: 'event',
                    name: 'content-updated',
                    handler: async () => undefined,
                },
            ],
            subscriptions: [
                {
                    id: 'content-updated',
                    name: 'Content updated',
                    description: 'Refresh app-owned projections after content changes.',
                    hook: 'content-updated',
                    filter: { action: ['update'], resource_type: ['content_object'] },
                    run_as_role: SystemRoles.automation,
                    priority: 'normal',
                },
            ],
        } satisfies ToolServerConfig;

        const pkg = await buildAppPackage(config, { scope: 'subscriptions' });

        expect(pkg.subscriptions).toEqual(config.subscriptions);
        expect(pkg.hooks).toBeUndefined();
    });

    it('rejects subscriptions that reference missing or lifecycle hooks', async () => {
        const missingHook = {
            subscriptions: [
                {
                    id: 'content-updated',
                    name: 'Content updated',
                    hook: 'content-updated',
                    filter: { action: ['update'] },
                    run_as_role: SystemRoles.automation,
                },
            ],
        } satisfies ToolServerConfig;
        await expect(buildAppPackage(missingHook, { scope: 'subscriptions' })).rejects.toThrow(
            /references missing hook 'content-updated'/,
        );

        const lifecycleHook = {
            hooks: [{ kind: 'lifecycle', name: 'install', handler: async () => undefined }],
            subscriptions: [
                {
                    id: 'on-install',
                    name: 'On install',
                    hook: 'install',
                    filter: { action: ['installed'] },
                    run_as_role: SystemRoles.automation,
                },
            ],
        } satisfies ToolServerConfig;
        await expect(buildAppPackage(lifecycleHook, { scope: 'subscriptions' })).rejects.toThrow(
            /must reference an event hook/,
        );
    });

    it('rejects duplicate or non-kebab-case subscription ids', async () => {
        const eventHook = {
            kind: 'event' as const,
            name: 'content-updated',
            handler: async () => undefined,
        };
        const subscription = {
            id: 'content-updated',
            name: 'Content updated',
            hook: 'content-updated',
            filter: { action: ['update'] },
            run_as_role: SystemRoles.automation,
        };

        await expect(
            buildAppPackage(
                { hooks: [eventHook], subscriptions: [subscription, { ...subscription }] },
                { scope: 'subscriptions' },
            ),
        ).rejects.toThrow(/Duplicate app event subscription id 'content-updated'/);

        await expect(
            buildAppPackage(
                { hooks: [eventHook], subscriptions: [{ ...subscription, id: 'Content Updated' }] },
                { scope: 'subscriptions' },
            ),
        ).rejects.toThrow(/must be kebab case/);
    });
});

describe('buildAppPackage type identity', () => {
    it('exposes the bare type name as the public id (collections are code organization only)', async () => {
        const config = {
            types: [
                new ContentTypesCollection({ name: 'claims', types: [{ name: 'claim' }] }),
                new ContentTypesCollection({ name: 'audit', types: [{ name: 'audit_event' }] }),
            ],
        } satisfies ToolServerConfig;

        const pkg = await buildAppPackage(config, { scope: 'types' });
        expect(pkg.types?.map((type) => type.id)).toEqual(['claim', 'audit_event']);
    });

    it('fails the package build when a type name is duplicated across collections', async () => {
        const config = {
            types: [
                new ContentTypesCollection({ name: 'claims', types: [{ name: 'claim' }] }),
                new ContentTypesCollection({ name: 'legacy', types: [{ name: 'claim' }] }),
            ],
        } satisfies ToolServerConfig;

        await expect(buildAppPackage(config, { scope: 'types' })).rejects.toThrow(
            /Duplicate content type name 'claim'/,
        );
    });
});
