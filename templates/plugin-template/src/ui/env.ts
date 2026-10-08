import branding from 'virtual:vertesia-branding';
import { Env, isLoopbackHostname, normalizeHostname } from '@vertesia/ui/env';
import { requestIframeHostAuthToken } from '@vertesia/ui/shell';

import { appOAuthPermissions } from '../app-permissions.js';

const appTitle = branding.title ?? branding.name;

document.title = appTitle;

const localOrigin = isLoopbackHostname(normalizeHostname(window.location.hostname));
const oauthClientId = import.meta.env.VITE_OAUTH_CLIENT_ID?.trim();

export class LocalOAuthConfigurationError extends Error {
    constructor() {
        super(
            'Local sign-in requires a registered public OAuth client. ' +
                "Set VITE_OAUTH_CLIENT_ID and register this app's callback URL " +
                '(VITE_OAUTH_REDIRECT_URI) in Vertesia. ' +
                (import.meta.env.DEV
                    ? 'Update .env.app.local, then restart the dev server.'
                    : 'Set these build environment variables, then rebuild and redeploy the app.'),
        );
        this.name = 'LocalOAuthConfigurationError';
    }
}

export function validateLocalAuthConfiguration(): void {
    const runtime = window.__VERTESIA_RUNTIME_CONFIG__;
    const gatewaySession = runtime?.authMode === 'central' && runtime.gatewaySession;
    if (
        localOrigin &&
        window.parent === window &&
        !gatewaySession &&
        window.AUTH_MODE !== 'firebase' &&
        !Env.oauth &&
        !Env.devAuthToken &&
        typeof (globalThis as Record<string, unknown>).__VERTESIA_AUTH_TOKEN__ !== 'string'
    ) {
        throw new LocalOAuthConfigurationError();
    }
}

// Endpoints must be supplied by the build environment via VITE_VERTESIA_*_URL.
// The appgen live-preview/version-build pipeline injects these — see
// packages/workflows/src/tools/builtins/app_workspace/version-build-activities.ts
// and scripts/app-preview.sh. Falling back to hardcoded production URLs would
// silently route a dev/branch app at the wrong cluster (CORS or 401 in the
// browser); fail fast instead so misconfiguration is caught at bootstrap.
function requiredEnv(name: 'VITE_VERTESIA_STUDIO_URL' | 'VITE_VERTESIA_ZENO_URL' | 'VITE_VERTESIA_STS_URL'): string {
    const value = import.meta.env[name];
    if (!value) {
        throw new Error(
            `${name} is required at build time. ` +
                'For live preview and version builds this is set automatically by the appgen pipeline; ' +
                'for local builds, set it in .env.app or .env.app.local.',
        );
    }
    return value;
}

Env.init(
    {
        name: appTitle,
        version: '1.0.0',
        isLocalDev: true,
        isDocker: true,
        type: 'development',
        devAuthToken: import.meta.env.DEV ? import.meta.env.VITE_VERTESIA_AUTH_TOKEN?.trim() || undefined : undefined,
        endpoints: {
            studio: requiredEnv('VITE_VERTESIA_STUDIO_URL'),
            zeno: requiredEnv('VITE_VERTESIA_ZENO_URL'),
            sts: requiredEnv('VITE_VERTESIA_STS_URL'),
            auth: import.meta.env.VITE_AUTH_SERVER_URL?.trim() || undefined,
        },
        // Independent HTTPS hosts use CIMD; localhost uses an explicitly registered client.
        // Gateway and embedded sessions take precedence over this independent-host configuration.
        oauth:
            oauthClientId || (!localOrigin && import.meta.env.PROD && window.location.protocol === 'https:')
                ? {
                      clientId: oauthClientId || `${window.location.origin}/.well-known/oauth-client/vertesia-app`,
                      redirectUri:
                          import.meta.env.VITE_OAUTH_REDIRECT_URI?.trim() ||
                          `${window.location.origin}${import.meta.env.DEV ? '/' : '/app'}`,
                      ...appOAuthPermissions(import.meta.env.VITE_OAUTH_SCOPES),
                  }
                : undefined,
        authTokenProvider: requestIframeHostAuthToken,
    },
    import.meta.env,
);
