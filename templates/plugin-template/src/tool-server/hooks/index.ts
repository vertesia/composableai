import type { AppLifecycleHooks } from '@vertesia/tools-sdk';

// Import hook implementations when the app provides them:
// import { install } from './install.js';
// import { uninstall } from './uninstall.js';

/**
 * Register optional application lifecycle hooks here. Hook implementations should live beside this file,
 * for example `./install.ts` and `./uninstall.ts`.
 */
export const hooks = {
    // install,
    // uninstall,
} satisfies AppLifecycleHooks;
