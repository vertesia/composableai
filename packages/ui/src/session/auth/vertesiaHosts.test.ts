import { describe, expect, it } from 'vitest';
import { FIRST_PARTY_HOST_PATTERNS, isTrustedAuthBrokerUrl } from './vertesiaHosts';

const isFirstPartyHost = (hostname: string) => FIRST_PARTY_HOST_PATTERNS.some((pattern) => pattern.test(hostname));

describe('first-party UI hosts', () => {
    it.each([
        'cloud.vertesia.io',
        'preview.cloud.us1.vertesia.io',
        'dev-feat-x.ui.dev1.vertesia.io',
        'admin.vertesia.io',
        'admin.us1.vertesia.io',
        'preview.admin.vertesia.io',
        'preprod.admin.eu1.vertesia.io',
        'admin-ui-dev-feat-x.admin.dev1.vertesia.io',
    ])('recognizes %s', (hostname) => {
        expect(isFirstPartyHost(hostname)).toBe(true);
    });
    it.each([
        'evil-admin.vertesia.io',
        'admin.vertesia.io.evil.example',
        'admin.evil.example',
        'a.b.admin.us1.vertesia.io',
        'admin.vertesia.dev',
    ])('rejects %s', (hostname) => {
        expect(isFirstPartyHost(hostname)).toBe(false);
    });
});

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
