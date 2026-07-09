import { AdminApp } from '@vertesia/tools-admin-ui';
import { type Route, RouterProvider } from '@vertesia/ui/router';
import { StandaloneApp, VertesiaShell } from '@vertesia/ui/shell';
import { App } from './app/App';
import { OrgGate } from './app/layouts/OrgGate';
import { PluginAccessDenied } from './app/layouts/PluginAccessDenied';
import { PluginLayout } from './app/layouts/PluginLayout';
import { setUsePluginAssets } from './assets';

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

export function AppEntry() {
    return (
        <VertesiaShell>
            <OrgGate>
                <RouterProvider routes={routes} />
            </OrgGate>
        </VertesiaShell>
    );
}
