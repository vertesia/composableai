import { describe, expect, it } from 'vitest';
import { validateApiRequest } from '../api-contract/index.js';

describe('manifest standalone OAuth declaration', () => {
    it('accepts exact callback URLs without an installation mode or client ID', () => {
        expect(
            validateApiRequest('AppOAuthClientConfig', {
                redirect_uris: ['https://example.vercel.app/app'],
            }).valid,
        ).toBe(true);
    });
    it.each([
        {},
        { redirect_uris: [] },
        { redirect_uris: ['not-a-url'] },
        {
            redirect_uris: ['https://example.vercel.app/app'],
            mode: 'create',
        },
    ])('rejects incomplete or unknown manifest configuration %j', (config) => {
        expect(validateApiRequest('AppOAuthClientConfig', config).valid).toBe(false);
    });
    it('keeps standalone client configuration out of project installation settings', () => {
        expect(
            validateApiRequest('AppInstallationPayload', {
                app_id: 'app',
                oauth_client: { mode: 'create', redirect_uris: ['https://example.vercel.app/app'] },
            }).valid,
        ).toBe(false);
    });
});
