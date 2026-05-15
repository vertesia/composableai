import { AppLayout } from '@vertesia/ui/layout';
import { NestedNavigationContext, useRouterBasePath } from '@vertesia/ui/router';
import { PluginSidebar } from './PluginSidebar';
import { PluginTopNav } from './PluginTopNav';

interface PluginLayoutProps {
    children: React.ReactNode;
}

export function PluginLayout({ children }: PluginLayoutProps) {
    const sidebarBg = 'bg-sidebar text-sidebar-foreground border-r border-sidebar-border w-full';
    const basePath = useRouterBasePath();

    return (
        <AppLayout
            sidebar={(
                <NestedNavigationContext basePath={basePath}>
                    <PluginSidebar />
                </NestedNavigationContext>
            )}
            sidebarClassName={sidebarBg}
            mainNav={<PluginTopNav />}
        >
            {children}
        </AppLayout>
    );
}
