import { ThemeProvider, ToastProvider } from '@vertesia/ui/core'
import { TypeRegistryProvider, UserPermissionProvider } from '@vertesia/ui/features'
import { I18nProvider } from '@vertesia/ui/i18n'
import { SigninScreen, StandaloneApp, VertesiaShell } from '@vertesia/ui/shell'
import { StrictMode } from 'react'
import type { ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import './i18n'; // register plugin-specific translations
import './index.css'
// initialize dev environment
import { AdminApp } from '@vertesia/tools-admin-ui'
import { RouterProvider, type Route } from '@vertesia/ui/router'
import { resolveAppApiBaseUrl } from './api-base'
import { App } from './app'
import { setUsePluginAssets } from './assets'
import { DevSessionProvider } from './DevSessionProvider'
import "./env"
import { OrgGate } from './OrgGate'
import { PluginAccessDenied } from './PluginAccessDenied'
import { PluginLayout } from './PluginLayout'

setUsePluginAssets(false);

const appName = import.meta.env.VITE_APP_NAME;
const devAuthToken = import.meta.env.DEV ? import.meta.env.VITE_VERTESIA_AUTH_TOKEN : undefined;
const apiBaseUrl = resolveAppApiBaseUrl();

function AppRoute({ enforceInstallation }: { enforceInstallation: boolean }) {
    const content = (
        <PluginLayout>
            <App />
        </PluginLayout>
    );

    return enforceInstallation ? (
        <StandaloneApp name={appName} AccessDenied={PluginAccessDenied}>
            {content}
        </StandaloneApp>
    ) : content;
}

const routes: Route[] = [
    { path: "tenants/:tenantId/live/:agentRunId/app/*", Component: () => <AppRoute enforceInstallation={!devAuthToken} /> },
    { path: "live/:agentRunId/app/*", Component: () => <AppRoute enforceInstallation={!devAuthToken} /> },
    { path: "tenants/:tenantId/apps/:appId/versions/:versionId/app/*", Component: () => <AppRoute enforceInstallation={!devAuthToken} /> },
    // Tool-server admin (tools / skills / interactions / types / templates / dashboards) at /tools/*.
    { path: "tools/*", Component: () => <AdminApp baseUrl={apiBaseUrl} /> },
    // Plugin UI is the default — `/`, `/app/*`, and any other path.
    { path: "app/*", Component: () => <AppRoute enforceInstallation={!devAuthToken} /> },
    { path: "*", Component: () => <AppRoute enforceInstallation={!devAuthToken} /> },
]

function DevShell({ children, token }: { children: ReactNode; token: string }) {
    return (
        <ToastProvider>
            <DevSessionProvider token={token}>
                <TypeRegistryProvider>
                    <ThemeProvider defaultTheme="system" storageKey="vite-ui-theme">
                        <SigninScreen allowedPrefix="/shared/" />
                        <UserPermissionProvider>
                            {children}
                        </UserPermissionProvider>
                    </ThemeProvider>
                </TypeRegistryProvider>
            </DevSessionProvider>
        </ToastProvider>
    );
}

const shell = devAuthToken ? (
    <DevShell token={devAuthToken}>
        <OrgGate>
            <RouterProvider routes={routes} />
        </OrgGate>
    </DevShell>
) : (
    <VertesiaShell>
        <OrgGate>
            <RouterProvider routes={routes} />
        </OrgGate>
    </VertesiaShell>
);

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <I18nProvider>
            {shell}
        </I18nProvider>
    </StrictMode>,
)
