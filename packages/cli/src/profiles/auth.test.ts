import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Profile } from './index.js';
import type { StoredAuthBundle } from './keyring.js';
import type { ConfigResult } from './server/index.js';

const mocks = vi.hoisted(() => ({
    directory: '',
    bundle: undefined as StoredAuthBundle | undefined,
    refresh: vi.fn(),
    persist: vi.fn(),
    readError: undefined as Error | undefined,
    lock: vi.fn(),
    start: vi.fn(),
}));
vi.mock('./index.js', () => ({
    config: {
        getProfile: () => profile,
        updateProfile: () => ({ persistConfigResult: mocks.persist, start: mocks.start }),
    },
}));
vi.mock('./oauth.js', () => ({ canUseOAuthProfile: () => true, refreshOAuthSession: mocks.refresh }));
vi.mock('./auth-lock.js', async (importOriginal) => {
    const actual = await importOriginal<typeof import('./auth-lock.js')>();
    return {
        ...actual,
        withProfileAuthLock: <T>(name: string, operation: () => Promise<T>) => {
            mocks.lock();
            return actual.withProfileAuthLock(name, operation, mocks.directory);
        },
    };
});

import {
    createProfileAuthProvider,
    ensureProfileAccessToken,
    refreshProfileAccessToken,
    refreshProfileAuthentication,
} from './auth.js';
import { AuthRefreshLockError } from './auth-lock.js';

const profile: Profile = {
    name: 'test',
    account: 'account',
    project: 'project',
    config_url: 'https://example.test/cli',
    studio_server_url: 'https://api.example.test',
    zeno_server_url: 'https://store.example.test',
};
const result: ConfigResult = {
    profile: profile.name,
    account: profile.account,
    project: profile.project,
    studio_server_url: profile.studio_server_url,
    zeno_server_url: profile.zeno_server_url,
    token: 'new-access',
    refresh_token: 'new-refresh',
    access_token_expires_at: Date.now() + 3_600_000,
};

beforeEach(async () => {
    vi.resetAllMocks();
    mocks.readError = undefined;
    vi.stubGlobal('Bun', {
        secrets: {
            get: async () => {
                if (mocks.readError) throw mocks.readError;
                return mocks.bundle ? JSON.stringify(mocks.bundle) : null;
            },
        },
    });
    mocks.directory = await mkdtemp(join(tmpdir(), 'cli-auth-test-'));
    mocks.bundle = {
        version: 1,
        accessToken: 'old-access',
        accessTokenExpiresAt: Date.now() - 1000,
        refreshToken: 'old-refresh',
    };
    mocks.refresh.mockResolvedValue(result);
    mocks.persist.mockImplementation(async (value: ConfigResult) => {
        mocks.bundle = {
            version: 1,
            accessToken: value.token,
            accessTokenExpiresAt: value.access_token_expires_at,
            refreshToken: value.refresh_token,
        };
    });
});
afterEach(async () => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    await rm(mocks.directory, { recursive: true, force: true });
});

describe('profile refresh', () => {
    it('automatically refreshes an expired token and saves the rotated credentials', async () => {
        expect(await createProfileAuthProvider(profile)()).toBe('Bearer new-access');
        expect(mocks.refresh).toHaveBeenCalledWith(profile, 'old-refresh', expect.anything(), {});
        expect(mocks.persist).toHaveBeenCalledWith(result, expect.objectContaining({ requireKeyring: true }));
    });

    it('rechecks the keychain after waiting for another automatic refresh', async () => {
        const tokens = await Promise.all([ensureProfileAccessToken(profile), ensureProfileAccessToken(profile)]);
        expect(tokens).toEqual(['new-access', 'new-access']);
        expect(mocks.refresh).toHaveBeenCalledTimes(1);
    });

    it('holds the lock through persistence and never replays a token during manual refresh', async () => {
        const used: string[] = [];
        mocks.refresh.mockImplementation(async (_profile: Profile, refresh: string) => {
            used.push(refresh);
            return { ...result, refresh_token: `rotated-${used.length}` };
        });
        await Promise.all([refreshProfileAccessToken(profile), refreshProfileAccessToken(profile)]);
        expect(used).toEqual(['old-refresh', 'rotated-1']);
    });

    it.each([400, 503])(
        'preserves the refresh failure (%s) and credentials instead of sending an expired token',
        async (status) => {
            const error = new Error(`OAuth token exchange failed (${status})`);
            const original = { ...mocks.bundle };
            mocks.refresh.mockRejectedValue(error);
            await expect(createProfileAuthProvider(profile)()).rejects.toBe(error);
            expect(mocks.bundle).toEqual(original);
            expect(mocks.persist).not.toHaveBeenCalled();
        },
    );

    it('can recover on the next request after a failed refresh', async () => {
        mocks.refresh.mockRejectedValueOnce(new Error('Unavailable')).mockResolvedValue(result);
        const auth = createProfileAuthProvider(profile);
        await expect(auth()).rejects.toThrow('Unavailable');
        expect(await auth()).toBe('Bearer new-access');
    });

    it('only falls back while the stored token is still valid', async () => {
        mocks.bundle = { ...mocks.bundle, version: 1, accessTokenExpiresAt: Date.now() + 20_000 };
        mocks.refresh.mockRejectedValue(new Error('Unavailable'));
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        expect(await createProfileAuthProvider(profile)()).toBe('Bearer old-access');
    });

    it('does not fall back if the token expires during the exchange', async () => {
        mocks.bundle = { ...mocks.bundle, version: 1, accessTokenExpiresAt: Date.now() + 20_000 };
        mocks.refresh.mockImplementation(async () => {
            mocks.bundle = { ...mocks.bundle, version: 1, accessTokenExpiresAt: Date.now() - 1 };
            throw new Error('Unavailable');
        });
        await expect(createProfileAuthProvider(profile)()).rejects.toThrow('Unavailable');
    });

    it('does not assume an access token with unknown expiry is valid', async () => {
        mocks.bundle = { ...mocks.bundle, version: 1, accessTokenExpiresAt: undefined };
        mocks.refresh.mockRejectedValue(new Error('Unavailable'));
        await expect(createProfileAuthProvider(profile)()).rejects.toThrow('Unavailable');
    });

    it.each([undefined, 0])('uses a valid profile-file token when keychain expiry is %s', async (expiry) => {
        mocks.bundle = { ...mocks.bundle, version: 1, accessTokenExpiresAt: expiry };
        const fileToken = tokenWithExpiry(Date.now() + 60_000);
        const auth = createProfileAuthProvider({ ...profile, apikey: fileToken });
        expect(await auth()).toBe(`Bearer ${fileToken}`);
        expect(mocks.refresh).not.toHaveBeenCalled();
    });

    it('still prefers a valid keychain token over the profile-file token', async () => {
        mocks.bundle = { ...mocks.bundle, version: 1, accessTokenExpiresAt: Date.now() + 60_000 };
        const fileToken = tokenWithExpiry(Date.now() + 60_000);
        expect(await createProfileAuthProvider({ ...profile, apikey: fileToken })()).toBe('Bearer old-access');
    });

    it('never falls back to an expired profile-file token', async () => {
        const fileToken = tokenWithExpiry(Date.now() - 1);
        mocks.refresh.mockRejectedValue(new Error('Unavailable'));
        await expect(createProfileAuthProvider({ ...profile, apikey: fileToken })()).rejects.toThrow('Unavailable');
    });

    it('rejects a fallback with less than five seconds remaining', async () => {
        mocks.bundle = { ...mocks.bundle, version: 1, accessTokenExpiresAt: Date.now() + 1000 };
        mocks.refresh.mockRejectedValue(new Error('Unavailable'));
        await expect(createProfileAuthProvider(profile)()).rejects.toThrow('Unavailable');
    });

    it('preserves the refresh error if reading fallback credentials also fails', async () => {
        const error = new Error('OAuth unavailable');
        mocks.refresh.mockImplementation(async () => {
            mocks.readError = new Error('Invalid keychain payload');
            throw error;
        });
        await expect(createProfileAuthProvider(profile)()).rejects.toBe(error);
    });

    it('does not acquire a lock when refresh is unavailable', async () => {
        mocks.bundle = undefined;
        await expect(ensureProfileAccessToken(profile)).resolves.toBeUndefined();
        await expect(refreshProfileAccessToken(profile)).resolves.toBeUndefined();
        expect(mocks.lock).not.toHaveBeenCalled();
    });

    it('does not bypass a coordination failure through interactive authentication', async () => {
        const error = new AuthRefreshLockError('Coordination unavailable', new Error('Access denied'));
        mocks.lock.mockImplementation(() => {
            throw error;
        });
        await expect(refreshProfileAuthentication(profile.name)).rejects.toBe(error);
        expect(mocks.start).not.toHaveBeenCalled();
        expect(mocks.refresh).not.toHaveBeenCalled();
    });

    it('surfaces failed persistence and releases the lock', async () => {
        mocks.persist.mockRejectedValueOnce(new Error('Keychain unavailable'));
        await expect(refreshProfileAccessToken(profile)).rejects.toThrow('Keychain unavailable');
        await expect(refreshProfileAccessToken(profile)).resolves.toMatchObject({ token: 'new-access' });
    });
});

function tokenWithExpiry(expiry: number): string {
    const payload = Buffer.from(JSON.stringify({ exp: Math.floor(expiry / 1000) })).toString('base64url');
    return `eyJhbGciOiJub25lIn0.${payload}.`;
}
