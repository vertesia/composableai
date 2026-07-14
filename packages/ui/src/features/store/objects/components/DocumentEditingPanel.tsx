import { AgentMessageType, type ContentObject, type CreateAgentRunPayload } from '@vertesia/common';
import { Button, Center, Spinner, useToast, VTooltip } from '@vertesia/ui/core';
import { useUITranslation } from '@vertesia/ui/i18n';
import { useUserSession } from '@vertesia/ui/session';
import { RotateCcw, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
    ModernAgentConversation,
    type SendAgentMessageFn,
    type StartWorkflowOptions,
} from '../../../agent/chat/ModernAgentConversation.js';
import {
    type DocumentEditingConfiguration,
    DocumentEditingConfigurationSelector,
    getDocumentEditingProjectDefault,
} from './DocumentEditingConfigurationSelector.js';
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

function shortenRunId(id: string): string {
    return id.length > 12 ? `${id.slice(0, 4)}…${id.slice(-4)}` : id;
}

function createDocumentEditingPrompt(object: ContentObject, userPrompt: string): string {
    const documentName = object.name || object.content?.name || 'Document';
    return [
        'You are collaborating with the user on a Markdown document in Vertesia.',
        `Document: [${documentName}](store:${object.id})`,
        '',
        'Treat direct user edits as authoritative. For comments and rewrite requests, preserve unrelated content.',
        'Attachments may contain review comments. Treat them as a batch of requested edits against the latest',
        'document content, preserve unrelated content, and report any comment whose target cannot be found.',
        'Before modifying the document, load the document-management or content-authoring skill as appropriate.',
        'Use the document artifact workflow and update_document to save changes with revision and concurrency checks.',
        'Create a document revision only on your first save in this conversation (create_revision: true); for every',
        'later save pass create_revision: false so the whole session stays on one working revision.',
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
    const [isTerminating, setIsTerminating] = useState(false);
    const [isResolvingRun, setIsResolvingRun] = useState(true);
    const [isLoadingConfiguration, setIsLoadingConfiguration] = useState(true);
    const [executionConfiguration, setExecutionConfiguration] = useState<DocumentEditingConfiguration>({});
    const configurationSourceRef = useRef<'none' | 'project' | 'run' | 'user'>('none');
    const seenUpdatesRef = useRef(new Set<string>());
    const documentRootId = object.revision?.root || object.id;
    const startedBy = user?.sub ? `user:${user.sub}` : undefined;
    const editingScopeKey = `${project?.id ?? 'no-project'}:${documentRootId}`;
    const editingScopeRef = useRef(editingScopeKey);
    const lookupIdentityRef = useRef({ documentId: object.id, documentRootId });
    if (lookupIdentityRef.current.documentRootId !== documentRootId) {
        lookupIdentityRef.current = { documentId: object.id, documentRootId };
    }

    useEffect(() => {
        if (editingScopeRef.current === editingScopeKey) return;
        editingScopeRef.current = editingScopeKey;
        configurationSourceRef.current = 'none';
        setExecutionConfiguration({});
        seenUpdatesRef.current.clear();
    }, [editingScopeKey]);

    useEffect(() => {
        if (!project) {
            setIsLoadingConfiguration(false);
            return;
        }

        let cancelled = false;
        const requestScopeKey = editingScopeKey;
        setIsLoadingConfiguration(true);
        void client.projects
            .retrieve(project.id)
            .then((fullProject) => {
                if (
                    cancelled ||
                    editingScopeRef.current !== requestScopeKey ||
                    configurationSourceRef.current !== 'none'
                ) {
                    return;
                }
                configurationSourceRef.current = 'project';
                setExecutionConfiguration(getDocumentEditingProjectDefault(fullProject));
            })
            .catch((err: unknown) => {
                console.warn('Failed to load the default document editing model', err);
            })
            .finally(() => {
                if (!cancelled) setIsLoadingConfiguration(false);
            });

        return () => {
            cancelled = true;
        };
    }, [client, editingScopeKey, project]);

    useEffect(() => {
        setAgentRunId(undefined);
        if (!startedBy) {
            setIsResolvingRun(false);
            return;
        }

        let cancelled = false;
        setIsResolvingRun(true);
        void findDocumentEditingRun(client.agents, lookupIdentityRef.current.documentId, documentRootId, startedBy)
            .then((run) => {
                if (cancelled || !run) return;
                setAgentRunId(run.id);
                if (run.config?.environment && run.config.model) {
                    configurationSourceRef.current = 'run';
                    setExecutionConfiguration({
                        environment: run.config.environment,
                        model: run.config.model,
                    });
                }
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
    }, [client, documentRootId, startedBy]);

    const handleConfigurationChange = useCallback((value: DocumentEditingConfiguration) => {
        configurationSourceRef.current = 'user';
        setExecutionConfiguration(value);
    }, []);

    const handleCopyRunId = useCallback(() => {
        if (!agentRunId) return;
        navigator.clipboard
            .writeText(agentRunId)
            .then(() => {
                toast({ status: 'success', title: t('agent.runIdCopied'), duration: 2000 });
            })
            .catch((err: unknown) => {
                console.warn('Failed to copy the agent run id', err);
            });
    }, [agentRunId, t, toast]);

    const handleStartNewSession = useCallback(async () => {
        if (!agentRunId || isTerminating) return;
        setIsTerminating(true);
        try {
            await client.agents.terminate(agentRunId, 'cancel');
            toast({ status: 'success', title: t('agent.workflowCancelled'), duration: 2000 });
        } catch (err: unknown) {
            // The run may already be finished; detach anyway so the user can start fresh.
            console.warn('Failed to terminate the document editing run', err);
        } finally {
            setIsTerminating(false);
        }
        seenUpdatesRef.current.clear();
        setAgentRunId(undefined);
    }, [agentRunId, client, isTerminating, t, toast]);

    const startWorkflow = useCallback(
        async (initialMessage?: string, options?: StartWorkflowOptions) => {
            if (!project || isResolvingRun || isStarting || isLoadingConfiguration) return undefined;
            setIsStarting(true);
            try {
                if (!executionConfiguration.environment || !executionConfiguration.model) {
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
                        environment: executionConfiguration.environment,
                        model: executionConfiguration.model,
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
        [
            client,
            documentRootId,
            executionConfiguration,
            isLoadingConfiguration,
            isResolvingRun,
            isStarting,
            object,
            project,
            startedBy,
            t,
            toast,
        ],
    );

    return (
        <div className="flex h-full min-h-0 flex-col border-s border-mixer-muted/20">
            <div className="flex h-10 shrink-0 items-center justify-between border-b border-mixer-muted/20 px-2">
                <span className="min-w-0 flex-1 truncate text-sm font-semibold">{t('agent.documentEditing')}</span>
                <div className="flex shrink-0 items-center gap-1">
                    {agentRunId ? (
                        <>
                            <VTooltip description={agentRunId} asChild>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 px-1.5 font-mono text-[11px] text-muted"
                                    onClick={handleCopyRunId}
                                    aria-label={t('agent.copyRunId')}
                                >
                                    {shortenRunId(agentRunId)}
                                </Button>
                            </VTooltip>
                            <VTooltip description={t('agent.startNewConversation')} asChild>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 w-7 p-0"
                                    onClick={() => void handleStartNewSession()}
                                    disabled={isTerminating}
                                    aria-label={t('agent.startNewConversation')}
                                >
                                    <RotateCcw className="size-4" />
                                </Button>
                            </VTooltip>
                        </>
                    ) : null}
                    <DocumentEditingConfigurationSelector
                        value={executionConfiguration}
                        onChange={handleConfigurationChange}
                        disabled={Boolean(agentRunId) || isStarting || isResolvingRun}
                        isLoading={isLoadingConfiguration}
                    />
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
                        onRestart={(run) => setAgentRunId(run.id)}
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
                        initialToolApprovalMode="full_control"
                        hideObjectLinking
                        hideHeader
                        showRightPanel={false}
                        fullWidth
                        interactive
                    />
                )}
            </div>
        </div>
    );
}
