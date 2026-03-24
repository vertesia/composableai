import { I18nProvider } from '@vertesia/ui/i18n'
import './i18n' // register plugin-specific translations
import { StandaloneApp, VertesiaShell } from '@vertesia/ui/shell'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
// initialize dev environment
import { RouterProvider, type Route } from '@vertesia/ui/router'
import { App } from './app'
import "./env"
import { setUsePluginAssets } from './assets'
import { AdminApp } from '@vertesia/tools-admin-ui'
import { OrgGate } from './OrgGate'
import { PluginLayout } from './PluginLayout'
import { PluginAccessDenied } from './PluginAccessDenied'

setUsePluginAssets(false);

const routes: Route[] = [
    { path: "*", Component: () => <AdminApp /> },
    {
        path: "app/*", Component: () => (
            // define VITE_APP_NAME as env var in .env.local
            <StandaloneApp name={import.meta.env.VITE_APP_NAME} AccessDenied={PluginAccessDenied}>
                <PluginLayout>
                    <App />
                </PluginLayout>
            </StandaloneApp>
        )
    },
]

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <I18nProvider>
            <VertesiaShell>
                <OrgGate>
                    <RouterProvider routes={routes} />
                </OrgGate>
            </VertesiaShell>
        </I18nProvider>
    </StrictMode>,
)
