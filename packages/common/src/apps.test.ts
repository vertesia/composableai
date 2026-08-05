import { describe, expect, it } from 'vitest';
import { AppEventSubscriptionDefinitionSchema, AppPackageHooksSchema } from './api-schemas/app-runtime.js';
import { APP_ARTIFACT_TYPES, APP_CAPABILITIES, APP_PACKAGE_SCOPES, effectiveAppAccessControl } from './apps.js';

describe('app capability contracts', () => {
    it('keeps views in manifest, package, and build-artifact contracts', () => {
        expect(APP_CAPABILITIES).toContain('views');
        expect(APP_PACKAGE_SCOPES).toContain('views');
        expect(APP_ARTIFACT_TYPES).toContain('view');
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
                filter: { action: ['updated'], resource_type: ['content_object'] },
                run_as_role: 'automation',
            }),
        ).toEqual({
            id: 'content-updated',
            name: 'Content updated',
            hook: 'content-updated',
            filter: { action: ['updated'], resource_type: ['content_object'] },
            run_as_role: 'automation',
        });
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

describe('effectiveAppAccessControl', () => {
    it("returns 'all' when neither installation nor manifest set the field", () => {
        expect(effectiveAppAccessControl({}, {})).toBe('all');
    });

    it("returns 'all' when both inputs are null/undefined", () => {
        expect(effectiveAppAccessControl(null, null)).toBe('all');
        expect(effectiveAppAccessControl(undefined, undefined)).toBe('all');
        expect(effectiveAppAccessControl(null, undefined)).toBe('all');
    });

    it('falls back to the manifest default when the installation has no override', () => {
        expect(effectiveAppAccessControl({}, { access_control: 'ui' })).toBe('ui');
        expect(effectiveAppAccessControl({}, { access_control: 'none' })).toBe('none');
        expect(effectiveAppAccessControl({}, { access_control: 'all' })).toBe('all');
    });

    it('lets the installation override the manifest default for all three values', () => {
        expect(effectiveAppAccessControl({ access_control: 'ui' }, { access_control: 'all' })).toBe('ui');
        expect(effectiveAppAccessControl({ access_control: 'none' }, { access_control: 'ui' })).toBe('none');
        expect(effectiveAppAccessControl({ access_control: 'all' }, { access_control: 'none' })).toBe('all');
    });

    it('treats null arguments the same as undefined', () => {
        expect(effectiveAppAccessControl(null, { access_control: 'ui' })).toBe('ui');
        expect(effectiveAppAccessControl({ access_control: 'ui' }, null)).toBe('ui');
    });

    it('treats null/undefined access_control fields the same as the field being absent', () => {
        expect(effectiveAppAccessControl({ access_control: undefined }, { access_control: 'ui' })).toBe('ui');
        // The override accepts AppAccessControl | null at the payload boundary; nullish should fall through.
        expect(effectiveAppAccessControl({ access_control: undefined }, { access_control: undefined })).toBe('all');
    });
});
