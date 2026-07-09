import { type Route, RouterProvider } from '@vertesia/ui/router';
import { useUserSession } from '@vertesia/ui/session';
import { StandaloneApp, VertesiaShell } from '@vertesia/ui/shell';
import { type ReactNode, useEffect } from 'react';
import { App } from '../../../ui/app/App';
import { OrgGate } from '../../../ui/app/layouts/OrgGate';
import { PluginAccessDenied } from '../../../ui/app/layouts/PluginAccessDenied';
import { PluginLayout } from '../../../ui/app/layouts/PluginLayout';
import { setUsePluginAssets } from '../../../ui/assets';

setUsePluginAssets(false);

const appName = import.meta.env.VITE_APP_NAME;
const appVersion = import.meta.env.VITE_APP_VERSION;
const devAuthToken = import.meta.env.DEV ? import.meta.env.VITE_VERTESIA_AUTH_TOKEN : undefined;
const browserAuthToken = (globalThis as { __VERTESIA_AUTH_TOKEN__?: string }).__VERTESIA_AUTH_TOKEN__;
const appAuthToken = devAuthToken ?? browserAuthToken;

// TODO(feat-appgen merge): remove this shim once client/store types include `withAppVersion`.
type VersionedApi = {
    withAppVersion?: (version: string) => void;
};

const AppRoot = () => (
    <PluginLayout>
        <App />
    </PluginLayout>
);

const ProtectedAppRoot = () => (
    <StandaloneApp name={appName} AccessDenied={PluginAccessDenied}>
        <AppRoot />
    </StandaloneApp>
);

const GatewayAppRoot = appAuthToken ? AppRoot : ProtectedAppRoot;

const routes: Route[] = [
    { path: 'tenants/:tenantId/live/:agentRunId/app/*', Component: GatewayAppRoot },
    { path: 'tenants/:tenantId/apps/:appId/app/*', Component: GatewayAppRoot },
    { path: 'tenants/:tenantId/apps/:appId/versions/:versionId/app/*', Component: GatewayAppRoot },
    { path: 'app/*', Component: GatewayAppRoot },
    { path: '*', Component: GatewayAppRoot },
];

function AppVersionScope({ children }: { children: ReactNode }) {
    const { client, store } = useUserSession();

    useEffect(() => {
        if (!appVersion) return;
        (client as VersionedApi).withAppVersion?.(appVersion);
        (store as VersionedApi).withAppVersion?.(appVersion);
    }, [client, store]);

    return <>{children}</>;
}

export function AppEntry() {
    return (
        <VertesiaShell authToken={appAuthToken}>
            <AppVersionScope>
                <OrgGate>
                    <RouterProvider routes={routes} />
                </OrgGate>
            </AppVersionScope>
        </VertesiaShell>
    );
}
