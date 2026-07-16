import type { ContentObject, CreateAgentRunPayload } from '@vertesia/common';
import {
    Button,
    Center,
    ConfirmModal,
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
    type ArtifactEditingSurfaceDocumentEdit,
    createUnifiedLineDiff,
    diffWordSegments,
    isArtifactRefreshEvent,
    type MarkdownEditingAction,
} from '@vertesia/ui/widgets';
import {
    Check,
    FilePenLine,
    FileText,
    GitCompareArrows,
    ListChecks,
    RefreshCw,
    RotateCcw,
    Save,
    Send,
    X,
} from 'lucide-react';
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
import { persistRunLocalArtifactRefs } from './documentArtifactRefs.js';
import {
    createDocumentEditingRunIdentity,
    type DocumentEditingRunProperties,
    findDocumentEditingRun,
} from './documentEditingRun.js';
import { resolveDocumentEditingTarget } from './documentEditingTarget.js';

interface DocumentEditingPanelProps {
    object: ContentObject;
    initialContent: string;
    onClose: () => void;
    onDocumentUpdated: (updatedDocumentId: string) => void;
    sendMessageRef: React.MutableRefObject<SendAgentMessageFn | null>;
}

export interface DocumentEditingWorkspaceProps {
    /** Document to edit (any revision); the workspace resolves and targets the head revision. */
    object: ContentObject;
    /** Known document text shown while the working copy hydrates. */
    initialContent?: string;
    /** Called with the id of each revision created by Save to document. */
    onDocumentUpdated?: (updatedDocumentId: string) => void;
    /** When provided, a close button is rendered in the workspace header. */
    onClose?: () => void;
    /** Optional external handle to send chat messages programmatically. */
    sendMessageRef?: React.MutableRefObject<SendAgentMessageFn | null>;
}

const DOCUMENT_EDITING_TOOLS = [
    'ask_user',
    'think',
    'plan',
    'update_plan',
    'end_conversation',
    'learn_artifact_operations',
    // Read access to canonical revisions: reconcile-after-conflict and change
    // summaries fetch other revisions into reference artifacts for comparison.
    'fetch_document',
];

// Editing sessions mutate only the working-copy artifact; the canonical document is
// published exclusively through Save to document. These tools stay unavailable even
// if a skill or tool refresh would otherwise unlock them.
const DOCUMENT_EDITING_EXCLUDED_TOOLS = [
    'update_document',
    'update_document_properties',
    'create_document',
    'set_document_type',
    'merge_documents',
    'import_file',
    'create_or_update_object_type',
    'disable_type',
    'execute_shell',
    'batch_execute',
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
        'Images: never inline image data as base64 data URIs — it bloats the document and cannot be reliably edited.',
        "Keep existing image references (e.g. 'artifact:documents/…' URLs) exactly as they are: they point to durable",
        "storage that outlives this session. Files already in this run's artifact space may be referenced with",
        "run-local links like 'artifact:files/photo.png' — publishing copies them into durable storage and rewrites",
        'the links automatically.',
        '',
        `User request: ${userPrompt}`,
    ].join('\n');
}

/** Chat prompt asking the agent to merge external canonical changes into the working copy. */
export function createDocumentReconcilePrompt(
    documentRootId: string,
    headDocumentId: string,
    draftPath: string,
): string {
    return [
        'The canonical document was updated outside this session, so publishing the working copy was rejected.',
        `1) Fetch the latest canonical revision ${headDocumentId} with fetch_document into 'drafts/${documentRootId}.theirs.md'.`,
        `2) Compare it with the working copy '${draftPath}' and merge the external changes into the working copy with edit_artifact, preserving this session's edits.`,
        '3) Reply with a short list of what was merged, plus any conflicting passages and how you resolved them, so I can review before saving again.',
    ].join('\n');
}

// Above this size a diff stops being cheaper than re-reading; fall back to the read-the-artifact notice.
const DIRECT_EDITS_DIFF_MAX_CHARS = 4000;

/** Chat notice handing the agent the exact delta of direct editor edits, already applied to the working copy. */
export function createDirectEditsAppliedPrompt(draftPath: string, unifiedDiff: string): string {
    return [
        `I edited the working copy '${draftPath}' directly in the editor. The changes below are already applied —`,
        'do not re-apply them. Treat the artifact as the current source of truth.',
        '```diff',
        unifiedDiff,
        '```',
    ].join('\n');
}

/** Chat prompt asking the agent for a changelog of the working copy vs the session baseline. */
export function createDocumentChangeSummaryPrompt(
    documentRootId: string,
    originalDocumentId: string,
    draftPath: string,
): string {
    return [
        `Summarize the changes in the working copy '${draftPath}' relative to the original document revision ${originalDocumentId}.`,
        `If you no longer have the original content, fetch it with fetch_document into 'drafts/${documentRootId}.base.md'.`,
        'Do not modify the working copy.',
        'Reply with a concise changelog: grouped bullets, most important first, suitable for a revision note.',
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

/**
 * Full document editing workspace: working copy surface plus the editing conversation.
 * Standalone so host applications can embed it in their own layout; DocumentEditingPanel
 * wraps it in a full-screen modal for the Studio object page.
 */
export function DocumentEditingWorkspace({
    object,
    initialContent = '',
    onDocumentUpdated,
    onClose,
    sendMessageRef,
}: DocumentEditingWorkspaceProps) {
    const { client, project, store, user } = useUserSession();
    const { t } = useUITranslation();
    const toast = useToast();
    const internalSendMessageRef = useRef<SendAgentMessageFn | null>(null);
    const messageRef = sendMessageRef ?? internalSendMessageRef;
    const [agentRunId, setAgentRunId] = useState<string | undefined>();
    const [isStarting, setIsStarting] = useState(false);
    const [isTerminating, setIsTerminating] = useState(false);
    const [isResolvingRun, setIsResolvingRun] = useState(true);
    const [isResolvingTarget, setIsResolvingTarget] = useState(true);
    const [targetResolutionFailed, setTargetResolutionFailed] = useState(false);
    const [targetResolutionAttempt, setTargetResolutionAttempt] = useState(0);
    const [showNewSessionConfirm, setShowNewSessionConfirm] = useState(false);
    const [isLoadingConfiguration, setIsLoadingConfiguration] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isSendingChanges, setIsSendingChanges] = useState(false);
    const [hasDirectEditorChanges, setHasDirectEditorChanges] = useState(false);
    const [artifactRefresh, setArtifactRefresh] = useState<{
        key: number;
        details?: Record<string, unknown>;
    }>({ key: 0 });
    const [artifactContent, setArtifactContent] = useState(initialContent);
    const [artifactLoaded, setArtifactLoaded] = useState(false);
    const [originalContent, setOriginalContent] = useState(initialContent);
    const [savedContent, setSavedContent] = useState(initialContent);
    const [workspaceView, setWorkspaceView] = useState<'document' | 'editor' | 'diff'>('document');
    const [saveConflict, setSaveConflict] = useState<{ headId: string } | undefined>();
    const [targetDocumentId, setTargetDocumentId] = useState(object.id);
    const [targetEtag, setTargetEtag] = useState(object.content?.etag);
    const [executionConfiguration, setExecutionConfiguration] = useState<DocumentEditingConfiguration>({});
    const configurationSourceRef = useRef<'none' | 'project' | 'run' | 'user'>('none');
    const seenUpdatesRef = useRef(new Set<string>());
    const artifactGenerationRef = useRef<string | undefined>(undefined);
    const flushArtifactChangesRef = useRef<(() => Promise<false | ArtifactEditingSurfaceDocumentEdit>) | null>(null);
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
        setHasDirectEditorChanges(false);
        setWorkspaceView('document');
        setTargetDocumentId(object.id);
        setTargetEtag(object.content?.etag);
    }, [editingScopeKey, initialContent, object.content?.etag, object.id]);

    useEffect(() => {
        let cancelled = false;
        const requestScopeKey = editingScopeKey;
        const requestedDocumentId = originalDocumentRef.current.id;
        setIsResolvingTarget(true);
        setTargetResolutionFailed(false);

        // Commit the target id, ETag, and text only after all reads succeed. A failed
        // head lookup must never turn a historical revision into an editable fallback.
        void resolveDocumentEditingTarget(store.objects, requestedDocumentId)
            .then((target) => {
                if (cancelled || originalDocumentRef.current.editingScopeKey !== requestScopeKey) return;

                originalDocumentRef.current = { editingScopeKey: requestScopeKey, id: target.id };
                lookupIdentityRef.current = { documentId: target.id, documentRootId };
                setTargetDocumentId(target.id);
                setTargetEtag(target.etag);
                setOriginalContent(target.content);
                setSavedContent(target.content);
            })
            .catch((error: unknown) => {
                console.warn('Failed to resolve the document editing target', {
                    error,
                    attempt: targetResolutionAttempt,
                });
                if (!cancelled && originalDocumentRef.current.editingScopeKey === requestScopeKey) {
                    setTargetResolutionFailed(true);
                }
            })
            .finally(() => {
                if (!cancelled && originalDocumentRef.current.editingScopeKey === requestScopeKey) {
                    setIsResolvingTarget(false);
                }
            });

        return () => {
            cancelled = true;
        };
    }, [documentRootId, editingScopeKey, store.objects, targetResolutionAttempt]);

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
        setHasDirectEditorChanges(false);
    }, [agentRunId, client.agents, isTerminating, savedContent, t, toast]);

    const startWorkflow = useCallback(
        async (initialMessage?: string, options?: StartWorkflowOptions) => {
            if (
                !project ||
                isResolvingRun ||
                isResolvingTarget ||
                targetResolutionFailed ||
                isStarting ||
                isLoadingConfiguration
            ) {
                return undefined;
            }
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
                    excluded_tools: DOCUMENT_EDITING_EXCLUDED_TOOLS,
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
            isResolvingTarget,
            isStarting,
            object,
            project,
            startedBy,
            t,
            targetDocumentId,
            targetEtag,
            targetResolutionFailed,
            toast,
        ],
    );

    const handleArtifactContentChange = useCallback((content: string, generation?: string) => {
        artifactGenerationRef.current = generation;
        setArtifactContent(content);
        setArtifactLoaded(true);
    }, []);

    const handleArtifactAction = useCallback(
        (action: MarkdownEditingAction) => {
            const sendMessage = messageRef.current;
            if (!sendMessage) {
                toast({ status: 'warning', title: t('agent.artifactEditingUnavailable'), duration: 3000 });
                return;
            }
            const blockType = action.anchor.block_type.replaceAll('_', ' ');
            const displayMessage = action.comment?.trim() || t('agent.editedSelectionMessage', { blockType });
            sendMessage(displayMessage, { editing_action: action });
        },
        [messageRef, t, toast],
    );

    const handleSave = useCallback(async () => {
        if (!artifactLoaded || !targetEtag || !isDirty || isSaving || isResolvingTarget || targetResolutionFailed) {
            return;
        }
        setIsSaving(true);
        try {
            // Persist run-local artifact references (session-generated charts, files)
            // into durable documents/ storage and rewrite the links before publishing —
            // the same pass create_document applies. Run artifact storage does not
            // outlive the session, so the canonical document must never depend on it.
            let contentToSave = artifactContent;
            if (agentRunId) {
                const persistence = await persistRunLocalArtifactRefs(
                    client.files,
                    contentToSave,
                    agentRunId,
                    crypto.randomUUID(),
                );
                contentToSave = persistence.content;
            }

            const contentType = object.content?.type || 'text/markdown';
            const fileName = object.content?.name || 'content.md';
            const file = new File([new Blob([contentToSave], { type: contentType })], fileName, {
                type: contentType,
            });
            const response = await store.objects.update(
                targetDocumentId,
                { content: file },
                { createRevision: true, ifMatch: targetEtag },
            );
            setTargetDocumentId(response.id);
            setTargetEtag(response.content?.etag);
            setSavedContent(contentToSave);
            setSaveConflict(undefined);
            onDocumentUpdated?.(response.id);
            toast({ status: 'success', title: t('store.textSaved'), duration: 2500 });

            // Sync the rewritten links back into the working copy so it matches the
            // published revision. A concurrent agent edit (412) just leaves the copy
            // dirty, which is accurate — it no longer matches what was published.
            if (agentRunId && contentToSave !== artifactContent && artifactGenerationRef.current) {
                try {
                    await client.agents.updateArtifactContent(agentRunId, draftPath, {
                        content: contentToSave,
                        generation: artifactGenerationRef.current,
                    });
                    setArtifactRefresh((current) => ({ key: current.key + 1 }));
                } catch (syncError: unknown) {
                    console.warn('Failed to sync persisted artifact links into the working copy', syncError);
                }
            }
        } catch (error: unknown) {
            // Two conflict shapes: an in-place edit of the target revision fails the
            // If-Match precondition (412), while a new external revision moves the head
            // and the save is rejected as not-head (400). Both mean the canonical
            // document changed since this session's baseline.
            const status = getErrorStatus(error);
            let isConflict = status === 412;
            if (status === 412 || status === 400) {
                try {
                    const target = await resolveDocumentEditingTarget(store.objects, targetDocumentId);
                    if (target.id !== targetDocumentId || status === 412) {
                        isConflict = true;
                        // Re-point the save target at the new head so the user can choose
                        // to overwrite it, and offer an agent-assisted merge instead.
                        setTargetDocumentId(target.id);
                        setTargetEtag(target.etag);
                        setSaveConflict({ headId: target.id });
                    }
                } catch (resolveError: unknown) {
                    console.warn('Failed to resolve the new head after a save conflict', resolveError);
                }
            }
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
        agentRunId,
        artifactContent,
        artifactLoaded,
        client.agents,
        client.files,
        draftPath,
        isDirty,
        isResolvingTarget,
        isSaving,
        object.content?.name,
        object.content?.type,
        onDocumentUpdated,
        store.objects,
        t,
        targetDocumentId,
        targetEtag,
        targetResolutionFailed,
        toast,
    ]);

    const handleReconcile = useCallback(() => {
        const sendMessage = messageRef.current;
        if (!sendMessage || !saveConflict) {
            toast({ status: 'warning', title: t('agent.artifactEditingUnavailable'), duration: 3000 });
            return;
        }
        sendMessage(createDocumentReconcilePrompt(documentRootId, saveConflict.headId, draftPath));
        setSaveConflict(undefined);
        setWorkspaceView('document');
    }, [documentRootId, draftPath, messageRef, saveConflict, t, toast]);

    const handleSummarizeChanges = useCallback(() => {
        const sendMessage = messageRef.current;
        if (!sendMessage) {
            toast({ status: 'warning', title: t('agent.artifactEditingUnavailable'), duration: 3000 });
            return;
        }
        sendMessage(createDocumentChangeSummaryPrompt(documentRootId, originalDocumentRef.current.id, draftPath));
    }, [documentRootId, draftPath, messageRef, t, toast]);

    const handleSendChangesToAgent = useCallback(async () => {
        const sendMessage = messageRef.current;
        if (!sendMessage || !agentRunId || isSendingChanges) {
            toast({ status: 'warning', title: t('agent.artifactEditingUnavailable'), duration: 3000 });
            return;
        }

        setIsSendingChanges(true);
        try {
            const flushed = await flushArtifactChangesRef.current?.();
            if (!flushed) return;
            // Hand the agent the exact delta so it doesn't burn a turn re-reading the
            // artifact to discover what changed; oversized deltas fall back to that.
            const diff = createUnifiedLineDiff(flushed.previous, flushed.current, {
                context: 2,
                maxChars: DIRECT_EDITS_DIFF_MAX_CHARS,
            });
            sendMessage(
                diff
                    ? createDirectEditsAppliedPrompt(draftPath, diff)
                    : t('agent.directEditsReadyMessage', { path: draftPath }),
            );
            setHasDirectEditorChanges(false);
            toast({ status: 'success', title: t('agent.changesSentToAgent'), duration: 2000 });
        } finally {
            setIsSendingChanges(false);
        }
    }, [agentRunId, draftPath, isSendingChanges, messageRef, t, toast]);

    return (
        <div className="flex h-full min-h-0 flex-col">
            <div className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-mixer-muted/20 px-4">
                <div className="min-w-0">
                    <div className="truncate font-semibold">{object.name || object.content?.name}</div>
                    <div className="flex items-center gap-2 text-xs text-muted">
                        <span className="flex shrink-0 items-center gap-1.5">
                            {isDirty ? (
                                <span aria-hidden className="size-1.5 rounded-full bg-attention" />
                            ) : artifactLoaded ? (
                                <Check className="size-3 text-success" />
                            ) : null}
                            {isDirty ? t('store.unsavedChanges') : t('store.textSaved')}
                        </span>
                        <span aria-hidden className="text-mixer-muted/60">
                            ·
                        </span>
                        <VTooltip description={`${t('agent.workingCopy')}: ${draftPath}`} asChild>
                            <span className="min-w-0 truncate font-mono">drafts/{shortenRunId(documentRootId)}.md</span>
                        </VTooltip>
                        <span aria-hidden className="text-mixer-muted/60">
                            ·
                        </span>
                        <VTooltip
                            description={`${t('agent.originalDocument')}: ${originalDocumentRef.current.id}`}
                            asChild
                        >
                            <span className="shrink-0 font-mono">
                                {t('agent.originalDocument').toLowerCase()}{' '}
                                {shortenRunId(originalDocumentRef.current.id)}
                            </span>
                        </VTooltip>
                    </div>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                    <div className="flex items-center rounded-md border border-mixer-muted/25 bg-muted/10 p-0.5">
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
                            variant={workspaceView === 'editor' ? 'secondary' : 'ghost'}
                            size="sm"
                            className="h-7 gap-1.5"
                            onClick={() => setWorkspaceView('editor')}
                        >
                            <FilePenLine className="size-3.5" />
                            {t('agent.fullEditor')}
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
                    {workspaceView === 'diff' ? (
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 gap-1.5"
                            onClick={handleSummarizeChanges}
                            disabled={!artifactLoaded || artifactContent === originalContent}
                        >
                            <ListChecks className="size-3.5" />
                            {t('agent.summarizeChanges')}
                        </Button>
                    ) : null}
                    {workspaceView === 'editor' ? (
                        <Button
                            variant="secondary"
                            size="sm"
                            className="h-8 gap-1.5"
                            onClick={() => void handleSendChangesToAgent()}
                            disabled={!agentRunId || !isDirty || !hasDirectEditorChanges || isSendingChanges}
                        >
                            {isSendingChanges ? <Spinner size="sm" /> : <Send className="size-3.5" />}
                            {t('agent.sendChangesToAgent')}
                        </Button>
                    ) : null}
                    <VTooltip description={t('agent.refresh')} asChild>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setArtifactRefresh((current) => ({ key: current.key + 1 }))}
                            disabled={!agentRunId}
                            aria-label={t('agent.refresh')}
                        >
                            <RefreshCw className="size-4" />
                        </Button>
                    </VTooltip>
                    <div aria-hidden className="mx-1 h-6 w-px bg-mixer-muted/25" />
                    <DocumentEditingConfigurationSelector
                        value={executionConfiguration}
                        onChange={handleConfigurationChange}
                        disabled={Boolean(agentRunId) || isStarting || isResolvingRun}
                        isLoading={isLoadingConfiguration}
                    />
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
                                    onClick={() => {
                                        if (isDirty) {
                                            setShowNewSessionConfirm(true);
                                        } else {
                                            void handleStartNewSession();
                                        }
                                    }}
                                    disabled={isTerminating}
                                    aria-label={t('agent.startNewConversation')}
                                >
                                    <RotateCcw className="size-4" />
                                </Button>
                            </VTooltip>
                        </>
                    ) : null}
                    <div aria-hidden className="mx-1 h-6 w-px bg-mixer-muted/25" />
                    <Button
                        variant="primary"
                        className="min-w-36 gap-2"
                        onClick={() => void handleSave()}
                        disabled={!isDirty || !targetEtag || isSaving || isResolvingTarget || targetResolutionFailed}
                    >
                        {isSaving ? <Spinner size="sm" /> : <Save className="size-4" />}
                        {t('agent.saveToDocument')}
                    </Button>
                    {onClose ? (
                        <Button variant="ghost" size="sm" onClick={onClose} aria-label={t('agent.close')}>
                            <X className="size-4" />
                        </Button>
                    ) : null}
                </div>
            </div>
            {saveConflict ? (
                <div className="flex shrink-0 items-center justify-between gap-3 border-b border-mixer-attention/30 bg-mixer-attention/10 px-4 py-2 text-sm">
                    <span className="min-w-0 truncate text-attention">{t('agent.saveConflictNotice')}</span>
                    <div className="flex shrink-0 items-center gap-2">
                        <Button variant="outline" size="sm" onClick={handleReconcile}>
                            {t('agent.askAgentToReconcile')}
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSaveConflict(undefined)}
                            aria-label={t('agent.close')}
                        >
                            <X className="size-4" />
                        </Button>
                    </div>
                </div>
            ) : null}
            <ResizablePanelGroup direction="horizontal" className="min-h-0 flex-1">
                <ResizablePanel defaultSize={65} minSize={35} className="min-w-0 bg-background">
                    <div className="flex h-full min-h-0 flex-col">
                        <div className="min-h-0 flex-1">
                            {workspaceView === 'diff' ? (
                                <DocumentWorkingCopyDiff original={originalContent} workingCopy={artifactContent} />
                            ) : (
                                <ArtifactEditingSurface
                                    runId={agentRunId}
                                    path={draftPath}
                                    viewMode={workspaceView === 'editor' ? 'document' : 'components'}
                                    baselineContent={originalContent}
                                    initialContent={savedContent}
                                    refreshKey={artifactRefresh.key}
                                    refreshDetails={artifactRefresh.details}
                                    onContentChange={handleArtifactContentChange}
                                    onAction={handleArtifactAction}
                                    onDocumentEdit={() => setHasDirectEditorChanges(true)}
                                    flushChangesRef={flushArtifactChangesRef}
                                />
                            )}
                        </div>
                    </div>
                </ResizablePanel>
                <ResizableHandle withHandle />
                <ResizablePanel defaultSize={35} minSize={25} className="min-w-[320px]">
                    {isResolvingRun || isResolvingTarget ? (
                        <Center className="h-full">
                            <Spinner size="lg" />
                        </Center>
                    ) : targetResolutionFailed ? (
                        <Center className="h-full flex-col gap-3 px-6 text-center">
                            <div className="text-sm text-muted">{t('agent.failedToLoadDocument')}</div>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setTargetResolutionAttempt((attempt) => attempt + 1)}
                            >
                                {t('agent.retry')}
                            </Button>
                        </Center>
                    ) : (
                        <ModernAgentConversation
                            agentRunId={agentRunId}
                            startWorkflow={startWorkflow}
                            resetWorkflow={() => setAgentRunId(undefined)}
                            onRestart={(run) => setAgentRunId(run.id)}
                            sendMessageRef={messageRef}
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
            <ConfirmModal
                isOpen={showNewSessionConfirm}
                title={t('agent.newSessionDiscardTitle')}
                content={t('agent.newSessionDiscardDescription')}
                onConfirm={() => {
                    setShowNewSessionConfirm(false);
                    void handleStartNewSession();
                }}
                onCancel={() => setShowNewSessionConfirm(false)}
            />
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
    const { t } = useUITranslation();
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
            <DocumentEditingWorkspace
                object={object}
                initialContent={initialContent}
                onClose={onClose}
                onDocumentUpdated={onDocumentUpdated}
                sendMessageRef={sendMessageRef}
            />
        </Modal>
    );
}
