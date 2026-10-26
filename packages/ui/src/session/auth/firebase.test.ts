import { Env } from '@vertesia/ui/env';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getFirebaseAuth, getFirebaseAuthToken, setFirebaseTenant } from './firebase';

const firebaseMocks = vi.hoisted(() => ({
    auth: {
        tenantId: null as string | null,
        currentUser: null as null | {
            email: string;
            displayName: string;
            uid: string;
            getIdToken: ReturnType<typeof vi.fn>;
        },
    },
}));

vi.mock('firebase/app', () => ({ initializeApp: vi.fn(() => ({})) }));
vi.mock('firebase/auth', () => ({ getAuth: vi.fn(() => firebaseMocks.auth) }));

describe('configured Firebase tenant', () => {
    afterEach(() => {
        firebaseMocks.auth.tenantId = null;
        firebaseMocks.auth.currentUser = null;
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
    });

    it('initializes redirect handling with the tenant and skips email discovery', async () => {
        vi.spyOn(Env, 'firebase', 'get').mockReturnValue({
            apiKey: 'key',
            authDomain: 'app.example.com',
            projectId: 'project',
            tenantId: 'fixed-tenant',
        });
        const fetchSpy = vi.spyOn(globalThis, 'fetch');
        expect(getFirebaseAuth().tenantId).toBe('fixed-tenant');
        const tenant = await setFirebaseTenant('someone@another-company.com');
        expect(tenant?.firebaseTenantId).toBe('fixed-tenant');
        expect(tenant?.provider).toBe('oidc');
        expect(fetchSpy).not.toHaveBeenCalled();
    });

    it.each([
        ['a null answer', () => new Response('null', { status: 200, headers: { 'content-type': 'application/json' } })],
        [
            'the 404 older servers return',
            () =>
                new Response(JSON.stringify({ error: 'Tenant not found' }), {
                    status: 404,
                    headers: { 'content-type': 'application/json' },
                }),
        ],
    ])('treats %s as an address without a tenant, logged at debug', async (_label, respond) => {
        vi.spyOn(Env, 'firebase', 'get').mockReturnValue({
            apiKey: 'key',
            authDomain: 'app.example.com',
            projectId: 'project',
        });
        vi.stubGlobal(
            'fetch',
            vi.fn().mockImplementation(async () => respond()),
        );
        const debug = vi.spyOn(Env.logger, 'debug');
        const warn = vi.spyOn(Env.logger, 'warn');
        const error = vi.spyOn(Env.logger, 'error');

        await expect(setFirebaseTenant('someone@another-company.com')).resolves.toBeUndefined();

        expect(debug).toHaveBeenCalledWith('No Firebase tenant for this address; using the default tenant');
        expect(warn).not.toHaveBeenCalled();
        expect(error).not.toHaveBeenCalled();
    });

    it('logs a token refresh failure once at warning level', async () => {
        vi.spyOn(Env, 'firebase', 'get').mockReturnValue({
            apiKey: 'key',
            authDomain: 'app.example.com',
            projectId: 'project',
        });
        firebaseMocks.auth.currentUser = {
            email: 'someone@example.com',
            displayName: 'Someone',
            uid: 'user-id',
            getIdToken: vi.fn().mockRejectedValue(new Error('network unavailable')),
        };
        const warn = vi.spyOn(Env.logger, 'warn');
        const error = vi.spyOn(Env.logger, 'error');

        await expect(getFirebaseAuthToken(true)).resolves.toBeNull();

        expect(warn).toHaveBeenCalledOnce();
        expect(error).not.toHaveBeenCalled();
    });
});
