import { describe, expect, it } from 'vitest';
import { parseGatewayAppEndpoint, resolveAppServiceApiBase, resolvePackageDescriptorUrl } from './index.js';

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
