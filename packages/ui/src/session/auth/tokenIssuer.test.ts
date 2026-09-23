import { describe, expect, it } from 'vitest';
import { isStsTokenIssuer } from './tokenIssuer';

const branch = 'https://token-server-dev-example.api.dev1.vertesia.io';
describe('legacy STS issuer routing', () => {
    it('recognizes the configured endpoint and regional branch issuer', () => {
        expect(isStsTokenIssuer(`${branch}/`, branch)).toBe(true);
        expect(isStsTokenIssuer('https://sts.dev1.vertesia.io/', branch)).toBe(true);
    });
    it.each([
        'https://customer.example.com',
        'https://token-server-dev-example.api.dev1.vertesia.io.attacker.test',
        `${branch}:444`,
        `${branch}/env/dev1/other`,
        branch.replace('https:', 'http:'),
        branch.replace('https://', 'https://user@'),
    ])('does not infer a regional issuer for %s', (endpoint) => {
        expect(isStsTokenIssuer('https://sts.dev1.vertesia.io', endpoint)).toBe(false);
    });
    it('rejects other regions and providers', () => {
        expect(isStsTokenIssuer('https://sts.dev2.vertesia.io', branch)).toBe(false);
        expect(isStsTokenIssuer('https://securetoken.google.com/project', branch)).toBe(false);
        expect(isStsTokenIssuer(undefined, branch)).toBe(false);
    });
});
