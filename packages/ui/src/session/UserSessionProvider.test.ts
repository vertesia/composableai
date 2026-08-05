import { describe, expect, it } from 'vitest';
import { RequestedScopeUnavailableError } from './auth/composable';
import { sanitizeRejectedScopeUrl } from './UserSessionProvider';

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
