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

setUsePluginAssets(false);

const routes: Route[] = [
    { path: "*", Component: AdminApp },
    { path: "app/*", Component: AppWrapper },
]

function AppWrapper() {
    return (
        <StandaloneApp name={import.meta.env.VITE_APP_NAME}> {/* <---- define VITE_APP_NAME en var in .env.local */}
            <App />
        </StandaloneApp>
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
