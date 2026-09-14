import { Env } from '@vertesia/ui/env';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getFirebaseAuth, setFirebaseTenant } from './firebase';

vi.mock('firebase/app', () => ({ initializeApp: vi.fn(() => ({})) }));
vi.mock('firebase/auth', () => ({ getAuth: vi.fn(() => ({ tenantId: null })) }));

describe('configured Firebase tenant', () => {
    afterEach(() => vi.restoreAllMocks());

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
});
