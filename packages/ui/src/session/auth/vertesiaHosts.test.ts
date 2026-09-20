import { describe, expect, it } from 'vitest';
import { isTrustedAuthBrokerUrl } from './vertesiaHosts';

describe('runtime auth broker trust', () => {
    it.each(['https://auth.vertesia.io/', 'https://auth.dev1.vertesia.io/', 'https://AUTH.US1.VERTESIA.IO./'])(
        'accepts %s',
        (url) => {
            expect(isTrustedAuthBrokerUrl(url)).toBe(true);
        },
    );
    it.each([
        'https://evil.example/',
        'https://auth.vertesia.io.evil/',
        'https://apps.dev1.vertesia.io/',
        'https://auth.vertesia.io@evil.example/',
        'https://auth.vertesia.io/?redirect_uri=evil',
        'http://auth.vertesia.io/',
        'https://auth.vertesia.io:444/',
    ])('rejects %s', (url) => {
        expect(isTrustedAuthBrokerUrl(url)).toBe(false);
    });
    it('requires an explicit local development opt-in for loopback', () => {
        expect(isTrustedAuthBrokerUrl('http://localhost:8080/')).toBe(false);
        expect(isTrustedAuthBrokerUrl('http://localhost:8080/', { allowLoopback: true })).toBe(true);
    });
});

it('trusts only dedicated dev1 branch broker hosts', () => {
    expect(isTrustedAuthBrokerUrl('https://auth-server-dev-fix-login.api.dev1.vertesia.io')).toBe(true);
    expect(isTrustedAuthBrokerUrl('https://auth-server-dev-fix-login.api.us1.vertesia.io')).toBe(false);
    expect(isTrustedAuthBrokerUrl('https://app-gateway-dev-fix-login.api.dev1.vertesia.io')).toBe(false);
    expect(isTrustedAuthBrokerUrl('https://auth-server-dev-fix-login.api.dev1.vertesia.io.evil.com')).toBe(false);
});
