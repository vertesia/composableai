import type { AgentRunResponse, WorkflowRun } from '@vertesia/common';
import { ModeToggle } from '@vertesia/ui/core';
import { useLocaleFormat, useUITranslation } from '@vertesia/ui/i18n';
import { SidebarSection, useSidebarToggle } from '@vertesia/ui/layout';
import type { Route } from '@vertesia/ui/router';
import { useLocation, useRouterBasePath } from '@vertesia/ui/router';
import { useUserSession } from '@vertesia/ui/session';
import type { LucideIcon } from 'lucide-react';
import { MessageSquare } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { routes } from '../../app-ui-modules';
import { ASSISTANT_INTERACTION } from '../constants';
import { AppSidebarItem } from './AppSidebarItem';

const SIDEBAR_RECENT_LIMIT = 3;

type NavigationRoute = Route & {
    label?: string;
    icon?: LucideIcon;
    hideFromNav?: boolean;
};

function routeLabel(label: string, t: (key: string) => string): string {
    return label.includes('.') ? t(label) : label;
}

function isCurrentPath(path: string, basePath: string, routePath: string): boolean {
    const fullRoutePath = routePath === '/' ? basePath : `${basePath}${routePath}`;
    if (routePath === '/') return path === basePath || path === `${basePath}/`;
    return path === fullRoutePath || path.startsWith(`${fullRoutePath}/`);
}

function hasNavigationLabel(route: NavigationRoute): route is NavigationRoute & { label: string } {
    return Boolean(route.label && !route.hideFromNav);
}

function toWorkflowRun(run: AgentRunResponse): WorkflowRun {
    const isAgentRun = run.run_kind === 'agent';

    return {
        run_id: run.id,
        workflow_id: run.workflow_id,
        status: run.status,
        started_at: run.started_at ? new Date(run.started_at).toISOString() : null,
        closed_at: run.completed_at ? new Date(run.completed_at).toISOString() : null,
        topic: isAgentRun ? run.topic : run.title,
        input: isAgentRun && run.data ? { data: run.data } : undefined,
        interaction_name: isAgentRun ? run.interaction_name : undefined,
        visibility: run.visibility,
        activity_state: run.activity_state,
        interactive: isAgentRun ? run.interactive : undefined,
    };
}

function getConversationLabel(
    conv: WorkflowRun,
    t: (key: string) => string,
    formatTime: (date: Date | string | number | null | undefined) => string,
): string {
    if (conv.topic) return conv.topic;
    const input =
        typeof conv.input === 'object' && conv.input !== null ? (conv.input as { data?: unknown }) : undefined;
    const inputData =
        typeof input?.data === 'object' && input.data !== null ? (input.data as Record<string, unknown>) : undefined;
    const prompt = inputData?.user_prompt;
    if (typeof prompt === 'string' && prompt.trim()) return prompt.trim();
    if (conv.started_at) return formatTime(conv.started_at);
    return t('nav.conversation');
}

export function PluginSidebar() {
    const { t } = useUITranslation();
    const { formatTime } = useLocaleFormat();
    const path = useLocation().pathname;
    const basePath = useRouterBasePath();
    const { isOpen } = useSidebarToggle();
    const { client } = useUserSession();
    const [conversations, setConversations] = useState<WorkflowRun[]>([]);
    const navigationRoutes = useMemo(() => (routes as NavigationRoute[]).filter(hasNavigationLabel), []);
    const hasChatRoute = useMemo(() => routes.some((route) => route.path === '/chat/:agentRunId'), []);

    useEffect(() => {
        if (!hasChatRoute) {
            setConversations([]);
            return;
        }
        client.agents
            .list({
                interaction: ASSISTANT_INTERACTION,
                limit: SIDEBAR_RECENT_LIMIT,
                sort: 'started_at',
                order: 'desc',
            })
            .then((response) => setConversations(response.items.map(toWorkflowRun)));
    }, [client, hasChatRoute]);

    return (
        <div className="flex flex-col h-full gap-2 py-2">
            <div className="flex-1 min-h-0 overflow-y-auto py-2 no-scrollbar">
                <nav className="flex flex-col gap-2 h-full">
                    <SidebarSection>
                        {navigationRoutes.map((route) => (
                            <AppSidebarItem
                                key={route.path}
                                id={`menu-${route.path.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '') || 'home'}`}
                                current={isCurrentPath(path, basePath, route.path)}
                                icon={route.icon}
                                to={route.path}
                            >
                                {routeLabel(route.label, t)}
                            </AppSidebarItem>
                        ))}
                    </SidebarSection>
                    {hasChatRoute && conversations.length > 0 && (
                        <SidebarSection title={t('nav.recent')}>
                            {conversations.map((conv) => {
                                const convPath = `${basePath}/chat/${conv.run_id}`;
                                const label = getConversationLabel(conv, t, formatTime);
                                return (
                                    <AppSidebarItem
                                        key={conv.run_id}
                                        to={`/chat/${conv.run_id}`}
                                        current={path === convPath}
                                        icon={MessageSquare}
                                        className="overflow-hidden"
                                    >
                                        <span className="min-w-0 flex-1 truncate text-start" dir="auto" title={label}>
                                            {label}
                                        </span>
                                    </AppSidebarItem>
                                );
                            })}
                        </SidebarSection>
                    )}
                </nav>
            </div>
            <div className="shrink-0 border-t border-sidebar-border pt-2">
                <SidebarSection isFooter>
                    <div>
                        <ModeToggle label={isOpen ? undefined : false} />
                    </div>
                </SidebarSection>
            </div>
        </div>
    );
}
