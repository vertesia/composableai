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

setUsePluginAssets(false);

const routes: Route[] = [
    { path: "*", Component: AdminAppPage },
    { path: "app/*", Component: AppPage },
]

function AdminAppPage() {
    return <AdminApp />
}

function AppPage() {
    return (
        <PluginLayout>
            <StandaloneApp name={import.meta.env.VITE_APP_NAME}> {/* <---- define VITE_APP_NAME en var in .env.local */}
                <App />
            </StandaloneApp>
        </PluginLayout>
    )
}

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <VertesiaShell>
            <OrgGate>
                <RouterProvider routes={routes} />
            </OrgGate>
        </VertesiaShell>
    </StrictMode>,
)
