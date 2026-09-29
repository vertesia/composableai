import { describe, expect, it } from 'vitest';
import { apiServerPlugin, injectRuntimeConfigMarker } from './api-server.js';

describe('apiServerPlugin runtime configuration marker', () => {
    it('injects the versioned marker into application HTML', () => {
        expect(injectRuntimeConfigMarker('<html><head><title>App</title></head></html>')).toContain(
            '<meta name="vertesia-runtime-config" content="v1" />',
        );
    });

    it('does not duplicate an existing runtime configuration marker', () => {
        const html = '<html><head><meta content="v1" name="vertesia-runtime-config"><title>App</title></head></html>';

        expect(injectRuntimeConfigMarker(html)).toBe(html);
    });

    it('records the explicit app auth mode for the serving gateway', () => {
        expect(injectRuntimeConfigMarker('<head></head>', 'firebase')).toContain('data-auth-mode="firebase"');
        expect(injectRuntimeConfigMarker('<head></head>', 'central')).toContain('data-auth-mode="central"');
        expect(() => injectRuntimeConfigMarker('<head></head>', 'typo')).toThrow('VITE_AUTH_MODE');
    });

    it('updates an existing marker with the build mode without duplicating it', () => {
        const html = '<head><meta name="vertesia-runtime-config" content="v1" /></head>';
        const result = injectRuntimeConfigMarker(html, 'firebase');
        expect(result.match(/vertesia-runtime-config/g)).toHaveLength(1);
        expect(result).toContain('data-auth-mode="firebase"');
    });

    it('includes marker emission in the existing API server plugin set', () => {
        expect(apiServerPlugin().map((plugin) => plugin.name)).toContain('vertesia-runtime-config-marker');
    });
});
