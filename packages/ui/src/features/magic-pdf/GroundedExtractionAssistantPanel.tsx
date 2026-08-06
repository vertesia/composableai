import { useUITranslation } from '@vertesia/ui/i18n';
import { useUserSession } from '@vertesia/ui/session';
import { useCallback, useRef, useState } from 'react';
import { ModernAgentConversation, type StartWorkflowFn } from '../agent/chat';

interface GroundedExtractionAssistantPanelProps {
    objectId: string;
    /**
     * Called after the assistant finishes a turn (which may have applied a grounded
     * edit) so the grounded view can re-fetch and re-render the data + citation boxes.
     */
    onExtractionChanged?: () => void;
    /**
     * The field path currently selected in the view. When set (before the
     * conversation starts), it seeds the assistant: the first message is scoped to
     * this field so "click a field, say what's wrong" reaches the model.
     */
    selectedField?: string;
    onClose?: () => void;
}

/**
 * Interactive assistant embedded in the grounded-extraction view. Starts the
 * server-side GroundedExtractionAssistant conversation (recordRun -> stage the
 * document into the agent space -> launch interactive), then renders the live
 * conversation. Each completed turn triggers `onExtractionChanged` so an operator's
 * grounded edits appear in the data tree + citation overlay without a manual reload.
 */
export function GroundedExtractionAssistantPanel({
    objectId,
    onExtractionChanged,
    selectedField,
    onClose,
}: GroundedExtractionAssistantPanelProps) {
    const { t } = useUITranslation();
    const { client } = useUserSession();
    const [agentRunId, setAgentRunId] = useState<string | undefined>(undefined);
    // Keep the latest callback/selection without re-creating the handlers each render.
    const changedRef = useRef(onExtractionChanged);
    changedRef.current = onExtractionChanged;
    const selectedRef = useRef(selectedField);
    selectedRef.current = selectedField;

    const startWorkflow: StartWorkflowFn = useCallback(
        async (initialMessage) => {
            const field = selectedRef.current;
            // Scope the opening message to the field the operator had selected, so
            // "click a field, say what's wrong" reaches the model with the target.
            const prompt =
                field && initialMessage ? `Regarding the field "${field}": ${initialMessage}` : initialMessage;
            const res = await client.store.objects
                .analyze(objectId)
                .startGroundedAssistant(prompt ? { user_prompt: prompt } : {});
            setAgentRunId(res.agent_run_id);
            return { agent_run_id: res.agent_run_id };
        },
        [client, objectId],
    );

    // The agent re-enables the follow-up input when a turn completes; that turn may
    // have applied a grounded edit, so refresh the extraction at that point.
    const handleShowInputChange = useCallback((canSendFollowUp: boolean) => {
        if (canSendFollowUp) {
            changedRef.current?.();
        }
    }, []);

    return (
        <div className="flex h-full flex-col">
            {selectedField && !agentRunId && (
                <div className="shrink-0 border-b border-border bg-muted/40 px-3 py-1.5 text-xs text-muted-foreground">
                    {t('grounded.assistantField')} <span className="font-mono text-foreground">{selectedField}</span>
                </div>
            )}
            <ModernAgentConversation
                agentRunId={agentRunId}
                startWorkflow={startWorkflow}
                interactive
                fullWidth
                hideObjectLinking
                onShowInputChange={handleShowInputChange}
                onClose={onClose}
            />
        </div>
    );
}
