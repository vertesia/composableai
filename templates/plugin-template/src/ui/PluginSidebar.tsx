import { ModeToggle } from '@vertesia/ui/core';
import { SidebarItem, SidebarSection, useSidebarToggle } from '@vertesia/ui/layout';
import { useLocation } from '@vertesia/ui/router';
import { Bot, HomeIcon } from 'lucide-react';

export function PluginSidebar() {
    const path = useLocation().pathname;
    const { isOpen } = useSidebarToggle();

    return (
        <div className="flex flex-col h-full gap-2 py-2">
            <div className="flex-1 min-h-0 overflow-y-auto py-2 no-scrollbar">
                <nav className="flex flex-col gap-2 h-full">
                    <SidebarSection>
                        <SidebarItem
                            id="menu-home"
                            current={path === '/app' || path === '/app/'}
                            icon={HomeIcon}
                            href="/app/"
                        >
                            Home
                        </SidebarItem>
                        <SidebarItem
                            id="menu-chat"
                            current={path === '/app/chat'}
                            icon={Bot}
                            href="/app/chat"
                        >
                            Agent Chat
                        </SidebarItem>
                    </SidebarSection>
                </nav>
            </div>
            <div className="shrink-0 border-t border-sidebar-border pt-2">
                <SidebarSection isFooter>
                    <div>
                        <ModeToggle label={isOpen ? 'Theme' : false} />
                    </div>
                </SidebarSection>
            </div>
        </div>
    );
}
