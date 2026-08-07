import { describe, expect, it } from 'vitest';
import {
    AppEventHookPayloadSchema,
    AppEventSubscriptionDefinitionSchema,
    AppPackageHooksSchema,
} from './api-schemas/app-runtime.js';
import { APP_CAPABILITIES, APP_PACKAGE_SCOPES } from './apps.js';

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
