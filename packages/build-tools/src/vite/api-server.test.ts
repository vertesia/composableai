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

    it('includes marker emission in the existing API server plugin set', () => {
        expect(apiServerPlugin().map((plugin) => plugin.name)).toContain('vertesia-runtime-config-marker');
    });
});
