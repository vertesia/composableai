import { Env } from '@vertesia/ui/env';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { generateAuthState, takeAuthReturnHash } from './authState';
import { redirectToCentralAuth } from './domainRouting';

describe('auth return hash', () => {
    afterEach(() => {
        vi.useRealTimers();
        sessionStorage.clear();
        window.history.replaceState(null, '', '/');
    });

    it('remembers the hash of the page that starts the round-trip, once', () => {
        window.history.replaceState(null, '', '/settings/projects/applications?p=1#mcp');
        generateAuthState();

        expect(takeAuthReturnHash()).toBe('mcp');
        expect(takeAuthReturnHash()).toBeUndefined();
    });

    it('never stores a hash of key=value pairs', () => {
        window.history.replaceState(null, '', '/settings#token=secret&state=abc');
        generateAuthState();

        expect(takeAuthReturnHash()).toBeUndefined();
        expect(JSON.stringify({ ...sessionStorage })).not.toContain('secret');
    });

    it('forgets a hash from an earlier round-trip when the new page has none', () => {
        window.history.replaceState(null, '', '/a#first');
        generateAuthState();
        window.history.replaceState(null, '', '/b');
        generateAuthState();

        expect(takeAuthReturnHash()).toBeUndefined();
    });

    it('drops a hash older than the round-trip state', () => {
        vi.useFakeTimers();
        window.history.replaceState(null, '', '/a#first');
        generateAuthState();
        vi.advanceTimersByTime(5 * 60 * 1000 + 1);

        expect(takeAuthReturnHash()).toBeUndefined();
    });

    it('is remembered by the central auth redirect, which sends the return URL without it', () => {
        Env.init({
            name: 'test',
            version: '1',
            type: 'production',
            isLocalDev: false,
            isDocker: false,
            endpoints: { studio: 'https://api.test', zeno: 'https://api.test', sts: 'https://sts.test' },
        });
        const replace = vi.fn();
        vi.stubGlobal('location', {
            href: 'https://cloud.test/settings/projects/applications?p=1#mcp',
            hash: '#mcp',
            protocol: 'https:',
            replace,
        });
        window.AUTH_MODE = undefined;
        try {
            redirectToCentralAuth();

            const returnUrl = new URL(new URL(replace.mock.calls[0][0]).searchParams.get('redirect_uri') ?? '');
            expect(returnUrl.hash).toBe('');
            expect(takeAuthReturnHash()).toBe('mcp');
        } finally {
            vi.unstubAllGlobals();
        }
    });
});
