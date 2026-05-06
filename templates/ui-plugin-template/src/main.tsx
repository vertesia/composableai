import { ThemeProvider, ToastProvider } from '@vertesia/ui/core'
import { TypeRegistryProvider, UserPermissionProvider } from '@vertesia/ui/features'
import { I18nProvider } from '@vertesia/ui/i18n'
import { SigninScreen, StandaloneApp, VertesiaShell } from '@vertesia/ui/shell'
import { StrictMode } from 'react'
import type { ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
// initialize dev environment
import { RouterProvider } from '@vertesia/ui/router'
import { App } from './app'
import { DevSessionProvider } from './DevSessionProvider'
import "./env"
import { setUsePluginAssets } from './assets'

setUsePluginAssets(false);

const appName = import.meta.env.VITE_APP_NAME
const devAuthToken = import.meta.env.DEV ? import.meta.env.VITE_VERTESIA_AUTH_TOKEN : undefined
const appContent = <RouterProvider routes={[{ path: "*", Component: App }]} />

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
    )
}

const shell = devAuthToken ? (
    <DevShell token={devAuthToken}>
        {appContent}
    </DevShell>
) : (
    <VertesiaShell>
        <StandaloneApp name={appName}>
            {appContent}
        </StandaloneApp>
    </VertesiaShell>
)

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <I18nProvider>
            {shell}
        </I18nProvider>
    </StrictMode>,
)
