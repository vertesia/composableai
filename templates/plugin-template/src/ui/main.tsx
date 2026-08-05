import { StandaloneApp, VertesiaShell } from '@vertesia/ui/shell';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './i18n'; // register plugin-specific translations
import './index.css';
// initialize dev environment
import { AdminApp } from '@vertesia/tools-admin-ui';
import { type Route, RouterProvider } from '@vertesia/ui/router';
import { App } from './app/App';
import { setUsePluginAssets } from './assets';
import './env';
import { OrgGate } from './app/layouts/OrgGate';
import { PluginAccessDenied } from './app/layouts/PluginAccessDenied';
import { PluginLayout } from './app/layouts/PluginLayout';

setUsePluginAssets(false);

const appName = import.meta.env.VITE_APP_NAME;

const routes: Route[] = [
    { path: '*', Component: () => <AdminApp /> },
    {
        path: 'app/*',
        Component: () => (
            <StandaloneApp name={appName} AccessDenied={PluginAccessDenied}>
                <PluginLayout>
                    <App />
                </PluginLayout>
            </StandaloneApp>
        ),
    },
];

const rootElement = document.getElementById('root');
if (!rootElement) {
    throw new Error('Root element not found');
}

createRoot(rootElement).render(
    <StrictMode>
        {/*
          preserveSignInPath keeps deep links working: without it the sign-in screen resets the
          URL to "/" while the session boots, so /app/<route> — and the ?a=/?p= and #token= the
          Central Auth handoff arrives with — are lost before the router ever sees them.
        */}
        <VertesiaShell preserveSignInPath>
            <OrgGate>
                <RouterProvider routes={routes} />
            </OrgGate>
        </VertesiaShell>
    </StrictMode>,
);
