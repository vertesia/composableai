import { useCallback } from "react";
import { GenericPageNavHeader, ModernAgentConversation } from "@vertesia/ui/features";
import { NavLink, useNavigate, useParams } from "@vertesia/ui/router";
import { useUserSession } from "@vertesia/ui/session";
import { useUITranslation } from "@vertesia/ui/i18n";
import type { CreateAgentRunPayload } from "@vertesia/common";
import { ASSISTANT_INTERACTION } from "../constants";

export function ChatPage() {
    const { t } = useUITranslation();
    const { store } = useUserSession();
    const navigate = useNavigate();
    const params = useParams();
    const { agentRunId } = params as { agentRunId?: string };

    const startWorkflow = useCallback(async (initialMessage?: string) => {
        const payload: CreateAgentRunPayload = {
            interaction: ASSISTANT_INTERACTION,
            interactive: true,
            data: { user_prompt: initialMessage || '' },
        };
        const result = await store.agents.start(payload);
        if (result) {
            navigate(`/chat/${result.id}`);
            return { agent_run_id: result.id! };
        }
        return undefined;
    }, [store, navigate]);

    const handleReset = useCallback(() => navigate('/chat'), [navigate]);

    return (
        <div className="flex flex-col h-full">
            {agentRunId && (
                <GenericPageNavHeader
                    useDynamicBreadcrumbs={false}
                    breadcrumbs={[
                        <NavLink key="root" href="/conversations">
                            {t('nav.conversations')}
                        </NavLink>,
                        <span key="current">
                            <span>{t('nav.conversation')}</span>
                        </span>,
                    ]}
                />
            )}
            <ModernAgentConversation
                agentRunId={agentRunId}
                startWorkflow={startWorkflow}
                title={t('nav.pluginAssistant')}
                resetWorkflow={handleReset}
                hideObjectLinking
                interactive
            />
        </div>
    );
}
