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

function resolveApiBaseUrl() {
    const configured = import.meta.env.VITE_APP_API_BASE_URL ?? import.meta.env.VITE_APP_API_BASE;
    if (configured) return configured.replace(/\/+$/, '');

    const parts = window.location.pathname.split('/').filter(Boolean);
    if (parts[0] === 'live' && parts[1]) {
        return `/live/${parts[1]}/api`;
    }
    if (parts[0] === 'tenants' && parts[2] === 'apps' && parts[4] === 'versions' && parts[5]) {
        return `/${parts.slice(0, 6).join('/')}/api`;
    }
    return '/api';
}

const apiBaseUrl = resolveApiBaseUrl();

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
    { path: "*", Component: () => <AdminApp baseUrl={apiBaseUrl} /> },
    { path: "app/*", Component: () => <AppRoute enforceInstallation={!devAuthToken} /> },
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
