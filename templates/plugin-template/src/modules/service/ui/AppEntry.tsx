import branding from 'virtual:vertesia-branding';
import { type Route, RouterProvider } from '@vertesia/ui/router';
import { useUserSession } from '@vertesia/ui/session';
import { IFRAME_APP_CONTENT_SLOT, IFRAME_APP_SLOT_PARAM, StandaloneApp, VertesiaShell } from '@vertesia/ui/shell';
import { type ReactNode, useEffect, useState } from 'react';
import { setUsePluginAssets } from '../../../ui/assets';
import { App } from '../../../ui/shell/App';
import { OrgGate } from '../../../ui/shell/layouts/OrgGate';
import { PluginAccessDenied } from '../../../ui/shell/layouts/PluginAccessDenied';
import { PluginLayout } from '../../../ui/shell/layouts/PluginLayout';
import { appAuthScreens } from '../../app/branding/screens';

setUsePluginAssets(false);

const appName = import.meta.env.VITE_APP_NAME;
const appVersion = import.meta.env.VITE_APP_VERSION;
declare global {
    interface Window {
        /** Display-only session; the gateway retains API authorization. */
        __VERTESIA_SANDBOX_TOKEN__?: string;
        __VERTESIA_SANDBOX_READY__?: Promise<string>;
    }
}

const isCompositeContent =
    new URLSearchParams(window.location.search).get(IFRAME_APP_SLOT_PARAM) === IFRAME_APP_CONTENT_SLOT;

const AppRoot = () =>
    isCompositeContent ? (
        <div className="h-dvh min-h-0 overflow-hidden">
            <App />
        </div>
    ) : (
        <PluginLayout>
            <App />
        </PluginLayout>
    );

const ProtectedAppRoot = () => (
    <StandaloneApp name={appName} AccessDenied={PluginAccessDenied}>
        <AppRoot />
    </StandaloneApp>
);

function AppVersionScope({ children }: { children: ReactNode }) {
    const { client } = useUserSession();

    // withAppVersion synchronously pins both Studio and Store clients. Do this before returning
    // request-producing descendants; a passive effect lets their first requests escape unpinned.
    if (appVersion) client.withAppVersion(appVersion);

    return <>{children}</>;
}

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

    const GatewayAppRoot = hostToken ? AppRoot : ProtectedAppRoot;

    const routes: Route[] = [
        { path: 'tenants/:tenantId/live/:agentRunId/app/*', Component: GatewayAppRoot },
        { path: 'tenants/:tenantId/apps/:appId/app/*', Component: GatewayAppRoot },
        { path: 'tenants/:tenantId/apps/:appId/versions/:versionId/app/*', Component: GatewayAppRoot },
        { path: 'app/*', Component: GatewayAppRoot },
        { path: '*', Component: GatewayAppRoot },
    ];

    return (
        <VertesiaShell branding={branding} preserveSignInPath authToken={hostToken} authScreens={appAuthScreens}>
            <AppVersionScope>
                <OrgGate>
                    <RouterProvider routes={routes} />
                </OrgGate>
            </AppVersionScope>
        </VertesiaShell>
    );
}
