import type { ContentSecurity } from '@vertesia/common';
import { describe, expect, it, vi } from 'vitest';
import { resolveAbacClaim, TokenClaimReferenceError } from './index.js';

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
