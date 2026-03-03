import { AppLayout } from '@vertesia/ui/layout';
import { PluginSidebar } from './PluginSidebar';
import { PluginTopNav } from './PluginTopNav';

interface PluginLayoutProps {
    children: React.ReactNode;
}

export function PluginLayout({ children }: PluginLayoutProps) {
    const sidebarBg = 'bg-sidebar text-sidebar-foreground border-r border-sidebar-border w-full';

    return (
        <AppLayout
            sidebar={<PluginSidebar />}
            sidebarClassName={sidebarBg}
            mainNav={<PluginTopNav />}
        >
            {children}
        </AppLayout>
    );
}
