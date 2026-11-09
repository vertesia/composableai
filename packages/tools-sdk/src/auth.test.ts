import { exportJWK, generateKeyPair, SignJWT } from 'jose';
import { afterEach, describe, expect, it, vi } from 'vitest';

async function signedBy(issuer: string, claims: Record<string, unknown> = {}) {
    const { privateKey, publicKey } = await generateKeyPair('ES256');
    const token = await new SignJWT({ account: { id: 'a' }, project: { id: 'p' }, endpoints: {}, ...claims })
        .setProtectedHeader({ alg: 'ES256' })
        .setIssuer(issuer)
        .setExpirationTime('1h')
        .sign(privateKey);
    const jwksFetch = vi.fn(async (_url: string) => Response.json({ keys: [await exportJWK(publicKey)] }));
    vi.stubGlobal('fetch', jwksFetch);
    return { token, jwksFetch };
}

/** A fresh module per test: the trusted issuers are read from the environment once. */
async function loadVerifyToken() {
    vi.resetModules();
    return (await import('./auth.js')).verifyToken;
}

describe('verifyToken issuer allowlist', () => {
    it('rejects malformed permission claims from a trusted issuer', async () => {
        vi.stubEnv('VERTESIA_TRUSTED_ISSUERS', 'http://localhost:8202');
        const { token } = await signedBy('http://localhost:8202', {
            permissions: [],
            account_permissions: ['content:read'],
        });
        const verifyToken = await loadVerifyToken();
        await expect(verifyToken(token)).rejects.toThrow('Invalid token permission claims');
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.unstubAllEnvs();
    });

    it('rejects an issuer outside the built-in domains without fetching its keys', async () => {
        const { token, jwksFetch } = await signedBy('http://localhost:8202');
        const verifyToken = await loadVerifyToken();
        await expect(verifyToken(token)).rejects.toThrow('Issuer is not allowed: http://localhost:8202');
        expect(jwksFetch).not.toHaveBeenCalled();
    });

    it('accepts an issuer listed in VERTESIA_TRUSTED_ISSUERS', async () => {
        vi.stubEnv('VERTESIA_TRUSTED_ISSUERS', 'https://sts.example.test, http://localhost:8202/');
        const { token, jwksFetch } = await signedBy('http://localhost:8202');
        const verifyToken = await loadVerifyToken();
        const { payload } = await verifyToken(token);
        expect(payload.iss).toBe('http://localhost:8202');
        expect(jwksFetch).toHaveBeenCalledWith('http://localhost:8202/.well-known/jwks');
    });

    it('matches a trusted issuer exactly, not by prefix', async () => {
        vi.stubEnv('VERTESIA_TRUSTED_ISSUERS', 'http://localhost:8202');
        for (const issuer of ['http://localhost:8202/x', 'http://localhost:82020', 'http://localhost:8202?']) {
            const { token, jwksFetch } = await signedBy(issuer);
            const verifyToken = await loadVerifyToken();
            await expect(verifyToken(token)).rejects.toThrow(`Issuer is not allowed: ${issuer}`);
            expect(jwksFetch).not.toHaveBeenCalled();
        }
    });

    it.each([
        'https://attacker.example/x.vertesia.io',
        'https://attacker.example/?.vertesia.io',
        'https://attacker.example#.becomposable.com',
        'https://user@attacker.example/.vertesia.io',
        'http://sts.vertesia.io',
        'https://sts.vertesia.io:8443',
        'https://sts.vertesia.io/',
        'https://evilvertesia.io',
        'https://vertesia.io.attacker.example',
    ])('refuses the look-alike built-in issuer %s without fetching its keys', async (issuer) => {
        const { token, jwksFetch } = await signedBy(issuer);
        const verifyToken = await loadVerifyToken();
        await expect(verifyToken(token)).rejects.toThrow('Issuer is not allowed');
        expect(jwksFetch).not.toHaveBeenCalled();
    });

    it('accepts an HTTPS origin under a built-in domain', async () => {
        const { token, jwksFetch } = await signedBy('https://sts.us1.vertesia.io');
        const verifyToken = await loadVerifyToken();
        const { payload } = await verifyToken(token);
        expect(payload.iss).toBe('https://sts.us1.vertesia.io');
        expect(jwksFetch).toHaveBeenCalledWith('https://sts.us1.vertesia.io/.well-known/jwks');
    });
});
