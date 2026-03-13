import { useEffect, useMemo, useState } from 'react';
import { ModeToggle } from '@vertesia/ui/core';
import { useUITranslation } from '@vertesia/ui/i18n';
import { SidebarItem, SidebarSection, useSidebarToggle } from '@vertesia/ui/layout';
import { Path, useLocation, useRouterBasePath } from '@vertesia/ui/router';
import { useUserSession } from '@vertesia/ui/session';
import { HomeIcon, MessageSquare, PlusCircle } from 'lucide-react';
import type { WorkflowRun } from '@vertesia/common';
import { ASSISTANT_INTERACTION } from './constants';

function getConversationLabel(conv: WorkflowRun, t: (key: string) => string): string {
    if (conv.topic) return conv.topic;
    // input is not populated by listConversations, but check anyway for forward compat
    const prompt = conv.input?.data?.user_prompt;
    if (typeof prompt === 'string' && prompt.trim()) return prompt.trim();
    // Fall back to a formatted date/time
    if (conv.started_at) {
        return new Date(conv.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return t('nav.conversation');
}

function getDateLabel(date: Date, t: (key: string) => string): string {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());

    if (target.getTime() === today.getTime()) return t('nav.today');
    if (target.getTime() === yesterday.getTime()) return t('nav.yesterday');
    return date.toLocaleDateString();
}

interface GroupedConversations {
    dateLabel: string;
    conversations: WorkflowRun[];
}

function groupByDate(conversations: WorkflowRun[], t: (key: string) => string): GroupedConversations[] {
    const groups: GroupedConversations[] = [];
    let currentLabel = '';
    for (const conv of conversations) {
        const date = conv.started_at ? new Date(conv.started_at) : new Date();
        const label = getDateLabel(date, t);
        if (label !== currentLabel) {
            currentLabel = label;
            groups.push({ dateLabel: label, conversations: [conv] });
        } else {
            groups[groups.length - 1].conversations.push(conv);
        }
    }
    return groups;
}

export function PluginSidebar() {
    const { t } = useUITranslation();
    const path = useLocation().pathname;
    const basePath = useRouterBasePath();
    const { isOpen } = useSidebarToggle();
    const { client } = useUserSession();
    const [conversations, setConversations] = useState<WorkflowRun[]>([]);
    const appHref = (to: string) => Path.joinPath(basePath, to);

    useEffect(() => {
        client.agents.list({
            interaction: ASSISTANT_INTERACTION,
            limit: 20,
            sort: 'started_at',
            order: 'desc',
        }).then(runs => setConversations(runs.map(r => ({
            run_id: r.id,
            workflow_id: r.workflow_id,
            started_at: r.started_at ? new Date(r.started_at).toISOString() : null,
            topic: r.topic,
            input: r.data ? { data: r.data } : undefined,
        } as WorkflowRun))));
    }, [client]);

    const grouped = useMemo(() => groupByDate(conversations, t), [conversations, t]);

    return (
        <div className="flex flex-col h-full gap-2 py-2">
            <div className="flex-1 min-h-0 overflow-y-auto py-2 no-scrollbar">
                <nav className="flex flex-col gap-2 h-full">
                    <SidebarSection>
                        <SidebarItem
                            id="menu-home"
                            current={path === basePath || path === `${basePath}/`}
                            icon={HomeIcon}
                            href={appHref('/')}
                            to="/"
                        >
                            {t('nav.home')}
                        </SidebarItem>
                        <SidebarItem
                            id="menu-chat"
                            current={path === appHref('/chat')}
                            icon={PlusCircle}
                            href={appHref('/chat')}
                            to="/chat"
                        >
                            {t('nav.newChat')}
                        </SidebarItem>
                    </SidebarSection>
                    {grouped.map(group => (
                        <SidebarSection key={group.dateLabel} title={group.dateLabel}>
                            {group.conversations.map(conv => {
                                const convPath = appHref(`/chat/${conv.run_id}`);
                                return (
                                    <SidebarItem
                                        key={conv.run_id}
                                        href={convPath}
                                        to={`/chat/${conv.run_id}`}
                                        current={path === convPath}
                                        icon={MessageSquare}
                                        className="overflow-hidden"
                                    >
                                        <span className="truncate">{getConversationLabel(conv, t)}</span>
                                    </SidebarItem>
                                );
                            })}
                        </SidebarSection>
                    ))}
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
