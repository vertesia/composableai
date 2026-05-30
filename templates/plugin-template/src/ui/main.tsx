import { StandaloneApp, VertesiaShell } from '@vertesia/ui/shell';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './i18n'; // register plugin-specific translations
import './index.css';
// initialize dev environment
import { RouterProvider, type Route } from '@vertesia/ui/router';
import { App } from './app/App';
import { setUsePluginAssets } from './assets';
import './env';
import { OrgGate } from './app/layouts/OrgGate';
import { PluginAccessDenied } from './app/layouts/PluginAccessDenied';
import { PluginLayout } from './app/layouts/PluginLayout';

setUsePluginAssets(false);

const appName = import.meta.env.VITE_APP_NAME;

function renderPluginApp() {
    return (
        <StandaloneApp name={appName} AccessDenied={PluginAccessDenied}>
            <PluginLayout>
                <App />
            </PluginLayout>
        </StandaloneApp>
    );
}

const routes: Route[] = [
    { path: 'app/*', Component: renderPluginApp },
    { path: '*', Component: renderPluginApp },
];

const rootElement = document.getElementById('root');
if (!rootElement) {
    throw new Error('Root element not found');
}

createRoot(rootElement).render(
    <StrictMode>
        <VertesiaShell>
            <OrgGate>
                <RouterProvider routes={routes} />
            </OrgGate>
        </VertesiaShell>
    </StrictMode>,
);
