import { afterEach, describe, expect, it, vi } from 'vitest';
import { type EnvProps, VertesiaEnvironment, type VertesiaRuntimeConfig } from './index';

const baseProps: EnvProps = {
    name: 'test-app',
    version: '1.0.0',
    isLocalDev: false,
    isDocker: false,
    type: 'production',
    endpoints: {
        studio: 'https://api.us1.vertesia.io',
        zeno: 'https://api.us1.vertesia.io',
        sts: 'https://sts.us1.vertesia.io',
    },
};

describe('VertesiaEnvironment runtime configuration', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('uses complete gateway-injected Firebase configuration as an initialization fallback', () => {
        const firebase = {
            apiKey: 'firebase-key',
            authDomain: 'apps.us1.vertesia.io',
            projectId: 'dengenlabs',
            appId: 'firebase-app-id',
        };
        vi.stubGlobal('window', {
            __VERTESIA_RUNTIME_CONFIG__: { authMode: 'firebase', firebase },
        });

        const env = new VertesiaEnvironment().init(baseProps);

        expect(env.firebase).toEqual(firebase);
        expect(window.AUTH_MODE).toBe('firebase');
    });

    it('preserves explicit app configuration and auth mode', () => {
        const explicitFirebase = {
            apiKey: 'explicit-key',
            authDomain: 'explicit.example.com',
            projectId: 'explicit-project',
            appId: 'explicit-app-id',
        };
        vi.stubGlobal('window', {
            AUTH_MODE: 'central',
            __VERTESIA_RUNTIME_CONFIG__: {
                authMode: 'firebase',
                firebase: {
                    apiKey: 'runtime-key',
                    authDomain: 'apps.us1.vertesia.io',
                    projectId: 'dengenlabs',
                    appId: 'runtime-app-id',
                },
            },
        });

        const env = new VertesiaEnvironment().init({ ...baseProps, firebase: explicitFirebase });

        expect(env.firebase).toEqual(explicitFirebase);
        expect(window.AUTH_MODE).toBe('central');
    });

    it('ignores incomplete injected Firebase configuration', () => {
        vi.stubGlobal('window', {
            __VERTESIA_RUNTIME_CONFIG__: {
                authMode: 'firebase',
                firebase: {
                    apiKey: 'firebase-key',
                    authDomain: 'apps.us1.vertesia.io',
                    projectId: 'dengenlabs',
                    appId: '',
                },
            } satisfies VertesiaRuntimeConfig,
        });

        const env = new VertesiaEnvironment().init(baseProps);

        expect(env.firebase).toBeUndefined();
        expect(window.AUTH_MODE).toBeUndefined();
    });

    it('accepts injected Central Auth mode without Firebase configuration', () => {
        vi.stubGlobal('window', {
            __VERTESIA_RUNTIME_CONFIG__: { authMode: 'central' },
        });

        const env = new VertesiaEnvironment().init(baseProps);

        expect(env.firebase).toBeUndefined();
        expect(window.AUTH_MODE).toBe('central');
    });
});

describe('VertesiaEnvironment build configuration', () => {
    const buildEnv = {
        VITE_FIREBASE_API_KEY: 'build-key',
        VITE_FIREBASE_AUTH_DOMAIN: 'project.firebaseapp.com',
        VITE_FIREBASE_PROJECT_ID: 'project',
        VITE_FIREBASE_APP_ID: 'build-app',
    };

    afterEach(() => vi.unstubAllGlobals());

    it('enables Firebase from complete build settings without requiring an explicit mode', () => {
        vi.stubGlobal('window', {});
        const env = new VertesiaEnvironment().init(baseProps, buildEnv);
        expect(env.firebase?.apiKey).toBe('build-key');
        expect(env.firebase?.authDomain).toBe('project.firebaseapp.com');
        expect(window.AUTH_MODE).toBe('firebase');
    });

    it('allows explicit central mode even with Firebase build settings', () => {
        vi.stubGlobal('window', {});
        const env = new VertesiaEnvironment().init(baseProps, { ...buildEnv, VITE_AUTH_MODE: 'central' });
        expect(env.firebase).toBeUndefined();
        expect(window.AUTH_MODE).toBe('central');
    });

    it.each(['firebase', ''])('rejects incomplete Firebase settings in mode %s', (mode) => {
        vi.stubGlobal('window', {});
        expect(() =>
            new VertesiaEnvironment().init(baseProps, {
                VITE_AUTH_MODE: mode,
                VITE_FIREBASE_API_KEY: 'key',
            }),
        ).toThrow('VITE_FIREBASE_AUTH_DOMAIN, VITE_FIREBASE_PROJECT_ID, VITE_FIREBASE_APP_ID');
    });

    it('rejects an unknown mode', () => {
        vi.stubGlobal('window', {});
        expect(() => new VertesiaEnvironment().init(baseProps, { VITE_AUTH_MODE: 'typo' })).toThrow(
            'VITE_AUTH_MODE must be firebase or central',
        );
    });

    it('preserves gateway Firebase configuration ahead of conflicting build settings', () => {
        const firebase = {
            apiKey: 'runtime-key',
            authDomain: 'gateway.example.com',
            projectId: 'runtime',
            appId: 'runtime-app',
        };
        vi.stubGlobal('window', { __VERTESIA_RUNTIME_CONFIG__: { authMode: 'firebase', firebase } });
        const env = new VertesiaEnvironment().init(baseProps, { VITE_AUTH_MODE: 'central' });
        expect(env.firebase).toEqual(firebase);
        expect(window.AUTH_MODE).toBe('firebase');
    });

    it('preserves gateway central mode ahead of Firebase build settings', () => {
        vi.stubGlobal('window', { __VERTESIA_RUNTIME_CONFIG__: { authMode: 'central' } });
        const env = new VertesiaEnvironment().init(baseProps, buildEnv);
        expect(env.firebase).toBeUndefined();
        expect(window.AUTH_MODE).toBe('central');
    });

    it('leaves the existing central default unchanged without settings', () => {
        vi.stubGlobal('window', {});
        const env = new VertesiaEnvironment().init(baseProps, {});
        expect(env.firebase).toBeUndefined();
        expect(window.AUTH_MODE).toBeUndefined();
    });
});

describe('build-time default workspace', () => {
    it('reads and trims Vertesia IDs independently of the Firebase project', () => {
        const env = new VertesiaEnvironment().init(baseProps, {
            VITE_VERTESIA_ACCOUNT_ID: ' account-1 ',
            VITE_VERTESIA_PROJECT_ID: ' project-1 ',
        });
        expect(env.defaultAuthSelection).toEqual({ accountId: 'account-1', projectId: 'project-1' });
    });
    it('ignores blank settings and preserves an explicit selection as a whole pair', () => {
        expect(
            new VertesiaEnvironment().init(baseProps, { VITE_VERTESIA_ACCOUNT_ID: ' ' }).defaultAuthSelection,
        ).toBeUndefined();
        const env = new VertesiaEnvironment().init(
            { ...baseProps, defaultAuthSelection: { accountId: 'explicit' } },
            { VITE_VERTESIA_ACCOUNT_ID: 'build', VITE_VERTESIA_PROJECT_ID: 'other-project' },
        );
        expect(env.defaultAuthSelection).toEqual({ accountId: 'explicit' });
    });
});
