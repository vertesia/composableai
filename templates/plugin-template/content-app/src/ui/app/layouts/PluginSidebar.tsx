import type { WorkflowRun } from '@vertesia/common';
import { ModeToggle } from '@vertesia/ui/core';
import { SidebarSection, useSidebarToggle } from '@vertesia/ui/layout';
import { useLocation, useRouterBasePath } from '@vertesia/ui/router';
import { useUserSession } from '@vertesia/ui/session';
import { BookOpen, CheckSquare, GitBranch, HomeIcon, Lightbulb, MessageSquare, PlusCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { ASSISTANT_INTERACTION } from '../constants';
import { AppSidebarItem } from './AppSidebarItem';

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

function conversationLabel(conv: WorkflowRun): string {
    if (conv.topic) return conv.topic;
    if (conv.started_at)
        return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(conv.started_at));
    return 'Conversation';
}

export function PluginSidebar() {
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
            .then((response) => setConversations(response.items.map(toWorkflowRun)))
            .catch(() => setConversations([]));
    }, [client]);

    return (
        <div className="flex h-full flex-col gap-2 py-2">
            <div className="min-h-0 flex-1 overflow-y-auto py-2 no-scrollbar">
                <nav className="flex h-full flex-col gap-2">
                    <SidebarSection>
                        <AppSidebarItem
                            id="menu-home"
                            current={path === basePath || path === `${basePath}/`}
                            icon={HomeIcon}
                            to="/"
                        >
                            Home
                        </AppSidebarItem>
                        <AppSidebarItem
                            id="menu-library"
                            current={path.startsWith(`${basePath}/library`)}
                            icon={BookOpen}
                            to="/library"
                        >
                            Library
                        </AppSidebarItem>
                        <AppSidebarItem
                            id="menu-reviews"
                            current={path === `${basePath}/reviews`}
                            icon={CheckSquare}
                            to="/reviews"
                        >
                            Reviews
                        </AppSidebarItem>
                        <AppSidebarItem
                            id="menu-ideas"
                            current={path === `${basePath}/ideas`}
                            icon={Lightbulb}
                            to="/ideas"
                        >
                            Ideas
                        </AppSidebarItem>
                        <AppSidebarItem
                            id="menu-process"
                            current={path === `${basePath}/process`}
                            icon={GitBranch}
                            to="/process"
                        >
                            Process
                        </AppSidebarItem>
                        <AppSidebarItem
                            id="menu-chat"
                            current={path === `${basePath}/chat`}
                            icon={PlusCircle}
                            to="/chat"
                        >
                            Chat
                        </AppSidebarItem>
                    </SidebarSection>
                    {conversations.length > 0 && (
                        <SidebarSection title="Recent">
                            {conversations.map((conv) => {
                                const convPath = `${basePath}/chat/${conv.run_id}`;
                                const label = conversationLabel(conv);
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
