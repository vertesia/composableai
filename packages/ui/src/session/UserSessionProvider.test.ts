import { describe, expect, it } from 'vitest';
import { RequestedScopeUnavailableError } from './auth/composable';
import { buildCentralAuthRedirectUrl, sanitizeRejectedScopeUrl } from './UserSessionProvider';

describe('sanitizeRejectedScopeUrl', () => {
    it.each([
        {
            name: 'an account/project pair',
            input: 'https://app.example.test/studio/dashboard?a=apple&p=banana&tab=runs',
            accountId: 'apple',
            projectId: 'banana',
            expected: 'https://app.example.test/studio/dashboard?tab=runs',
            scope: 'project',
        },
        {
            name: 'a project-only selector',
            input: 'https://app.example.test/studio/dashboard?p=banana&tab=runs',
            accountId: undefined,
            projectId: 'banana',
            expected: 'https://app.example.test/studio/dashboard?tab=runs',
            scope: 'project',
        },
        {
            name: 'an account-only selector',
            input: 'https://app.example.test/studio/dashboard?a=apple&tab=runs',
            accountId: 'apple',
            projectId: undefined,
            expected: 'https://app.example.test/studio/dashboard?tab=runs',
            scope: 'account',
        },
    ])('removes $name while preserving the path and unrelated parameters', (testCase) => {
        const error = new RequestedScopeUnavailableError(
            'https://sts.example.test',
            testCase.accountId,
            testCase.projectId,
        );

        const result = sanitizeRejectedScopeUrl(new URL(testCase.input), error);

        expect(result.toString()).toBe(testCase.expected);
        expect(error.recoveryUrl).toBe(testCase.expected);
        expect(error.requestedScope).toBe(testCase.scope);
        expect(error.selectorSource).toBe('url');
    });

    it('clears central-auth state while preserving unrelated query parameters', () => {
        const error = new RequestedScopeUnavailableError('https://sts.example.test', 'apple', 'banana');

        const result = sanitizeRejectedScopeUrl(
            new URL('https://app.example.test/deep/path?a=apple&p=banana&view=grid#token=secret&state=opaque'),
            error,
            true,
        );

        expect(result.toString()).toBe('https://app.example.test/deep/path?view=grid');
        expect(error.recoveryUrl).not.toContain('secret');
    });

    it('marks a matching persisted-only selection without removing unrelated URL state', () => {
        const error = new RequestedScopeUnavailableError('https://sts.example.test', 'stored-a', 'stored-p');
        const input = new URL('https://app.example.test/deep/path?view=grid');

        const result = sanitizeRejectedScopeUrl(input, error);

        expect(result.toString()).toBe(input.toString());
        expect(error.selectorSource).toBe('persisted');
        expect(error.requestedScope).toBe('project');
    });
});

describe('buildCentralAuthRedirectUrl', () => {
    const RETURN_URL = new URL('https://app.example.test/studio/dashboard?tab=runs');
    const STS = 'https://sts.example.test';

    it('carries the sts, redirect_uri and state parameters', () => {
        const url = buildCentralAuthRedirectUrl('https://auth.example.test/', STS, RETURN_URL, 'state-123');

        expect(url.origin).toBe('https://auth.example.test');
        expect(url.pathname).toBe('/');
        expect(url.searchParams.get('sts')).toBe(STS);
        expect(url.searchParams.get('redirect_uri')).toBe(RETURN_URL.toString());
        expect(url.searchParams.get('state')).toBe('state-123');
    });

    it('carries the selected account and project through a gateway-mounted app redirect', () => {
        const returnUrl = new URL('https://apps.example.test/tenants/t/apps/a/versions/v/app/?view=grid');
        const url = buildCentralAuthRedirectUrl('https://auth.example.test/', STS, returnUrl, 'state-123', {
            accountId: 'account-1',
            projectId: 'project-1',
        });

        expect(url.searchParams.get('redirect_uri')).toBe(
            'https://apps.example.test/tenants/t/apps/a/versions/v/app/?view=grid&p=project-1&a=account-1',
        );
    });

    // The endpoint is configurable, so it can arrive with a query of its own. Concatenating
    // `?sts=...` onto it folds the parameter into the existing value and Central Auth sees no sts.
    it('preserves a query already present on the configured endpoint', () => {
        const url = buildCentralAuthRedirectUrl('https://auth.example.test/?tenant=acme', STS, RETURN_URL, 'state-123');

        expect(url.searchParams.get('tenant')).toBe('acme');
        expect(url.searchParams.get('sts')).toBe(STS);
        expect(url.searchParams.get('redirect_uri')).toBe(RETURN_URL.toString());
        expect(url.searchParams.get('state')).toBe('state-123');
    });

    // Same hazard from the other side: appended after a fragment, the parameters land inside it.
    it('keeps the parameters out of a fragment on the configured endpoint', () => {
        const url = buildCentralAuthRedirectUrl('https://auth.example.test/#section', STS, RETURN_URL, 'state-123');

        expect(url.hash).toBe('#section');
        expect(url.searchParams.get('sts')).toBe(STS);
        expect(url.searchParams.get('state')).toBe('state-123');
    });

    it('preserves a path prefix on the configured endpoint', () => {
        const url = buildCentralAuthRedirectUrl('https://auth.example.test/signin', STS, RETURN_URL, 'state-123');

        expect(url.pathname).toBe('/signin');
        expect(url.searchParams.get('sts')).toBe(STS);
    });

    it('percent-encodes the parameter values', () => {
        const url = buildCentralAuthRedirectUrl('https://auth.example.test/', STS, RETURN_URL, 'a b&c=d');

        expect(url.search).toContain('sts=https%3A%2F%2Fsts.example.test');
        expect(url.searchParams.get('state')).toBe('a b&c=d');
    });
});
