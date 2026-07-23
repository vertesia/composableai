import { AdminApp } from '@vertesia/tools-admin-ui';
import { type Route, RouterProvider } from '@vertesia/ui/router';
import { StandaloneApp, VertesiaShell } from '@vertesia/ui/shell';
import { setUsePluginAssets } from '../assets';
import { App } from './App';
import { OrgGate } from './layouts/OrgGate';
import { PluginAccessDenied } from './layouts/PluginAccessDenied';
import { PluginLayout } from './layouts/PluginLayout';

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
        <VertesiaShell preserveSignInPath>
            <OrgGate>
                <RouterProvider routes={routes} />
            </OrgGate>
        </VertesiaShell>
    );
}
