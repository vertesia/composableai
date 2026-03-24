import { Spinner } from '@vertesia/ui/core';
import type { Route } from '@vertesia/ui/router';
import { NestedRouterProvider, RouteComponent } from '@vertesia/ui/router';

import { AdminContext } from './AdminContext.js';
import { AdminTopBar } from './components/AdminTopBar.js';
import { useResourceData, useServerInfo } from './hooks.js';
import { ActivityCollection } from './pages/ActivityCollection.js';
import { HomePage } from './pages/HomePage.js';
import { InteractionCollection } from './pages/InteractionCollection.js';
import { InteractionDetail } from './pages/InteractionDetail.js';
import { SkillCollection } from './pages/SkillCollection.js';
import { SkillDetail } from './pages/SkillDetail.js';
import { TemplateCollection } from './pages/TemplateCollection.js';
import { TemplateDetail } from './pages/TemplateDetail.js';
import { ToolCollection } from './pages/ToolCollection.js';
import { TypeCollection } from './pages/TypeCollection.js';
import { TypeDetail } from './pages/TypeDetail.js';

const routes: Route[] = [
    { path: '/', Component: HomePage },
    { path: '/interactions/:collection', Component: InteractionCollection },
    { path: '/interactions/:collection/:name', Component: InteractionDetail },
    { path: '/tools/:collection', Component: ToolCollection },
    { path: '/activities/:collection', Component: ActivityCollection },
    { path: '/skills/:collection', Component: SkillCollection },
    { path: '/skills/:collection/:name', Component: SkillDetail },
    { path: '/types/:collection', Component: TypeCollection },
    { path: '/types/:collection/:name', Component: TypeDetail },
    { path: '/templates/:collection', Component: TemplateCollection },
    { path: '/templates/:collection/:name', Component: TemplateDetail },
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
 *
 * Requires a parent VertesiaShell (or equivalent providers for ThemeProvider,
 * UserSessionProvider, ToastProvider).
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
            <div className="flex h-64 items-center justify-center text-muted-foreground">
                <Spinner />
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-6 text-destructive">
                Failed to load server info. Is the API running?
            </div>
        );
    }

    if (!serverInfo || !resourceData) return null;

    const title = serverInfo.message.replace('Vertesia Tools API', 'Tools Server');

    return (
        <div className="min-h-screen bg-background text-foreground">
            <AdminTopBar title={title} />
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
        </div>
    );
}
