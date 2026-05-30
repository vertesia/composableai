import { Env } from '@vertesia/ui/env';

const CONFIG__PLUGIN_TITLE = 'Ui Plugin Template';

document.title = CONFIG__PLUGIN_TITLE;

// Endpoints must be supplied by the build environment via VITE_VERTESIA_*_URL.
// The appgen preview/publish pipeline injects these — see
// packages/workflows/src/tools/builtins/app_workspace/publish-activities.ts
// and scripts/app-preview.sh. Falling back to hardcoded production URLs would
// silently route a dev/branch app at the wrong cluster (CORS or 401 in the
// browser); fail fast instead so misconfiguration is caught at bootstrap.
function requiredEnv(name: 'VITE_VERTESIA_STUDIO_URL' | 'VITE_VERTESIA_ZENO_URL' | 'VITE_VERTESIA_STS_URL'): string {
    const value = import.meta.env[name];
    if (!value) {
        throw new Error(
            `${name} is required at build time. ` +
                'For dev preview / publish this is set automatically by the appgen pipeline; ' +
                'for local builds, set it in .env.app or .env.app.local.',
        );
    }
    return value;
}

Env.init({
    name: CONFIG__PLUGIN_TITLE,
    version: '1.0.0',
    isLocalDev: true,
    isDocker: true,
    type: 'development',
    endpoints: {
        studio: requiredEnv('VITE_VERTESIA_STUDIO_URL'),
        zeno: requiredEnv('VITE_VERTESIA_ZENO_URL'),
        sts: requiredEnv('VITE_VERTESIA_STS_URL'),
    },
});
