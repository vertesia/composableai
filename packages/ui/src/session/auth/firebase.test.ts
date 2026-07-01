import { Env } from '@vertesia/ui/env';
import type { Auth } from 'firebase/auth';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setFirebaseTenant } from './firebase';

// A single fake Firebase Auth whose `tenantId` the tests assert against.
// `vi.hoisted` runs before the `vi.mock` factories, so both the mock and the
// test body share the same object reference.
const { fakeAuth } = vi.hoisted(() => ({
    fakeAuth: { tenantId: null as string | null },
}));

// `setFirebaseTenant` reaches the auth object via getFirebaseAuth() ->
// getAuth(getFirebaseApp()). Stub the SDK so no real Firebase app is created.
vi.mock('firebase/app', () => ({
    initializeApp: vi.fn(() => ({})),
}));
vi.mock('firebase/analytics', () => ({
    getAnalytics: vi.fn(() => ({})),
}));
vi.mock('firebase/auth', () => ({
    getAuth: vi.fn(() => fakeAuth as unknown as Auth),
}));

function mockResolveTenant(body: Record<string, unknown>, init?: { ok?: boolean; status?: number }) {
    const fetchMock = vi.fn().mockResolvedValue({
        ok: init?.ok ?? true,
        status: init?.status ?? 200,
        json: async () => body,
    });
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
}

describe('setFirebaseTenant', () => {
    beforeEach(() => {
        fakeAuth.tenantId = null;
        Env.init({
            name: 'test',
            version: 'test',
            isLocalDev: true,
            isDocker: false,
            type: 'development',
            endpoints: { zeno: '', studio: '', sts: '' },
            firebase: { apiKey: 'k', authDomain: 'd', projectId: 'p' },
        });
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    it('scopes Firebase to the tenant for OIDC providers', async () => {
        mockResolveTenant({ firebaseTenantId: 'church-4nd4f', provider: 'oidc' });

        const data = await setFirebaseTenant('user@churchofjesuschrist.org');

        expect(fakeAuth.tenantId).toBe('church-4nd4f');
        expect(data?.firebaseTenantId).toBe('church-4nd4f');
        expect(Env.firebase?.providerType).toBe('oidc');
    });

    it('defaults a missing provider to OIDC and scopes to the tenant', async () => {
        mockResolveTenant({ firebaseTenantId: 'church-4nd4f' });

        await setFirebaseTenant('user@churchofjesuschrist.org');

        expect(fakeAuth.tenantId).toBe('church-4nd4f');
        expect(Env.firebase?.providerType).toBe('oidc');
    });

    it('does not scope to the tenant for a non-OIDC provider (google)', async () => {
        mockResolveTenant({ firebaseTenantId: 'vertesia-t7ijc', provider: 'google' });

        const data = await setFirebaseTenant('user@vertesiahq.com');

        expect(fakeAuth.tenantId).toBeNull();
        expect(data?.firebaseTenantId).toBe('vertesia-t7ijc');
        expect(Env.firebase?.providerType).toBe('google');
    });

    it('clears stale tenant routing left over from a prior OIDC attempt (microsoft)', async () => {
        fakeAuth.tenantId = 'church-4nd4f'; // leftover from a previous OIDC resolution
        mockResolveTenant({ firebaseTenantId: 'accor-nhi32', provider: 'microsoft' });

        await setFirebaseTenant('user@accor.com');

        expect(fakeAuth.tenantId).toBeNull();
        expect(Env.firebase?.providerType).toBe('microsoft');
    });

    it('resolves no tenant when the email domain is not in the tenant map (404)', async () => {
        fakeAuth.tenantId = 'church-4nd4f'; // leftover from a prior attempt
        const fetchMock = mockResolveTenant({ error: 'Tenant not found' }, { ok: false, status: 404 });

        const data = await setFirebaseTenant('user@unknown-company.com');

        expect(data).toBeUndefined();
        expect(fetchMock).toHaveBeenCalledWith('/api/resolve-tenant', expect.objectContaining({ method: 'POST' }));
        // The not-found path intentionally leaves tenant routing untouched; the
        // caller (startSignIn's no-tenant branch) is what clears any stale id.
        expect(fakeAuth.tenantId).toBe('church-4nd4f');
    });
});
