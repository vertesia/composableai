import type { Route } from '@vertesia/ui/router';
import { NestedRouterProvider, RouteComponent } from '@vertesia/ui/router';
import { useServerInfo, useResourceData } from './hooks.js';
import { AdminContext } from './AdminContext.js';
import { HomePage } from './pages/HomePage.js';
import { InteractionCollection } from './pages/InteractionCollection.js';
import { InteractionDetail } from './pages/InteractionDetail.js';
import adminStyles from './admin.css?inline';

const routes: Route[] = [
    { path: '/', Component: HomePage },
    { path: '/interactions/:collection', Component: InteractionCollection },
    { path: '/interactions/:collection/:name', Component: InteractionDetail },
];

export interface AdminAppProps {
    /**
     * Base URL for the tool server API.
     * @default '/api'
     */
    baseUrl?: string;
}

/**
 * Admin app shell — loads data, provides context, and renders nested routes.
 * CSS is inlined into the JS bundle via Vite's `?inline` import.
 */
export function AdminApp({ baseUrl = '/api' }: AdminAppProps) {
    const { data: serverInfo, isLoading: loadingInfo, error: infoError } = useServerInfo(baseUrl);
    const { data: resourceData, isLoading: loadingData, error: dataError } = useResourceData(
        baseUrl,
        serverInfo?.endpoints.mcp,
    );

    const isLoading = loadingInfo || loadingData;
    const error = infoError || dataError;

    if (isLoading) {
        return (
            <>
                <style>{adminStyles}</style>
                <div className="vta-loading">Loading...</div>
            </>
        );
    }

    if (error) {
        return (
            <>
                <style>{adminStyles}</style>
                <div className="vta-error">Failed to load server info. Is the API running?</div>
            </>
        );
    }

    if (!serverInfo || !resourceData) return null;

    return (
        <>
            <style>{adminStyles}</style>
            <AdminContext.Provider value={{
                serverInfo,
                collections: resourceData.collections,
                resources: resourceData.resources,
                baseUrl,
            }}>
                <NestedRouterProvider routes={routes}>
                    <RouteComponent />
                </NestedRouterProvider>
            </AdminContext.Provider>
        </>
    );
}
