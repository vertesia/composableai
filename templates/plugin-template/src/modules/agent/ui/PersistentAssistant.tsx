import type { CreateAgentRunPayload } from '@vertesia/common';
import { Button, SidePanel } from '@vertesia/ui/core';
import { ModernAgentConversation } from '@vertesia/ui/features';
import { useUITranslation } from '@vertesia/ui/i18n';
import { useLocation } from '@vertesia/ui/router';
import { useUserSession } from '@vertesia/ui/session';
import { Bot, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ASSISTANT_INTERACTION } from '../../../ui/shell/constants';
import type { OpenAssistantDetail } from './assistantEvents';
import { OPEN_ASSISTANT_EVENT } from './assistantEvents';

/**
 * Route-aware assistant context. Replace this builder for your plugin to surface
 * relevant ids (objectId, typeId, selectedObjectIds, etc.) to agent runs. The
 * default extracts the first path segment as `scope`.
 */
export interface AssistantContext {
    scope: string;
    route: string;
    [key: string]: unknown;
}

function defaultContext(pathname: string): AssistantContext {
    const segments = pathname.split('/').filter(Boolean);
    return { scope: segments[0] || 'home', route: pathname };
}

interface PersistentAssistantProps {
    /**
     * Build a route-aware context that gets passed to every agent run started
     * from the assistant. Override per plugin to include entity ids.
     */
    getContext?: (pathname: string) => AssistantContext;
    /**
     * Tag every agent run started from the assistant. Use this to scope
     * Activity tabs and personalization queries to your plugin.
     */
    appTag?: string;
    /** Width of the side panel in pixels. */
    panelWidth?: number;
    /** Initial assistant interaction id. Defaults to `ASSISTANT_INTERACTION`. */
    interaction?: string;
}

export function PersistentAssistant({
    getContext = defaultContext,
    appTag = 'plugin-app',
    panelWidth = 560,
    interaction = ASSISTANT_INTERACTION,
}: PersistentAssistantProps) {
    const { t } = useUITranslation();
    const { client, project, account, user } = useUserSession();
    const location = useLocation();
    const [isOpen, setIsOpen] = useState(false);
    const [agentRunId, setAgentRunId] = useState<string | undefined>();
    const [suggestedMessage, setSuggestedMessage] = useState<string | undefined>();

    const context = useMemo(() => getContext(location.pathname), [getContext, location.pathname]);

    useEffect(() => {
        const open = (event: Event) => {
            const detail = (event as CustomEvent<OpenAssistantDetail>).detail;
            if (detail?.agentRunId) {
                setAgentRunId(detail.agentRunId);
            }
            setSuggestedMessage(detail?.initialMessage);
            setIsOpen(true);
        };
        window.addEventListener(OPEN_ASSISTANT_EVENT, open);
        return () => window.removeEventListener(OPEN_ASSISTANT_EVENT, open);
    }, []);

    const startWorkflow = useCallback(
        async (initialMessage?: string) => {
            const payload: CreateAgentRunPayload = {
                interaction,
                interactive: true,
                data: {
                    user_prompt: initialMessage || '',
                    app: appTag,
                    context,
                    project_name: project?.name,
                    account_name: account?.name,
                },
                started_by: user?.sub,
                tags: [appTag, 'user-assistant', context.scope],
            };
            const result = await client.agents.start(payload);
            if (result?.id) {
                setAgentRunId(result.id);
                return { agent_run_id: result.id };
            }
            return undefined;
        },
        [interaction, appTag, context, project?.name, account?.name, user?.sub, client.agents],
    );

    const handleReset = useCallback(() => setAgentRunId(undefined), []);

    return (
        <>
            {!isOpen && (
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsOpen(true)}
                    className="fixed end-4 bottom-5 z-40 gap-2 shadow-md"
                    alt={t('nav.openAssistant')}
                >
                    <Bot className="size-4" />
                    <span>{t('nav.askAi')}</span>
                </Button>
            )}
            <SidePanel
                isOpen={isOpen}
                onClose={() => setIsOpen(false)}
                title={
                    <div className="flex items-center gap-2">
                        <Bot className="size-5 text-primary" />
                        <span>{t('nav.pluginAssistant')}</span>
                    </div>
                }
                panelWidth={panelWidth}
                contentClassName="flex-1 flex flex-col overflow-hidden min-h-0"
            >
                <div className="px-4 py-2 border-b flex items-center justify-between gap-3 text-xs text-muted shrink-0">
                    <span className="truncate">
                        {t('nav.assistantContext', { scope: context.scope, route: context.route })}
                    </span>
                    {agentRunId && (
                        <Button variant="ghost" size="xs" onClick={handleReset} alt={t('nav.newAssistantSession')}>
                            <X className="size-3" />
                            <span>{t('nav.newSession')}</span>
                        </Button>
                    )}
                </div>
                <div className="flex-1 min-h-0 overflow-hidden">
                    <ModernAgentConversation
                        agentRunId={agentRunId}
                        startWorkflow={startWorkflow}
                        title={t('nav.pluginAssistant')}
                        initialMessage={suggestedMessage || t('nav.assistantInitialPrompt')}
                        placeholder={t('nav.assistantPlaceholder')}
                        resetWorkflow={handleReset}
                        hideObjectLinking
                        fullWidth
                        interactive
                        conversationTab
                    />
                </div>
            </SidePanel>
        </>
    );
}
