import { type Route, RouterProvider } from '@vertesia/ui/router';
import { useUserSession } from '@vertesia/ui/session';
import { IFRAME_APP_CONTENT_SLOT, IFRAME_APP_SLOT_PARAM, StandaloneApp, VertesiaShell } from '@vertesia/ui/shell';
import type { ReactNode } from 'react';
import { setUsePluginAssets } from '../../../ui/assets';
import { App } from '../../../ui/shell/App';
import { OrgGate } from '../../../ui/shell/layouts/OrgGate';
import { PluginAccessDenied } from '../../../ui/shell/layouts/PluginAccessDenied';
import { PluginLayout } from '../../../ui/shell/layouts/PluginLayout';

setUsePluginAssets(false);

const appName = import.meta.env.VITE_APP_NAME;
const appVersion = import.meta.env.VITE_APP_VERSION;
const globalValues = globalThis as Record<string, unknown>;
const injectedAuthToken =
    typeof globalValues.__VERTESIA_AUTH_TOKEN__ === 'string' ? globalValues.__VERTESIA_AUTH_TOKEN__ : undefined;
const devAuthToken = import.meta.env.DEV ? import.meta.env.VITE_VERTESIA_AUTH_TOKEN : undefined;
// Candidate validation injects a short-lived token before the application bundle loads. Prefer it
// over a build-time development token so reloads and deployed Playwright runs use the current run.
const runtimeAuthToken = injectedAuthToken ?? devAuthToken;
const isCompositeContent =
    new URLSearchParams(window.location.search).get(IFRAME_APP_SLOT_PARAM) === IFRAME_APP_CONTENT_SLOT;

const AppRoot = () =>
    isCompositeContent ? (
        <div className="h-dvh min-h-0 overflow-hidden">
            <App />
        </div>
    ) : (
        <PluginLayout>
            <App />
        </PluginLayout>
    );

const ProtectedAppRoot = () => (
    <StandaloneApp name={appName} AccessDenied={PluginAccessDenied}>
        <AppRoot />
    </StandaloneApp>
);

const GatewayAppRoot = runtimeAuthToken ? AppRoot : ProtectedAppRoot;

const routes: Route[] = [
    { path: 'tenants/:tenantId/live/:agentRunId/app/*', Component: GatewayAppRoot },
    { path: 'tenants/:tenantId/apps/:appId/app/*', Component: GatewayAppRoot },
    { path: 'tenants/:tenantId/apps/:appId/versions/:versionId/app/*', Component: GatewayAppRoot },
    { path: 'app/*', Component: GatewayAppRoot },
    { path: '*', Component: GatewayAppRoot },
];

function AppVersionScope({ children }: { children: ReactNode }) {
    const { client } = useUserSession();

    // withAppVersion synchronously pins both Studio and Store clients. Do this before returning
    // request-producing descendants; a passive effect lets their first requests escape unpinned.
    if (appVersion) client.withAppVersion(appVersion);

    return <>{children}</>;
}

export function AppEntry() {
    return (
        <VertesiaShell authToken={runtimeAuthToken}>
            <AppVersionScope>
                <OrgGate>
                    <RouterProvider routes={routes} />
                </OrgGate>
            </AppVersionScope>
        </VertesiaShell>
    );
}
