import { useEffect, useMemo, useState } from "react";
import { ModeToggle } from "@vertesia/ui/core";
import { useUITranslation } from "@vertesia/ui/i18n";
import { SidebarSection, useSidebarToggle } from "@vertesia/ui/layout";
import { useLocation, useRouterBasePath } from "@vertesia/ui/router";
import { useUserSession } from "@vertesia/ui/session";
import { MessageSquare } from "lucide-react";
import type { WorkflowRun } from "@vertesia/common";
import { AppSidebarItem } from "./AppSidebarItem";
import { ASSISTANT_INTERACTION } from "./constants";
import { routes } from "./routes";
import type { PluginRoute } from "./routes";

function isCurrent(path: string, basePath: string, to: string): boolean {
    const fullPath = `${basePath}${to === "/" ? "" : to}`;
    return path === fullPath || path.startsWith(`${fullPath}/`);
}

function navRoutes(): PluginRoute[] {
    return routes.filter(route => !route.hideFromNav && route.label && route.icon);
}

function groupNavRoutes(items: PluginRoute[]): Array<{ title?: string; items: PluginRoute[] }> {
    const groups = new Map<string, PluginRoute[]>();
    const order: string[] = [];
    for (const item of items) {
        const key = item.sidebarGroup ?? "";
        if (!groups.has(key)) {
            groups.set(key, []);
            order.push(key);
        }
        groups.get(key)!.push(item);
    }
    return order.map(key => ({ title: key || undefined, items: groups.get(key)! }));
}

interface AgentRunListItem {
    id: string;
    run_kind?: string;
    workflow_id?: string;
    status: WorkflowRun["status"];
    started_at?: Date | string | null;
    completed_at?: Date | string | null;
    topic?: string;
    title?: string;
    data?: Record<string, unknown>;
    interaction_name?: string;
    visibility?: WorkflowRun["visibility"];
    activity_state?: WorkflowRun["activity_state"];
    interactive?: boolean;
}

function toWorkflowRun(run: AgentRunListItem): WorkflowRun {
    const isAgentRun = run.run_kind === "agent";
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

function getConversationLabel(conv: WorkflowRun, t: (key: string) => string): string {
    if (conv.topic) return conv.topic;
    const prompt = conv.input?.data?.user_prompt;
    if (typeof prompt === "string" && prompt.trim()) return prompt.trim();
    if (conv.started_at) {
        return new Date(conv.started_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    }
    return t("nav.conversation");
}

function getDateLabel(date: Date, t: (key: string) => string): string {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    if (target.getTime() === today.getTime()) return t("nav.today");
    if (target.getTime() === yesterday.getTime()) return t("nav.yesterday");
    return date.toLocaleDateString();
}

interface GroupedConversations {
    dateLabel: string;
    conversations: WorkflowRun[];
}

function groupByDate(conversations: WorkflowRun[], t: (key: string) => string): GroupedConversations[] {
    const groups: GroupedConversations[] = [];
    let currentLabel = "";
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

interface PluginSidebarProps {
    /**
     * Whether to render the recent agent conversations section under the
     * primary nav. Useful for chat-style plugins; turn off for archetypes
     * that don't surface conversation history (analytics, forms, queues).
     */
    showConversations?: boolean;
}

export function PluginSidebar({ showConversations = true }: PluginSidebarProps) {
    const { t } = useUITranslation();
    const path = useLocation().pathname;
    const basePath = useRouterBasePath();
    const { isOpen } = useSidebarToggle();
    const { client } = useUserSession();
    const [conversations, setConversations] = useState<WorkflowRun[]>([]);

    const groupedNav = useMemo(() => groupNavRoutes(navRoutes()), []);

    useEffect(() => {
        if (!showConversations) return;
        client.agents.list({
            interaction: ASSISTANT_INTERACTION,
            limit: 20,
            sort: "started_at",
            order: "desc",
        })
            .then(response => {
                const items = Array.isArray(response.items) ? response.items : [];
                setConversations(items.map(run => toWorkflowRun(run as AgentRunListItem)));
            })
            .catch(() => setConversations([]));
    }, [client, showConversations]);

    const groupedConversations = useMemo(() => groupByDate(conversations, t), [conversations, t]);

    return (
        <div className="flex flex-col h-full gap-2 py-2">
            <div className="flex-1 min-h-0 overflow-y-auto py-2 no-scrollbar">
                <nav className="flex flex-col gap-2 h-full">
                    {groupedNav.map((group, groupIndex) => (
                        <SidebarSection key={group.title ?? `nav-${groupIndex}`} title={group.title}>
                            {group.items.map(route => {
                                const Icon = route.icon!;
                                const label = route.label!;
                                return (
                                    <AppSidebarItem
                                        key={route.path}
                                        id={`menu-${route.path.replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "") || "home"}`}
                                        current={isCurrent(path, basePath, route.path)}
                                        icon={Icon}
                                        to={route.path}
                                    >
                                        {label.includes(".") ? t(label) : label}
                                    </AppSidebarItem>
                                );
                            })}
                        </SidebarSection>
                    ))}
                    {showConversations && groupedConversations.map(group => (
                        <SidebarSection key={group.dateLabel} title={group.dateLabel}>
                            {group.conversations.map(conv => {
                                const convPath = `${basePath}/chat/${conv.run_id}`;
                                return (
                                    <AppSidebarItem
                                        key={conv.run_id}
                                        to={`/chat/${conv.run_id}`}
                                        current={path === convPath}
                                        icon={MessageSquare}
                                        className="overflow-hidden"
                                    >
                                        <span className="truncate">{getConversationLabel(conv, t)}</span>
                                    </AppSidebarItem>
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
