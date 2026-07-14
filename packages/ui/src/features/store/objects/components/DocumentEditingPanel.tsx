import type { ContentObject, CreateAgentRunPayload } from '@vertesia/common';
import {
    Button,
    Center,
    errorMessage,
    Modal,
    ResizableHandle,
    ResizablePanel,
    ResizablePanelGroup,
    Spinner,
    useToast,
    VTooltip,
} from '@vertesia/ui/core';
import { useUITranslation } from '@vertesia/ui/i18n';
import { useUserSession } from '@vertesia/ui/session';
import {
    ArtifactEditingSurface,
    diffWordSegments,
    isArtifactRefreshEvent,
    type MarkdownEditingAction,
} from '@vertesia/ui/widgets';
import { Check, FileText, GitCompareArrows, RefreshCw, RotateCcw, Save, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
    initialContent: string;
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
    'learn_artifact_operations',
];

function shortenRunId(id: string): string {
    return id.length > 12 ? `${id.slice(0, 4)}…${id.slice(-4)}` : id;
}

function getDocumentDraftPath(documentRootId: string): string {
    return `drafts/${documentRootId}.md`;
}

function createDocumentEditingPrompt(
    object: ContentObject,
    documentId: string,
    documentEtag: string | undefined,
    draftPath: string,
    userPrompt: string,
): string {
    const documentName = object.name || object.content?.name || 'Document';
    return [
        'You are collaborating with the user on one specific Markdown document in Vertesia.',
        `Canonical document: [${documentName}](store:${documentId})`,
        `Canonical base revision ID: ${documentId}`,
        `Canonical base ETag: ${documentEtag ?? 'unavailable'}`,
        `Working copy artifact: ${draftPath}`,
        '',
        'The working copy was hydrated and read before your first turn. It is the source of truth for this editing',
        'session. Apply requested changes only to that artifact using edit_artifact. Preserve all unrelated content',
        'exactly. User block edits may already be applied to the artifact; acknowledge them and continue from the',
        'current artifact generation. Attachments may contain review comments to apply in bulk.',
        '',
        'Do not call update_document, create_document, or write_artifact for this working copy. The user publishes',
        'the artifact back to the canonical document with the Save to document button, which enforces the base ETag.',
        '',
        `User request: ${userPrompt}`,
    ].join('\n');
}

function getErrorStatus(error: unknown): number | undefined {
    if (!error || typeof error !== 'object' || !('status' in error)) return undefined;
    return typeof error.status === 'number' ? error.status : undefined;
}

function DocumentWorkingCopyDiff({ original, workingCopy }: { original: string; workingCopy: string }) {
    const segments = useMemo(() => diffWordSegments(original, workingCopy), [original, workingCopy]);
    const counts = useMemo(
        () => ({
            added: segments.reduce((total, segment) => total + (segment.type === 'added' ? segment.text.length : 0), 0),
            removed: segments.reduce(
                (total, segment) => total + (segment.type === 'removed' ? segment.text.length : 0),
                0,
            ),
        }),
        [segments],
    );

    return (
        <div className="flex h-full min-h-0 flex-col bg-muted/10">
            <div className="flex shrink-0 items-center justify-end gap-3 border-b border-mixer-muted/20 px-5 py-2 text-xs">
                <span className="text-destructive">−{counts.removed}</span>
                <span className="text-success">+{counts.added}</span>
            </div>
            <div className="min-h-0 flex-1 overflow-auto p-5">
                <pre className="mx-auto max-w-5xl whitespace-pre-wrap break-words rounded-lg border border-mixer-muted/25 bg-background p-5 font-mono text-xs leading-6 shadow-sm">
                    {segments.map((segment, index) => {
                        if (segment.type === 'removed') {
                            return (
                                <del
                                    key={index}
                                    className="bg-mixer-destructive/15 text-destructive line-through decoration-destructive/50"
                                >
                                    {segment.text}
                                </del>
                            );
                        }
                        if (segment.type === 'added') {
                            return (
                                <ins key={index} className="bg-mixer-success/15 text-success no-underline">
                                    {segment.text}
                                </ins>
                            );
                        }
                        return <span key={index}>{segment.text}</span>;
                    })}
                </pre>
            </div>
        </div>
    );
}

export function DocumentEditingPanel({
    object,
    initialContent,
    onClose,
    onDocumentUpdated,
    sendMessageRef,
}: DocumentEditingPanelProps) {
    const { client, project, store, user } = useUserSession();
    const { t } = useUITranslation();
    const toast = useToast();
    const [agentRunId, setAgentRunId] = useState<string | undefined>();
    const [isStarting, setIsStarting] = useState(false);
    const [isTerminating, setIsTerminating] = useState(false);
    const [isResolvingRun, setIsResolvingRun] = useState(true);
    const [isLoadingConfiguration, setIsLoadingConfiguration] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [artifactRefresh, setArtifactRefresh] = useState<{
        key: number;
        details?: Record<string, unknown>;
    }>({ key: 0 });
    const [artifactContent, setArtifactContent] = useState(initialContent);
    const [artifactLoaded, setArtifactLoaded] = useState(false);
    const [originalContent, setOriginalContent] = useState(initialContent);
    const [savedContent, setSavedContent] = useState(initialContent);
    const [workspaceView, setWorkspaceView] = useState<'document' | 'diff'>('document');
    const [targetDocumentId, setTargetDocumentId] = useState(object.id);
    const [targetEtag, setTargetEtag] = useState(object.content?.etag);
    const [executionConfiguration, setExecutionConfiguration] = useState<DocumentEditingConfiguration>({});
    const configurationSourceRef = useRef<'none' | 'project' | 'run' | 'user'>('none');
    const seenUpdatesRef = useRef(new Set<string>());
    const documentRootId = object.revision?.root || object.id;
    const draftPath = useMemo(() => getDocumentDraftPath(documentRootId), [documentRootId]);
    const startedBy = user?.sub ? `user:${user.sub}` : undefined;
    const editingScopeKey = `${project?.id ?? 'no-project'}:${documentRootId}`;
    const editingScopeRef = useRef(editingScopeKey);
    const originalDocumentRef = useRef({ editingScopeKey, id: object.id });
    const lookupIdentityRef = useRef({ documentId: object.id, documentRootId });
    const isDirty = artifactLoaded && artifactContent !== savedContent;

    if (lookupIdentityRef.current.documentRootId !== documentRootId) {
        lookupIdentityRef.current = { documentId: object.id, documentRootId };
    }
    if (originalDocumentRef.current.editingScopeKey !== editingScopeKey) {
        originalDocumentRef.current = { editingScopeKey, id: object.id };
    }

    useEffect(() => {
        if (editingScopeRef.current === editingScopeKey) return;
        editingScopeRef.current = editingScopeKey;
        configurationSourceRef.current = 'none';
        setExecutionConfiguration({});
        seenUpdatesRef.current.clear();
        setArtifactContent(initialContent);
        setOriginalContent(initialContent);
        setSavedContent(initialContent);
        setArtifactLoaded(false);
        setWorkspaceView('document');
        setTargetDocumentId(object.id);
        setTargetEtag(object.content?.etag);
    }, [editingScopeKey, initialContent, object.content?.etag, object.id]);

    useEffect(() => {
        let cancelled = false;
        const requestScopeKey = editingScopeKey;
        const originalDocumentId = originalDocumentRef.current.id;

        void store.objects
            .getObjectText(originalDocumentId)
            .then((response) => {
                if (cancelled || originalDocumentRef.current.editingScopeKey !== requestScopeKey) return;
                if (typeof response.text !== 'string') return;
                const content = response.text;
                setOriginalContent(content);
                setSavedContent(content);
            })
            .catch((error: unknown) => {
                console.warn('Failed to load the original document for editing review', error);
            });

        return () => {
            cancelled = true;
        };
    }, [editingScopeKey, store.objects]);

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
            .catch((error: unknown) => {
                console.warn('Failed to load the default document editing model', error);
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
                    setExecutionConfiguration({ environment: run.config.environment, model: run.config.model });
                }
            })
            .catch((error: unknown) => {
                console.warn('Failed to look up an existing document editing run', error);
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
            .then(() => toast({ status: 'success', title: t('agent.runIdCopied'), duration: 2000 }))
            .catch((error: unknown) => console.warn('Failed to copy the agent run id', error));
    }, [agentRunId, t, toast]);

    const handleStartNewSession = useCallback(async () => {
        if (!agentRunId || isTerminating) return;
        setIsTerminating(true);
        try {
            await client.agents.terminate(agentRunId, 'cancel');
            toast({ status: 'success', title: t('agent.workflowCancelled'), duration: 2000 });
        } catch (error: unknown) {
            console.warn('Failed to terminate the document editing run', error);
        } finally {
            setIsTerminating(false);
        }
        seenUpdatesRef.current.clear();
        setAgentRunId(undefined);
        setArtifactLoaded(false);
        setArtifactContent(savedContent);
    }, [agentRunId, client.agents, isTerminating, savedContent, t, toast]);

    const startWorkflow = useCallback(
        async (initialMessage?: string, options?: StartWorkflowOptions) => {
            if (!project || isResolvingRun || isStarting || isLoadingConfiguration) return undefined;
            setIsStarting(true);
            try {
                if (!executionConfiguration.environment || !executionConfiguration.model) {
                    toast({ status: 'error', title: t('agent.documentEditingDefaultsRequired'), duration: 5000 });
                    return undefined;
                }

                const prompt = createDocumentEditingPrompt(
                    object,
                    targetDocumentId,
                    targetEtag,
                    draftPath,
                    initialMessage?.trim() || t('agent.documentEditingInitialRequest'),
                );
                const identity = createDocumentEditingRunIdentity(targetDocumentId, documentRootId);
                const payload: CreateAgentRunPayload<{ user_prompt: string }, DocumentEditingRunProperties> = {
                    interaction: 'sys:GeneralAgent',
                    interactive: true,
                    tool_approval_mode: options?.tool_approval_mode,
                    tool_names: DOCUMENT_EDITING_TOOLS,
                    initial_skills: ['artifact_operations'],
                    initial_tool_calls: [
                        {
                            id: 'hydrate-working-copy',
                            tool: 'fetch_document',
                            input: { id: targetDocumentId, mode: 'content', output_artifact: { path: draftPath } },
                        },
                        {
                            id: 'read-working-copy',
                            tool: 'read_artifact',
                            input: { path: draftPath },
                        },
                    ],
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
            } catch (error: unknown) {
                console.error('Failed to start document editing agent', error);
                toast({
                    status: 'error',
                    title: t('agent.documentEditingStartFailed'),
                    description: error instanceof Error ? error.message : undefined,
                    duration: 5000,
                });
                return undefined;
            } finally {
                setIsStarting(false);
            }
        },
        [
            client.agents,
            documentRootId,
            draftPath,
            executionConfiguration,
            isLoadingConfiguration,
            isResolvingRun,
            isStarting,
            object,
            project,
            startedBy,
            t,
            targetDocumentId,
            targetEtag,
            toast,
        ],
    );

    const handleArtifactContentChange = useCallback((content: string) => {
        setArtifactContent(content);
        setArtifactLoaded(true);
    }, []);

    const handleArtifactAction = useCallback(
        (action: MarkdownEditingAction) => {
            const sendMessage = sendMessageRef.current;
            if (!sendMessage) {
                toast({ status: 'warning', title: t('agent.artifactEditingUnavailable'), duration: 3000 });
                return;
            }
            const blockType = action.anchor.block_type.replaceAll('_', ' ');
            const displayMessage = action.comment?.trim() || t('agent.editedSelectionMessage', { blockType });
            sendMessage(displayMessage, { editing_action: action });
        },
        [sendMessageRef, t, toast],
    );

    const handleSave = useCallback(async () => {
        if (!artifactLoaded || !targetEtag || !isDirty || isSaving) return;
        setIsSaving(true);
        try {
            const contentType = object.content?.type || 'text/markdown';
            const fileName = object.content?.name || 'content.md';
            const file = new File([new Blob([artifactContent], { type: contentType })], fileName, {
                type: contentType,
            });
            const response = await store.objects.update(
                targetDocumentId,
                { content: file },
                { createRevision: true, ifMatch: targetEtag },
            );
            setTargetDocumentId(response.id);
            setTargetEtag(response.content?.etag);
            setSavedContent(artifactContent);
            onDocumentUpdated(response.id);
            toast({ status: 'success', title: t('store.textSaved'), duration: 2500 });
        } catch (error: unknown) {
            const isConflict = getErrorStatus(error) === 412;
            toast({
                status: 'error',
                title: t('store.errorSavingText'),
                description: isConflict
                    ? t('store.textConflict')
                    : errorMessage(error, t('store.errorSavingTextDefault')),
                duration: 5000,
            });
        } finally {
            setIsSaving(false);
        }
    }, [
        artifactContent,
        artifactLoaded,
        isDirty,
        isSaving,
        object.content?.name,
        object.content?.type,
        onDocumentUpdated,
        store.objects,
        t,
        targetDocumentId,
        targetEtag,
        toast,
    ]);

    return (
        <Modal
            isOpen
            onClose={onClose}
            size="full"
            noCloseButton
            disableCloseOnClickOutside
            className="gap-0 overflow-hidden p-0"
            description={t('agent.documentEditingWelcome')}
        >
            <div className="flex h-full min-h-0 flex-col">
                <div className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-mixer-muted/20 px-4">
                    <div className="min-w-0">
                        <div className="truncate font-semibold">{object.name || object.content?.name}</div>
                        <div className="flex items-center gap-1.5 text-xs text-muted">
                            {isDirty ? t('store.unsavedChanges') : t('store.textSaved')}
                            {!isDirty && artifactLoaded ? <Check className="size-3 text-success" /> : null}
                        </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                        {agentRunId ? (
                            <>
                                <VTooltip description={agentRunId} asChild>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="font-mono text-[11px] text-muted"
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
                            variant="primary"
                            size="lg"
                            className="min-w-40 gap-2"
                            onClick={() => void handleSave()}
                            disabled={!isDirty || !targetEtag || isSaving}
                        >
                            {isSaving ? <Spinner size="sm" /> : <Save className="size-4" />}
                            {t('agent.saveToDocument')}
                        </Button>
                        <Button variant="ghost" size="sm" onClick={onClose} aria-label={t('agent.close')}>
                            <X className="size-4" />
                        </Button>
                    </div>
                </div>
                <ResizablePanelGroup direction="horizontal" className="min-h-0 flex-1">
                    <ResizablePanel defaultSize={65} minSize={35} className="min-w-0 bg-background">
                        <div className="flex h-full min-h-0 flex-col">
                            <div className="flex shrink-0 items-center justify-between gap-4 border-b border-mixer-muted/20 bg-muted/10 px-4 py-2">
                                <div className="flex min-w-0 items-center gap-5 text-xs">
                                    <div className="min-w-0">
                                        <div className="font-medium text-foreground">{t('agent.workingCopy')}</div>
                                        <div className="truncate font-mono text-muted" title={draftPath}>
                                            {draftPath}
                                        </div>
                                    </div>
                                    <div className="hidden min-w-0 border-s border-mixer-muted/25 ps-5 md:block">
                                        <div className="font-medium text-foreground">{t('agent.originalDocument')}</div>
                                        <div
                                            className="truncate font-mono text-muted"
                                            title={originalDocumentRef.current.id}
                                        >
                                            {shortenRunId(originalDocumentRef.current.id)}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex shrink-0 items-center gap-2">
                                    <VTooltip description={t('agent.refresh')} asChild>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-8 gap-1.5"
                                            onClick={() => setArtifactRefresh((current) => ({ key: current.key + 1 }))}
                                            disabled={!agentRunId}
                                            aria-label={t('agent.refresh')}
                                        >
                                            <RefreshCw className="size-3.5" />
                                            {t('agent.refresh')}
                                        </Button>
                                    </VTooltip>
                                    <div className="flex items-center rounded-md border border-mixer-muted/25 bg-background p-0.5">
                                        <Button
                                            variant={workspaceView === 'document' ? 'secondary' : 'ghost'}
                                            size="sm"
                                            className="h-7 gap-1.5"
                                            onClick={() => setWorkspaceView('document')}
                                        >
                                            <FileText className="size-3.5" />
                                            {t('agent.document')}
                                        </Button>
                                        <Button
                                            variant={workspaceView === 'diff' ? 'secondary' : 'ghost'}
                                            size="sm"
                                            className="h-7 gap-1.5"
                                            onClick={() => setWorkspaceView('diff')}
                                            disabled={!artifactLoaded || artifactContent === originalContent}
                                        >
                                            <GitCompareArrows className="size-3.5" />
                                            {t('agent.reviewChanges')}
                                        </Button>
                                    </div>
                                </div>
                            </div>
                            <div className="min-h-0 flex-1">
                                {workspaceView === 'diff' ? (
                                    <DocumentWorkingCopyDiff original={originalContent} workingCopy={artifactContent} />
                                ) : (
                                    <ArtifactEditingSurface
                                        runId={agentRunId}
                                        path={draftPath}
                                        initialContent={initialContent}
                                        refreshKey={artifactRefresh.key}
                                        refreshDetails={artifactRefresh.details}
                                        onContentChange={handleArtifactContentChange}
                                        onAction={handleArtifactAction}
                                    />
                                )}
                            </div>
                        </div>
                    </ResizablePanel>
                    <ResizableHandle withHandle />
                    <ResizablePanel defaultSize={35} minSize={25} className="min-w-[320px]">
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
                                    const details = message.details as Record<string, unknown> | undefined;
                                    if (!isArtifactRefreshEvent(details, draftPath)) return;
                                    const updateKey = `${message.timestamp}:${details?.path}:${details?.generation ?? ''}`;
                                    if (seenUpdatesRef.current.has(updateKey)) return;
                                    seenUpdatesRef.current.add(updateKey);
                                    setArtifactRefresh((current) => ({
                                        key: current.key + 1,
                                        details,
                                    }));
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
                    </ResizablePanel>
                </ResizablePanelGroup>
            </div>
        </Modal>
    );
}
