import { I18nProvider } from '@vertesia/ui/i18n'
import { StandaloneApp, VertesiaShell } from '@vertesia/ui/shell'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './i18n'; // register plugin-specific translations
import './index.css'
// initialize dev environment
import { AdminApp } from '@vertesia/tools-admin-ui'
import { RouterProvider, type Route } from '@vertesia/ui/router'
import { App } from './app'
import { setUsePluginAssets } from './assets'
import "./env"
import { OrgGate } from './OrgGate'
import { PluginAccessDenied } from './PluginAccessDenied'
import { PluginLayout } from './PluginLayout'

setUsePluginAssets(false);

const appName = import.meta.env.VITE_APP_NAME;

const routes: Route[] = [
    { path: "*", Component: () => <AdminApp /> },
    {
        path: "app/*", Component: () => (
            <StandaloneApp name={appName} AccessDenied={PluginAccessDenied}>
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
