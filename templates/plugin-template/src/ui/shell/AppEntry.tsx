import { AdminApp } from '@vertesia/tools-admin-ui';
import { type Route, RouterProvider } from '@vertesia/ui/router';
import { IFRAME_APP_CONTENT_SLOT, IFRAME_APP_SLOT_PARAM, StandaloneApp, VertesiaShell } from '@vertesia/ui/shell';
import { setUsePluginAssets } from '../assets';
import { App } from './App';
import { OrgGate } from './layouts/OrgGate';
import { PluginAccessDenied } from './layouts/PluginAccessDenied';
import { PluginLayout } from './layouts/PluginLayout';

setUsePluginAssets(false);

const appName = import.meta.env.VITE_APP_NAME;
const isCompositeContent =
    new URLSearchParams(window.location.search).get(IFRAME_APP_SLOT_PARAM) === IFRAME_APP_CONTENT_SLOT;

const routes: Route[] = [
    { path: '*', Component: () => <AdminApp /> },
    {
        path: 'app/*',
        Component: () => (
            <StandaloneApp name={appName} AccessDenied={PluginAccessDenied}>
                {isCompositeContent ? (
                    <div className="h-dvh min-h-0 overflow-hidden">
                        <App />
                    </div>
                ) : (
                    <PluginLayout>
                        <App />
                    </PluginLayout>
                )}
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
