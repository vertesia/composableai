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
