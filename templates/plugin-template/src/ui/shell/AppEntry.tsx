import branding from 'virtual:vertesia-branding';
import { AdminApp } from '@vertesia/tools-admin-ui';
import { type Route, RouterProvider } from '@vertesia/ui/router';
import { IFRAME_APP_CONTENT_SLOT, IFRAME_APP_SLOT_PARAM, StandaloneApp, VertesiaShell } from '@vertesia/ui/shell';
import { useEffect, useState } from 'react';
import { appAuthScreens } from '../../modules/app/branding/screens';
import { setUsePluginAssets } from '../assets';
import { App } from './App';
import { OrgGate } from './layouts/OrgGate';
import { PluginAccessDenied } from './layouts/PluginAccessDenied';
import { PluginLayout } from './layouts/PluginLayout';

setUsePluginAssets(false);

declare global {
    interface Window {
        /** Display-only session supplied by an isolated host; API authorization stays in the host. */
        __VERTESIA_SANDBOX_TOKEN__?: string;
        __VERTESIA_SANDBOX_READY__?: Promise<string>;
    }
}

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
    const [hostToken, setHostToken] = useState(window.__VERTESIA_SANDBOX_TOKEN__);
    useEffect(() => {
        let mounted = true;
        void window.__VERTESIA_SANDBOX_READY__?.then((token) => {
            if (mounted) setHostToken(token);
        });
        return () => {
            mounted = false;
        };
    }, []);
    if (window.__VERTESIA_SANDBOX_READY__ && !hostToken) return null;
    return (
        <VertesiaShell branding={branding} preserveSignInPath authScreens={appAuthScreens} authToken={hostToken}>
            <OrgGate>
                <RouterProvider routes={routes} />
            </OrgGate>
        </VertesiaShell>
    );
}
