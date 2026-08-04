import { AppLayout } from '@vertesia/ui/layout';
import { NestedNavigationContext, Path, useRouterContext } from '@vertesia/ui/router';
import { PluginSidebar } from './PluginSidebar';
import { PluginTopNav } from './PluginTopNav';

interface PluginLayoutProps {
    children: React.ReactNode;
}

export function PluginLayout({ children }: PluginLayoutProps) {
    const sidebarBg = 'bg-sidebar text-sidebar-foreground border-e border-sidebar-border w-full';
    const { matchedRoutePath } = useRouterContext();
    const basePath = Path.withMountBasename(matchedRoutePath);

    return (
        <AppLayout
            sidebar={
                <NestedNavigationContext basePath={basePath}>
                    <PluginSidebar basePath={basePath} />
                </NestedNavigationContext>
            }
            sidebarClassName={sidebarBg}
            mainNav={<PluginTopNav />}
        >
            {children}
        </AppLayout>
    );
}
