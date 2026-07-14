import { AgentMessageType, type ContentObject, type CreateAgentRunPayload } from '@vertesia/common';
import { Button, Center, Spinner, useToast } from '@vertesia/ui/core';
import { useUITranslation } from '@vertesia/ui/i18n';
import { useUserSession } from '@vertesia/ui/session';
import { X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
    ModernAgentConversation,
    type SendAgentMessageFn,
    type StartWorkflowOptions,
} from '../../../agent/chat/ModernAgentConversation.js';
import {
    createDocumentEditingRunIdentity,
    type DocumentEditingRunProperties,
    findDocumentEditingRun,
} from './documentEditingRun.js';

interface DocumentEditingPanelProps {
    object: ContentObject;
    onClose: () => void;
    onDocumentUpdated: (updatedDocumentId: string) => void;
    sendMessageRef: React.MutableRefObject<SendAgentMessageFn | null>;
}

const DOCUMENT_EDITING_TOOLS = [
    'ask_user',
    'think',
    'plan',
    'update_plan',
    'end_conversation',
    'learn_document_management',
    'learn_content_authoring',
    'learn_artifact_operations',
    'learn_code_execution',
];

function createDocumentEditingPrompt(object: ContentObject, userPrompt: string): string {
    const documentName = object.name || object.content?.name || 'Document';
    return [
        'You are collaborating with the user on a Markdown document in Vertesia.',
        `Document: [${documentName}](store:${object.id})`,
        '',
        'Treat direct user edits as authoritative. For comments and rewrite requests, preserve unrelated content.',
        'Before modifying the document, load the document-management or content-authoring skill as appropriate.',
        'Use the document artifact workflow and update_document to save changes with revision and concurrency checks.',
        '',
        `User request: ${userPrompt}`,
    ].join('\n');
}

export function DocumentEditingPanel({
    object,
    onClose,
    onDocumentUpdated,
    sendMessageRef,
}: DocumentEditingPanelProps) {
    const { client, project, user } = useUserSession();
    const { t } = useUITranslation();
    const toast = useToast();
    const [agentRunId, setAgentRunId] = useState<string | undefined>();
    const [isStarting, setIsStarting] = useState(false);
    const [isResolvingRun, setIsResolvingRun] = useState(true);
    const seenUpdatesRef = useRef(new Set<string>());
    const documentRootId = object.revision?.root || object.id;
    const startedBy = user?.sub ? `user:${user.sub}` : undefined;

    useEffect(() => {
        setAgentRunId(undefined);
        if (!startedBy) {
            setIsResolvingRun(false);
            return;
        }

        let cancelled = false;
        setIsResolvingRun(true);
        void findDocumentEditingRun(client.agents, object.id, documentRootId, startedBy)
            .then((run) => {
                if (!cancelled && run) setAgentRunId(run.id);
            })
            .catch((err: unknown) => {
                console.warn('Failed to look up an existing document editing run', err);
            })
            .finally(() => {
                if (!cancelled) setIsResolvingRun(false);
            });

        return () => {
            cancelled = true;
        };
    }, [client.agents, documentRootId, object.id, startedBy]);

    const startWorkflow = useCallback(
        async (initialMessage?: string, options?: StartWorkflowOptions) => {
            if (!project || isResolvingRun || isStarting) return undefined;
            setIsStarting(true);
            try {
                const fullProject = await client.projects.retrieve(project.id);
                const defaults =
                    fullProject.configuration?.defaults?.system?.agent ?? fullProject.configuration?.defaults?.base;
                if (!defaults?.environment || !defaults.model) {
                    toast({
                        status: 'error',
                        title: t('agent.documentEditingDefaultsRequired'),
                        duration: 5000,
                    });
                    return undefined;
                }

                const prompt = createDocumentEditingPrompt(
                    object,
                    initialMessage?.trim() || t('agent.documentEditingInitialRequest'),
                );
                const identity = createDocumentEditingRunIdentity(object.id, documentRootId);
                const payload: CreateAgentRunPayload<{ user_prompt: string }, DocumentEditingRunProperties> = {
                    interaction: 'sys:GeneralAgent',
                    interactive: true,
                    tool_approval_mode: options?.tool_approval_mode,
                    tool_names: DOCUMENT_EDITING_TOOLS,
                    data: { user_prompt: prompt },
                    config: {
                        environment: defaults.environment,
                        model: defaults.model,
                    },
                    started_by: startedBy,
                    tags: identity.tags,
                    properties: identity.properties,
                };
                const run = await client.agents.start(payload);
                setAgentRunId(run.id);
                return { agent_run_id: run.id };
            } catch (err: unknown) {
                console.error('Failed to start document editing agent', err);
                toast({
                    status: 'error',
                    title: t('agent.documentEditingStartFailed'),
                    description: err instanceof Error ? err.message : undefined,
                    duration: 5000,
                });
                return undefined;
            } finally {
                setIsStarting(false);
            }
        },
        [client, documentRootId, isResolvingRun, isStarting, object, project, startedBy, t, toast],
    );

    return (
        <div className="flex h-full min-h-0 flex-col border-s border-mixer-muted/20">
            <div className="flex h-10 shrink-0 items-center justify-between border-b border-mixer-muted/20 px-2">
                <span className="truncate text-sm font-semibold">{t('agent.documentEditing')}</span>
                <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0"
                    onClick={onClose}
                    aria-label={t('agent.close')}
                >
                    <X className="size-4" />
                </Button>
            </div>
            <div className="min-h-0 flex-1">
                {isResolvingRun ? (
                    <Center className="h-full">
                        <Spinner size="lg" />
                    </Center>
                ) : (
                    <ModernAgentConversation
                        agentRunId={agentRunId}
                        startWorkflow={startWorkflow}
                        resetWorkflow={() => setAgentRunId(undefined)}
                        sendMessageRef={sendMessageRef}
                        onMessage={(message) => {
                            if (message.type !== AgentMessageType.UPDATE) return;
                            const details = message.details as Record<string, unknown> | undefined;
                            if (details?.event_class !== 'document_updated') return;
                            const revisionInfo = details.revision_info as Record<string, unknown> | undefined;
                            const eventRootId =
                                typeof revisionInfo?.root === 'string' ? revisionInfo.root : details.document_id;
                            if (eventRootId !== documentRootId) return;
                            const updatedDocumentId =
                                typeof details.updated_document_id === 'string'
                                    ? details.updated_document_id
                                    : object.id;
                            const updateKey = `${message.timestamp}:${updatedDocumentId}`;
                            if (seenUpdatesRef.current.has(updateKey)) return;
                            seenUpdatesRef.current.add(updateKey);
                            onDocumentUpdated(updatedDocumentId);
                        }}
                        title={t('agent.documentEditing')}
                        initialMessage={t('agent.documentEditingWelcome')}
                        startButtonText={isStarting ? t('agent.startingAgent') : t('agent.startAgent')}
                        placeholder={t('agent.documentEditingPlaceholder')}
                        initialToolApprovalMode="ask"
                        hideObjectLinking
                        hideHeader
                        hideFileUpload
                        showRightPanel={false}
                        fullWidth
                        interactive
                    />
                )}
            </div>
        </div>
    );
}
