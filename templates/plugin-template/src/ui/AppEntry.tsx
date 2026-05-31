import { ToastProvider, ThemeProvider } from '@vertesia/ui/core';
import { TypeRegistryProvider, UserPermissionProvider } from '@vertesia/ui/features';
import { I18nProvider } from '@vertesia/ui/i18n';
import { RouterProvider, type Route } from '@vertesia/ui/router';
import { StandaloneApp, VertesiaShell } from '@vertesia/ui/shell';
import type { ReactNode } from 'react';
import { App } from './app/App';
import { OrgGate } from './app/layouts/OrgGate';
import { PluginAccessDenied } from './app/layouts/PluginAccessDenied';
import { PluginLayout } from './app/layouts/PluginLayout';
import { DevSessionProvider } from './DevSessionProvider';
import { setUsePluginAssets } from './assets';

setUsePluginAssets(false);

const appName = import.meta.env.VITE_APP_NAME;
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

const routedApp = (
    <OrgGate>
        <RouterProvider routes={routes} />
    </OrgGate>
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
