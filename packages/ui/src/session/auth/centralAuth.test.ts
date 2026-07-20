import { describe, expect, it } from 'vitest';
import { buildCentralAuthRedirectUrl } from './centralAuth';

describe('buildCentralAuthRedirectUrl', () => {
    it('adds a localStorage-derived account and project to the cross-origin redirect', () => {
        const result = new URL(
            buildCentralAuthRedirectUrl('https://studio.vertesia.io/', 'https://sts.vertesia.io', 'state-value', {
                accountId: 'account-a',
                projectId: 'project-a',
            }),
        );
        const redirectUrl = new URL(result.searchParams.get('redirect_uri') ?? '');

        expect(result.origin).toBe('https://internal-auth.vertesia.app');
        expect(result.searchParams.get('sts')).toBe('https://sts.vertesia.io');
        expect(result.searchParams.get('state')).toBe('state-value');
        expect(redirectUrl.searchParams.get('a')).toBe('account-a');
        expect(redirectUrl.searchParams.get('p')).toBe('project-a');
    });

    it('preserves existing page parameters and removes the token hash', () => {
        const result = new URL(
            buildCentralAuthRedirectUrl(
                'https://studio.vertesia.io/path?view=list#token=sensitive',
                'https://sts.vertesia.io',
                'state-value',
            ),
        );
        const redirectUrl = new URL(result.searchParams.get('redirect_uri') ?? '');

        expect(redirectUrl.pathname).toBe('/path');
        expect(redirectUrl.searchParams.get('view')).toBe('list');
        expect(redirectUrl.hash).toBe('');
    });
});
