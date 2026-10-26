import branding from 'virtual:vertesia-branding';
import { type Route, RouterProvider } from '@vertesia/ui/router';
import { IFRAME_APP_CONTENT_SLOT, IFRAME_APP_SLOT_PARAM, StandaloneApp, VertesiaShell } from '@vertesia/ui/shell';
import { setUsePluginAssets } from '../../../ui/assets';
import { App } from '../../../ui/shell/App';
import { AppVersionScope } from '../../../ui/shell/AppVersionScope';
import { OrgGate } from '../../../ui/shell/layouts/OrgGate';
import { PluginAccessDenied } from '../../../ui/shell/layouts/PluginAccessDenied';
import { PluginLayout } from '../../../ui/shell/layouts/PluginLayout';
import { appAuthScreens } from '../../app/branding/screens';

setUsePluginAssets(false);

const appName = import.meta.env.VITE_APP_NAME;
const globalValues = globalThis as Record<string, unknown>;
const injectedAuthToken =
    typeof globalValues.__VERTESIA_AUTH_TOKEN__ === 'string' ? globalValues.__VERTESIA_AUTH_TOKEN__ : undefined;
const devAuthToken = import.meta.env.DEV ? import.meta.env.VITE_VERTESIA_AUTH_TOKEN : undefined;
// Candidate validation injects a short-lived token before the application bundle loads. Prefer it
// over a build-time development token so reloads and deployed Playwright runs use the current run.
const runtimeAuthToken = injectedAuthToken ?? devAuthToken;
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

const GatewayAppRoot = runtimeAuthToken ? AppRoot : ProtectedAppRoot;

const routes: Route[] = [
    { path: 'tenants/:tenantId/live/:agentRunId/app/*', Component: GatewayAppRoot },
    { path: 'tenants/:tenantId/apps/:appId/app/*', Component: GatewayAppRoot },
    { path: 'tenants/:tenantId/apps/:appId/versions/:versionId/app/*', Component: GatewayAppRoot },
    { path: 'app/*', Component: GatewayAppRoot },
    { path: '*', Component: GatewayAppRoot },
];

export function AppEntry() {
    return (
        <VertesiaShell branding={branding} preserveSignInPath authToken={runtimeAuthToken} authScreens={appAuthScreens}>
            <AppVersionScope>
                <OrgGate>
                    <RouterProvider routes={routes} />
                </OrgGate>
            </AppVersionScope>
        </VertesiaShell>
    );
}
