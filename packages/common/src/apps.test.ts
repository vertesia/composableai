import { describe, expect, it } from 'vitest';
import {
    effectiveAppAccessControl,
    parseGatewayAppEndpoint,
    resolveAppServiceApiBase,
    resolvePackageDescriptorUrl,
} from './apps.js';

const APPS_MOUNT = 'https://gw.example.com/tenants/1589ba_149d0b/apps/my-app';
const PKG_MOUNT = 'https://gw.example.com/tenants/1589ba_149d0b/package/my-app';

describe('gateway app endpoint resolvers', () => {
    it('parses both the apps and package mounts, rejects non-gateway endpoints', () => {
        expect(parseGatewayAppEndpoint(APPS_MOUNT)).toEqual({
            origin: 'https://gw.example.com',
            tenant: '1589ba_149d0b',
            appId: 'my-app',
        });
        expect(parseGatewayAppEndpoint(PKG_MOUNT)).toEqual({
            origin: 'https://gw.example.com',
            tenant: '1589ba_149d0b',
            appId: 'my-app',
        });
        expect(parseGatewayAppEndpoint('https://third-party.example.com/tools')).toBeUndefined();
    });

    it('resolves the current descriptor to the public /package sibling', () => {
        expect(resolvePackageDescriptorUrl(APPS_MOUNT)).toBe(PKG_MOUNT);
    });

    it('resolves a version-pinned descriptor to the apps runtime mount', () => {
        expect(resolvePackageDescriptorUrl(APPS_MOUNT, '20260101T000000Z')).toBe(
            'https://gw.example.com/tenants/1589ba_149d0b/apps/my-app/versions/20260101T000000Z/api/package',
        );
    });

    it('leaves non-gateway endpoints unchanged (external tools apps fetch from the endpoint as-is)', () => {
        expect(resolvePackageDescriptorUrl('https://third-party.example.com/tools')).toBe(
            'https://third-party.example.com/tools',
        );
    });

    it('resolves the runtime service API base, version-aware, undefined for non-gateway', () => {
        expect(resolveAppServiceApiBase(APPS_MOUNT)).toBe(
            'https://gw.example.com/tenants/1589ba_149d0b/apps/my-app/api',
        );
        expect(resolveAppServiceApiBase(APPS_MOUNT, '20260101T000000Z')).toBe(
            'https://gw.example.com/tenants/1589ba_149d0b/apps/my-app/versions/20260101T000000Z/api',
        );
        expect(resolveAppServiceApiBase('https://third-party.example.com/tools')).toBeUndefined();
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
