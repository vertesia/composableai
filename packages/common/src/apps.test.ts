import { describe, expect, it } from 'vitest';
import {
    AppEventHookPayloadSchema,
    AppEventSubscriptionDefinitionSchema,
    AppPackageHooksSchema,
} from './api-schemas/app-runtime.js';
import {
    APP_CAPABILITIES,
    APP_PACKAGE_SCOPES,
    isMcpOnlyInstanceManifest,
    type MCPToolCollectionObject,
    resolveInstallationCollection,
} from './apps.js';

describe('app capability contracts', () => {
    it('keeps views in the manifest and package contracts', () => {
        expect(APP_CAPABILITIES).toContain('views');
        expect(APP_PACKAGE_SCOPES).toContain('views');
    });

    it('exposes app hooks as a package query scope', () => {
        expect(APP_PACKAGE_SCOPES).toContain('hooks');
        expect(APP_PACKAGE_SCOPES).toContain('subscriptions');
    });

    it('accepts app-owned subscriptions without a deployment-specific target', () => {
        expect(
            AppEventSubscriptionDefinitionSchema.parse({
                id: 'content-updated',
                name: 'Content updated',
                hook: 'content-updated',
                filter: { action: ['update'], resource_type: ['content_object'] },
                run_as_role: 'automation',
            }),
        ).toEqual({
            id: 'content-updated',
            name: 'Content updated',
            hook: 'content-updated',
            filter: { action: ['update'], resource_type: ['content_object'] },
            run_as_role: 'automation',
        });
    });

    it('validates the canonical app event-hook envelope', () => {
        const payload = {
            event: {
                event_id: 'event-1',
                root_event_id: 'event-1',
                hop_count: 0,
                event_category: 'content',
                action: 'update',
                resource_type: 'content_object',
                resource_id: 'object-1',
                account_id: 'account-1',
                project_id: 'project-1',
                tenant_id: 'account-1_project-1',
                timestamp: '2026-08-05T10:00:00.000Z',
                source: 'zeno-server',
                details: { changed: ['title'] },
            },
            delivery: {
                id: 'delivery-1',
                subscription_id: 'subscription-1',
                attempt: 1,
            },
        };

        expect(AppEventHookPayloadSchema.parse(payload)).toEqual(payload);
        expect(() => AppEventHookPayloadSchema.parse({ event: payload.event })).toThrow();
    });

    it('accepts lifecycle and event hook package metadata', () => {
        expect(
            AppPackageHooksSchema.parse({
                install: '/api/hooks/install',
                events: [
                    {
                        name: 'content-updated',
                        path: '/api/hooks/content-updated',
                        description: 'Processes updated content.',
                    },
                ],
            }),
        ).toEqual({
            install: '/api/hooks/install',
            events: [
                {
                    name: 'content-updated',
                    path: '/api/hooks/content-updated',
                    description: 'Processes updated content.',
                },
            ],
        });
    });
});

describe('installation collection namespaces', () => {
    const collection: MCPToolCollectionObject = {
        id: 'crm',
        name: 'CRM',
        description: 'CRM tools',
        type: 'mcp',
        url: 'https://mcp.example.test',
        namespace: 'crm',
    };

    it.each([undefined, 'default'])('preserves legacy naming without an allocation for %s', (instance_key) => {
        expect(resolveInstallationCollection(collection, { instance_key })).toBe(collection);
    });

    it.each([undefined, 'default', 'eu'])('applies stored allocations for %s', (instance_key) => {
        expect(
            resolveInstallationCollection(collection, { instance_key, namespace_overrides: { crm: 'crm_custom' } }),
        ).toEqual({ ...collection, namespace: 'crm_custom' });
    });

    it.each(['constructor', 'toString', '__proto__'])('rejects inherited allocations for %s', (id) => {
        expect(() =>
            resolveInstallationCollection({ ...collection, id }, { instance_key: 'eu', namespace_overrides: {} }),
        ).toThrow('Namespace allocation required');
    });

    it('accepts an own allocation for a collection named constructor', () => {
        expect(
            resolveInstallationCollection(
                { ...collection, id: 'constructor' },
                { instance_key: 'eu', namespace_overrides: { constructor: 'crm_eu' } },
            ),
        ).toEqual({ ...collection, id: 'constructor', namespace: 'crm_eu' });
    });

    it('rejects an empty stored allocation even for the default instance', () => {
        expect(() =>
            resolveInstallationCollection(collection, { instance_key: 'default', namespace_overrides: { crm: '' } }),
        ).toThrow('Namespace allocation required');
    });

    it('keeps namespace conflicts fail-closed', () => {
        expect(() =>
            resolveInstallationCollection(collection, {
                instance_key: 'default',
                namespace_overrides: { crm: 'crm_custom' },
                namespace_conflicts: ['crm'],
            }),
        ).toThrow('Namespace conflict');
    });
});

describe('MCP-only instance eligibility after publisher updates', () => {
    const manifest = {
        tool_collections: [
            {
                type: 'mcp' as const,
                id: 'one',
                name: 'One',
                description: '',
                namespace: '',
                url: 'https://mcp.example.test',
            },
        ],
    };
    it('accepts MCP-only collections and rejects endpoint/UI/mixed updates', () => {
        expect(isMcpOnlyInstanceManifest(manifest)).toBe(true);
        expect(isMcpOnlyInstanceManifest({ ...manifest, endpoint: 'https://app.example.test' })).toBe(false);
        expect(isMcpOnlyInstanceManifest({ ...manifest, ui: { src: 'https://app.example.test' } })).toBe(false);
        expect(isMcpOnlyInstanceManifest({ tool_collections: [] })).toBe(false);
    });
});
