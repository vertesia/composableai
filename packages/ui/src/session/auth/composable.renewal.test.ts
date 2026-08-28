// @vitest-environment jsdom
//
// Renewal of a Central Auth session: the case where the browser holds an STS JWT, nothing else, and
// that JWT has expired. There is no Firebase user to mint a replacement from and no refresh token,
// so the token layer either bounces through the broker or the page dead-ends until someone reloads
// it by hand.
import { NO_ACCESSIBLE_ACCOUNT_ERROR_CODE } from '@vertesia/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const logger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };

vi.mock('@vertesia/ui/env', () => ({
    Env: {
        endpoints: { sts: 'https://sts.test', studio: 'https://studio.test', auth: 'https://auth.test/' },
        logger,
    },
}));

// No Firebase user: that is what makes this a Central Auth session rather than a Firebase one.
vi.mock('./firebase', () => ({
    getFirebaseAuth: () => ({ currentUser: null }),
    getFirebaseAuthToken: vi.fn(),
}));

function unsignedJwt(payload: Record<string, unknown>): string {
    const encode = (value: string) => btoa(value).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    return `${encode(JSON.stringify({ alg: 'none', typ: 'JWT' }))}.${encode(JSON.stringify(payload))}.signature`;
}

const ACCOUNT_ID = 'account-1';
const PROJECT_ID = 'project-1';

/** A token STS would accept back for re-issuance: its own issuer, and real authorization claims. */
function stsToken(secondsFromNow: number): string {
    return unsignedJwt({
        iss: 'https://sts.test',
        exp: Math.floor(Date.now() / 1000) + secondsFromNow,
        account: { id: ACCOUNT_ID },
        project: { id: PROJECT_ID },
        permissions: ['content:read'],
    });
}

function okResponse(token: string): Response {
    return new Response(JSON.stringify({ token }), { status: 200 });
}

let replace: ReturnType<typeof vi.fn>;

beforeEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
    localStorage.clear();
    sessionStorage.clear();
    logger.info.mockClear();
    logger.warn.mockClear();

    // `location.replace` is the redirect under test; jsdom's own implementation would only warn.
    replace = vi.fn();
    vi.stubGlobal('location', {
        href: 'https://cloud.test/studio/environments',
        replace,
    });
    // `shouldRedirectToCentralAuth()` is "not Firebase mode", which is the default here.
    window.AUTH_MODE = undefined;
});

describe('forced refresh of a Central Auth session', () => {
    it('re-mints through STS instead of handing back the credential it already holds', async () => {
        // The bug this pins: the refresh path adopted a still-valid Vertesia token as its own
        // result, so `refreshAuthToken()` -- whose whole purpose is to re-read claims STS
        // recomputes on every issuance, such as `apps` after an ACE change -- silently returned the
        // very token whose claims were suspect. A Central Auth session has no other credential, so
        // the no-op was total there.
        const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(okResponse(stsToken(7200)));

        const { getComposableToken } = await import('./composable');
        // Adopted without a round-trip, which is the right call when nothing forced a refresh.
        const first = await getComposableToken(ACCOUNT_ID, PROJECT_ID, stsToken(3600));
        expect(fetchMock).not.toHaveBeenCalled();

        const refreshed = await getComposableToken(undefined, undefined, undefined, true);

        // Before the fix this was zero: the same shortcut swallowed the forced refresh too.
        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(refreshed.token.exp).toBeGreaterThan(first.token.exp);
    });
});

describe('an expired Central Auth session', () => {
    /**
     * Establish a session whose token is already inside the five-minute renewal window, then answer
     * the renewal attempt with `status`. This is the shape of the reported incident: the tab sat
     * idle, the token aged out, and the next click tried to renew from a credential STS refuses.
     */
    async function sessionThenRenewalFailure(status: number, body?: unknown) {
        const nearlyExpired = stsToken(60);
        vi.spyOn(globalThis, 'fetch')
            .mockResolvedValueOnce(okResponse(nearlyExpired))
            .mockResolvedValueOnce(new Response(body === undefined ? null : JSON.stringify(body), { status }));

        const { getComposableToken } = await import('./composable');
        await getComposableToken(ACCOUNT_ID, PROJECT_ID, nearlyExpired);
        return getComposableToken;
    }

    it('bounces through the broker rather than dead-ending', async () => {
        const getComposableToken = await sessionThenRenewalFailure(401);

        await expect(getComposableToken(ACCOUNT_ID, PROJECT_ID)).rejects.toThrow();

        expect(replace).toHaveBeenCalledTimes(1);
        const url = new URL(replace.mock.calls[0][0] as string);
        expect(url.origin).toBe('https://auth.test');
        expect(url.searchParams.get('sts')).toBe('https://sts.test');
        expect(url.searchParams.get('redirect_uri')).toBe('https://cloud.test/studio/environments');
        // The broker echoes `state` back; the return leg verifies it against this record.
        expect(url.searchParams.get('state')).toBe(sessionStorage.getItem('auth_state'));
    });

    it('redirects once per expiry, not once per failing call', async () => {
        // Every in-flight request fails at the same moment, and the first failure discards the
        // credential -- so the calls behind it reach the "no credential at all" branch. Without the
        // cooldown each one would start its own navigation.
        const getComposableToken = await sessionThenRenewalFailure(401);

        await expect(getComposableToken(ACCOUNT_ID, PROJECT_ID)).rejects.toThrow();
        await expect(getComposableToken(ACCOUNT_ID, PROJECT_ID)).rejects.toThrow(/Cannot acquire/);

        expect(replace).toHaveBeenCalledTimes(1);
    });

    it('does not redirect again for a broker round-trip that just failed', async () => {
        // The loop guard, from the other side of the navigation: module state is gone, so the
        // cooldown has to be read back from sessionStorage. A broker that returns a credential STS
        // also refuses would otherwise bounce the browser between the two forever.
        sessionStorage.setItem('vt.centralAuthRenewalAt', String(Date.now() - 1_000));
        const getComposableToken = await sessionThenRenewalFailure(401);

        await expect(getComposableToken(ACCOUNT_ID, PROJECT_ID)).rejects.toThrow();

        expect(replace).not.toHaveBeenCalled();
        expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('already attempted'), expect.anything());
    });

    it('leaves an account-level refusal alone', async () => {
        // The broker would hand back the same identity and STS would refuse it again. This is a
        // question for the recovery screen, not for another round-trip.
        const getComposableToken = await sessionThenRenewalFailure(403, {
            errorCode: NO_ACCESSIBLE_ACCOUNT_ERROR_CODE,
        });

        await expect(getComposableToken(ACCOUNT_ID, PROJECT_ID)).rejects.toThrow();

        expect(replace).not.toHaveBeenCalled();
    });
});

describe('a browser with no session yet', () => {
    it('does not redirect from the token layer', async () => {
        // First load is UserSessionProvider's to route: it holds the account/project selection this
        // layer cannot see, and it already redirects. Renewing from here would race it.
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 401 }));

        const { getComposableToken } = await import('./composable');
        await expect(getComposableToken(ACCOUNT_ID, PROJECT_ID, stsToken(-60))).rejects.toThrow();

        expect(replace).not.toHaveBeenCalled();
    });
});
