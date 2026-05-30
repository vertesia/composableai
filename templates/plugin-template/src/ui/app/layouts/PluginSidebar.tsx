import { useEffect, useState } from 'react';
import { ModeToggle } from '@vertesia/ui/core';
import { useLocaleFormat, useUITranslation } from '@vertesia/ui/i18n';
import { SidebarSection, useSidebarToggle } from '@vertesia/ui/layout';
import { useLocation, useRouterBasePath } from '@vertesia/ui/router';
import { useUserSession } from '@vertesia/ui/session';
import { Database, HomeIcon, MessageSquare, MessagesSquare, PlusCircle, Settings } from 'lucide-react';
import type { WorkflowRun } from '@vertesia/common';
import { AppSidebarItem } from './AppSidebarItem';
import { ASSISTANT_INTERACTION } from '../constants';

const SIDEBAR_RECENT_LIMIT = 3;

type RecentAgentRun = {
    id: string;
    run_kind?: string;
    workflow_id?: string;
    status?: WorkflowRun['status'];
    started_at?: string | number | Date | null;
    completed_at?: string | number | Date | null;
    topic?: string;
    title?: string;
    data?: Record<string, unknown>;
    interaction_name?: string;
    visibility?: WorkflowRun['visibility'];
    activity_state?: WorkflowRun['activity_state'];
    interactive?: boolean;
};

function toWorkflowRun(run: RecentAgentRun): WorkflowRun {
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

    useEffect(() => {
        client.agents
            .list({
                interaction: ASSISTANT_INTERACTION,
                limit: SIDEBAR_RECENT_LIMIT,
                sort: 'started_at',
                order: 'desc',
            })
            .then((response) => setConversations(response.items.map(toWorkflowRun)));
    }, [client]);

    return (
        <div className="flex flex-col h-full gap-2 py-2">
            <div className="flex-1 min-h-0 overflow-y-auto py-2 no-scrollbar">
                <nav className="flex flex-col gap-2 h-full">
                    <SidebarSection>
                        <AppSidebarItem
                            id="menu-home"
                            current={path === basePath || path === `${basePath}/`}
                            icon={HomeIcon}
                            to="/"
                        >
                            {t('nav.home')}
                        </AppSidebarItem>
                        <AppSidebarItem
                            id="menu-objects"
                            current={path === `${basePath}/objects`}
                            icon={Database}
                            to="/objects"
                        >
                            {t('nav.objects')}
                        </AppSidebarItem>
                        <AppSidebarItem
                            id="menu-conversations"
                            current={path === `${basePath}/conversations`}
                            icon={MessagesSquare}
                            to="/conversations"
                        >
                            {t('nav.conversations')}
                        </AppSidebarItem>
                        <AppSidebarItem
                            id="menu-chat"
                            current={path === `${basePath}/chat`}
                            icon={PlusCircle}
                            to="/chat"
                        >
                            {t('nav.newChat')}
                        </AppSidebarItem>
                        <AppSidebarItem
                            id="menu-settings"
                            current={path === `${basePath}/settings`}
                            icon={Settings}
                            to="/settings"
                        >
                            {t('nav.settings')}
                        </AppSidebarItem>
                    </SidebarSection>
                    {conversations.length > 0 && (
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
