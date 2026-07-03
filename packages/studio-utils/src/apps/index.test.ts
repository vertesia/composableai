import { describe, expect, it, vi } from 'vitest';
import { installStudioUtilsLogger, type StudioUtilsLogger } from '../logger.js';
import {
    parseGatewayAppEndpoint,
    type ResolveAppEndpointOptions,
    resolveAppApiBase,
    resolveAppEndpoint,
    resolveAppResource,
} from './index.js';

const APPS_MOUNT = 'https://gw.example.com/tenants/1589ba_149d0b/apps/my-app';
const LEGACY_PACKAGE_MOUNT = 'https://gw.example.com/tenants/1589ba_149d0b/package/my-app';
const PACKAGE_MOUNT = 'https://gw.example.com/tenants/1589ba_149d0b/apps/my-app/api/package';
const VERSION_PACKAGE_MOUNT =
    'https://gw.example.com/tenants/1589ba_149d0b/apps/my-app/versions/20260101T000000Z/api/package';

function resolve(
    endpoint: string,
    options: ResolveAppEndpointOptions = {},
    endpoint_overrides?: Record<string, string>,
): string | undefined {
    return resolveAppEndpoint({ endpoint, endpoint_overrides }, options);
}

describe('app endpoint resolution', () => {
    it('parses gateway app endpoint shapes', () => {
        expect(parseGatewayAppEndpoint(APPS_MOUNT)).toEqual({
            origin: 'https://gw.example.com',
            tenant: '1589ba_149d0b',
            appId: 'my-app',
        });
        expect(parseGatewayAppEndpoint(LEGACY_PACKAGE_MOUNT)).toEqual({
            origin: 'https://gw.example.com',
            tenant: '1589ba_149d0b',
            appId: 'my-app',
        });
        expect(parseGatewayAppEndpoint(VERSION_PACKAGE_MOUNT)).toEqual({
            origin: 'https://gw.example.com',
            tenant: '1589ba_149d0b',
            appId: 'my-app',
            version: '20260101T000000Z',
        });
        expect(parseGatewayAppEndpoint('https://third-party.example.com/api/package')).toBeUndefined();
    });

    it('normalizes gateway app endpoints to canonical package URLs', () => {
        expect(resolve(APPS_MOUNT)).toBe(PACKAGE_MOUNT);
        expect(resolve(LEGACY_PACKAGE_MOUNT)).toBe(PACKAGE_MOUNT);
        expect(resolve(PACKAGE_MOUNT)).toBe(PACKAGE_MOUNT);
    });

    it('normalizes gateway app endpoints to version-pinned package URLs', () => {
        expect(resolve(APPS_MOUNT, { version: '20260101T000000Z' })).toBe(VERSION_PACKAGE_MOUNT);
        expect(resolve(LEGACY_PACKAGE_MOUNT, { version: '20260101T000000Z' })).toBe(VERSION_PACKAGE_MOUNT);
        expect(resolve(PACKAGE_MOUNT, { version: '20260101T000000Z' })).toBe(VERSION_PACKAGE_MOUNT);
    });

    it('ignores endpoint overrides for gateway apps', () => {
        const endpoint_overrides = {
            '20260101T000000Z': 'https://plugin.example.com/releases/20260101T000000Z/package',
            dev: 'https://plugin.example.com/dev/package',
        };

        expect(resolve(APPS_MOUNT, { version: '20260101T000000Z', envName: 'dev' }, endpoint_overrides)).toBe(
            VERSION_PACKAGE_MOUNT,
        );
        expect(resolve(APPS_MOUNT, { envName: 'dev' }, endpoint_overrides)).toBe(PACKAGE_MOUNT);
    });

    it('uses endpoint overrides in version, requested override, environment, endpoint order', () => {
        const endpoint_overrides = {
            '1.2.3': 'https://plugin.example.com/releases/1.2.3/package',
            dev: 'https://plugin.example.com/dev/package',
            desktop: 'https://plugin.example.com/desktop/package',
        };

        expect(
            resolve('https://plugin.example.com/api/package', { version: '1.2.3', envName: 'dev' }, endpoint_overrides),
        ).toBe('https://plugin.example.com/releases/1.2.3/package');
        expect(
            resolve(
                'https://plugin.example.com/api/package',
                { requestedOverride: 'desktop', envName: 'dev' },
                endpoint_overrides,
            ),
        ).toBe('https://plugin.example.com/desktop/package');
        expect(resolve('https://plugin.example.com/api/package', { envName: 'dev' }, endpoint_overrides)).toBe(
            'https://plugin.example.com/dev/package',
        );
        expect(resolve('https://plugin.example.com/api/package', {}, endpoint_overrides)).toBe(
            'https://plugin.example.com/api/package',
        );
    });

    it('does not use endpoint overrides without a base endpoint', () => {
        expect(
            resolveAppEndpoint(
                {
                    endpoint: undefined,
                    endpoint_overrides: {
                        dev: 'https://plugin.example.com/dev/package',
                    },
                },
                { envName: 'dev' },
            ),
        ).toBeUndefined();
    });

    it('substitutes endpoint variables before gateway normalization', () => {
        expect(
            resolve('{{gateway}}/tenants/1589ba_149d0b/package/my-app', {
                vars: { gateway: 'https://gw.example.com/' },
            }),
        ).toBe(PACKAGE_MOUNT);
    });

    it('leaves regular package endpoints unchanged', () => {
        expect(resolve('https://third-party.example.com/api/package')).toBe(
            'https://third-party.example.com/api/package',
        );
    });

    it('leaves non-standard package endpoints unchanged and warns', () => {
        const logger: StudioUtilsLogger = {
            warn: vi.fn(),
        };
        const previousLogger = installStudioUtilsLogger(logger);

        expect(resolve('https://third-party.example.com/exotic/pkg')).toBe(
            'https://third-party.example.com/exotic/pkg',
        );
        expect(logger.warn).toHaveBeenCalledWith(
            { endpoint: 'https://third-party.example.com/exotic/pkg' },
            'Non-standard app package endpoint; returning it unchanged during app endpoint resolution',
        );

        installStudioUtilsLogger(previousLogger);
    });
});

describe('app API base resolution', () => {
    it('derives the API base by removing the final package URL segment', () => {
        expect(resolveAppApiBase('https://third-party.example.com/api/package')).toBe(
            'https://third-party.example.com/api',
        );
        expect(resolveAppApiBase('https://third-party.example.com/exotic/pkg')).toBe(
            'https://third-party.example.com/exotic',
        );
        expect(resolveAppApiBase(PACKAGE_MOUNT)).toBe('https://gw.example.com/tenants/1589ba_149d0b/apps/my-app/api');
        expect(resolveAppApiBase(VERSION_PACKAGE_MOUNT)).toBe(
            'https://gw.example.com/tenants/1589ba_149d0b/apps/my-app/versions/20260101T000000Z/api',
        );
    });

    it('resolves API-relative resource paths from package endpoints', () => {
        expect(resolveAppResource('https://third-party.example.com/api/package', 'tools/main')).toBe(
            'https://third-party.example.com/api/tools/main',
        );
        expect(resolveAppResource(PACKAGE_MOUNT, '/interactions/main/hello')).toBe(
            'https://gw.example.com/tenants/1589ba_149d0b/apps/my-app/api/interactions/main/hello',
        );
        expect(resolveAppResource(VERSION_PACKAGE_MOUNT, 'templates/invoice')).toBe(
            'https://gw.example.com/tenants/1589ba_149d0b/apps/my-app/versions/20260101T000000Z/api/templates/invoice',
        );
    });
});
