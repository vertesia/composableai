import { useUserSession } from '@vertesia/ui/session';
import type { ReactNode } from 'react';

function runtimeAppVersionSelector(): string | undefined {
    const runtimeConfig = (
        globalThis as {
            __VERTESIA_RUNTIME_CONFIG__?: { appVersionSelector?: unknown };
        }
    ).__VERTESIA_RUNTIME_CONFIG__;
    return typeof runtimeConfig?.appVersionSelector === 'string' && runtimeConfig.appVersionSelector
        ? runtimeConfig.appVersionSelector
        : undefined;
}

// App Gateway injects a vlaunch selector for an advanced launch. It must override the immutable
// build version so every Studio/Store request reaches the temporary launch context. Ordinary app
// loads have no runtime selector and continue to use the version compiled into the bundle.
const appVersionSelector = runtimeAppVersionSelector() ?? import.meta.env.VITE_APP_VERSION;

export function AppVersionScope({ children }: { children: ReactNode }) {
    const { client } = useUserSession();

    // withAppVersion synchronously pins both Studio and Store clients. Do this before returning
    // request-producing descendants; a passive effect lets their first requests escape unpinned.
    if (appVersionSelector) client.withAppVersion(appVersionSelector);

    return <>{children}</>;
}
