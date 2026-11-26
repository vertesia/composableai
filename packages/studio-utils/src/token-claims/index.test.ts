import { type AuthTokenPayload, type ContentSecurity, PrincipalType } from '@vertesia/common';
import { describe, expect, it, vi } from 'vitest';
import {
    type AuthTokenWithInheritedClaims,
    resolveAbacClaim,
    resolveInheritedAgentClaims,
    TokenClaimReferenceError,
} from './index.js';

describe('resolveAbacClaim', () => {
    it('returns absent and inline claims without loading referenced state', async () => {
        const load = vi.fn();
        const inline: ContentSecurity = { read: [{ region: 'emea' }] };

        await expect(resolveAbacClaim(undefined, load)).resolves.toBeUndefined();
        await expect(resolveAbacClaim(inline, load)).resolves.toBe(inline);
        expect(load).not.toHaveBeenCalled();
    });

    it('loads ABAC from a referenced claim bundle', async () => {
        const abac: ContentSecurity = { 'collection:read': [{ name: 'Public' }] };
        const load = vi.fn().mockResolvedValue({ abac });

        const reference = 'R'.repeat(43);
        await expect(resolveAbacClaim(reference, load)).resolves.toBe(abac);
        expect(load).toHaveBeenCalledWith(reference);
    });

    it.each([
        ['', vi.fn()],
        ['M'.repeat(43), vi.fn().mockResolvedValue(undefined)],
        ['B'.repeat(43), vi.fn().mockResolvedValue([])],
        ['A'.repeat(43), vi.fn().mockResolvedValue({ another_claim: {} })],
        ['C'.repeat(43), vi.fn().mockResolvedValue({ abac: [] })],
        ['D'.repeat(43), vi.fn().mockResolvedValue({ abac: { read: 'invalid' } })],
        ['E'.repeat(43), vi.fn().mockResolvedValue({ abac: { read: [null] } })],
    ])('fails closed for an invalid reference bundle (%s)', async (reference, load) => {
        await expect(resolveAbacClaim(reference, load)).rejects.toBeInstanceOf(TokenClaimReferenceError);
    });
});

describe('resolveInheritedAgentClaims', () => {
    const installations = { version: 1 as const, project_id: 'p'.repeat(24), ids: ['i'.repeat(24)] };

    function principal(overrides: Partial<AuthTokenPayload> = {}): AuthTokenPayload {
        return {
            sub: 'user-1',
            name: 'User',
            type: PrincipalType.OAuthAccess,
            account: { id: 'account-1', name: 'Account' },
            account_roles: [],
            accounts: [],
            apps: ['crm', 'billing'],
            app_installations: installations,
            iss: 'issuer',
            aud: 'audience',
            exp: 1,
            ...overrides,
        };
    }

    function agentOf(onBehalfOf: AuthTokenPayload, marker: unknown): AuthTokenWithInheritedClaims {
        return {
            ...principal({ sub: `agent:${onBehalfOf.sub}`, type: PrincipalType.Agent, apps: [] }),
            app_installations: undefined,
            service_caller: { onBehalfOf },
            inherited_claims: marker as AuthTokenWithInheritedClaims['inherited_claims'],
        };
    }

    it('leaves a token without a marker unchanged', () => {
        const token = principal();
        expect(resolveInheritedAgentClaims(token)).toEqual(token);
    });

    it('reads inherited claims back from the snapshot and removes the marker', () => {
        const resolved = resolveInheritedAgentClaims(agentOf(principal(), ['apps', 'app_installations']));

        expect(resolved.apps).toEqual(['crm', 'billing']);
        expect(resolved.app_installations).toEqual(installations);
        expect(resolved).not.toHaveProperty('inherited_claims');
    });

    it('resolves a nested chain from the origin outwards', () => {
        const inner = agentOf(principal(), ['apps', 'app_installations']);
        const resolved = resolveInheritedAgentClaims(agentOf(inner, ['apps', 'app_installations']));

        expect(resolved.apps).toEqual(['crm', 'billing']);
        expect(resolved.app_installations).toEqual(installations);
        expect(resolved.service_caller?.onBehalfOf).not.toHaveProperty('inherited_claims');
        expect(resolved.service_caller?.onBehalfOf?.apps).toEqual(['crm', 'billing']);
    });

    it.each([
        ['an unknown claim name', agentOf(principal(), ['permissions'])],
        ['a marker that is not a list', agentOf(principal(), 'apps')],
        [
            'a claim missing from the snapshot',
            agentOf(principal({ app_installations: undefined }), ['app_installations']),
        ],
        ['an agent without a snapshot', { ...principal({ type: PrincipalType.Agent }), inherited_claims: ['apps'] }],
        [
            'a principal that is not an agent',
            { ...principal({ service_caller: { onBehalfOf: principal() } }), inherited_claims: ['apps'] },
        ],
    ] as const)('fails closed on %s', (_case, token) => {
        expect(() => resolveInheritedAgentClaims(token as AuthTokenWithInheritedClaims)).toThrow(
            TokenClaimReferenceError,
        );
    });
});
