import { ThemeProvider, ToastProvider } from '@vertesia/ui/core';
import { TypeRegistryProvider, UserPermissionProvider } from '@vertesia/ui/features';
import { I18nProvider } from '@vertesia/ui/i18n';
import { type Route, RouterProvider } from '@vertesia/ui/router';
import { useUserSession } from '@vertesia/ui/session';
import { StandaloneApp, VertesiaShell } from '@vertesia/ui/shell';
import { type ReactNode, useEffect } from 'react';
import { App } from './app/App';
import { OrgGate } from './app/layouts/OrgGate';
import { PluginAccessDenied } from './app/layouts/PluginAccessDenied';
import { PluginLayout } from './app/layouts/PluginLayout';
import { setUsePluginAssets } from './assets';
import { DevSessionProvider } from './DevSessionProvider';

setUsePluginAssets(false);

const appName = import.meta.env.VITE_APP_NAME;
const appVersion = import.meta.env.VITE_APP_VERSION;
const devAuthToken = import.meta.env.DEV ? import.meta.env.VITE_VERTESIA_AUTH_TOKEN : undefined;
const browserAuthToken = (globalThis as { __VERTESIA_AUTH_TOKEN__?: string }).__VERTESIA_AUTH_TOKEN__;
const appAuthToken = devAuthToken ?? browserAuthToken;

const AppRoot = () => (
    <PluginLayout>
        <App />
    </PluginLayout>
);

const ProtectedAppRoot = () => (
    <StandaloneApp name={appName} AccessDenied={PluginAccessDenied}>
        <AppRoot />
    </StandaloneApp>
);

const routes: Route[] = [
    { path: 'tenants/:tenantId/live/:agentRunId/app/*', Component: appAuthToken ? AppRoot : ProtectedAppRoot },
    { path: 'tenants/:tenantId/apps/:appId/app/*', Component: appAuthToken ? AppRoot : ProtectedAppRoot },
    {
        path: 'tenants/:tenantId/apps/:appId/versions/:versionId/app/*',
        Component: appAuthToken ? AppRoot : ProtectedAppRoot,
    },
    { path: 'app/*', Component: appAuthToken ? AppRoot : ProtectedAppRoot },
    { path: '*', Component: appAuthToken ? AppRoot : ProtectedAppRoot },
];

function DevShell({ children, token }: { children: ReactNode; token: string }) {
    return (
        <ToastProvider>
            <DevSessionProvider token={token}>
                <TypeRegistryProvider>
                    <ThemeProvider defaultTheme="system" storageKey="vite-ui-theme">
                        <UserPermissionProvider>{children}</UserPermissionProvider>
                    </ThemeProvider>
                </TypeRegistryProvider>
            </DevSessionProvider>
        </ToastProvider>
    );
}

function AppVersionScope({ children }: { children: ReactNode }) {
    const { client, store } = useUserSession();

    useEffect(() => {
        client.withAppVersion(appVersion);
        store.withAppVersion(appVersion);
    }, [client, store]);

    return <>{children}</>;
}

const routedApp = (
    <AppVersionScope>
        <OrgGate>
            <RouterProvider routes={routes} />
        </OrgGate>
    </AppVersionScope>
);

export function AppEntry() {
    return (
        <I18nProvider>
            {appAuthToken ? (
                <DevShell token={appAuthToken}>{routedApp}</DevShell>
            ) : (
                <VertesiaShell>{routedApp}</VertesiaShell>
            )}
        </I18nProvider>
    );
}
