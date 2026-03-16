import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Bot, Cpu, FileTextIcon, SendIcon, UploadIcon, XIcon } from "lucide-react";
import { useUserSession } from "@vertesia/ui/session";
import {
    ActiveWorkstreamEntry,
    AgentMessage,
    AgentMessageType,
    AgentRun,
    ConversationFile,
    ConversationFileRef,
    Plan,
    UserInputSignal,
} from "@vertesia/common";
import { FusionFragmentProvider } from "@vertesia/fusion-ux";
import { Button, cn, MessageBox, Spinner, useToast, Modal, ModalBody, ModalFooter, ModalTitle } from "@vertesia/ui/core";

import { AnimatedThinkingDots, PulsatingCircle } from "./AnimatedThinkingDots";
import { type AgentConversationViewMode } from "./ModernAgentOutput/AllMessagesMixed";
import { type BatchProgressPanelClassNames } from "./ModernAgentOutput/BatchProgressPanel";
import { type MessageItemClassNames } from "./ModernAgentOutput/MessageItem";
import { type StreamingMessageClassNames } from "./ModernAgentOutput/StreamingMessage";
import { type ToolCallGroupClassNames } from "./ModernAgentOutput/ToolCallGroup";
import { ImageLightboxProvider } from "./ImageLightbox";
import AllMessagesMixed from "./ModernAgentOutput/AllMessagesMixed";
import Header from "./ModernAgentOutput/Header";
import MessageInput, { UploadedFile, SelectedDocument } from "./ModernAgentOutput/MessageInput";
import { getConversationUrl, getWorkstreamId } from "./ModernAgentOutput/utils";
import { ThinkingMessages } from "./WaitingMessages";
import { SkillWidgetProvider } from "./SkillWidgetProvider";
import { ArtifactUrlCacheProvider } from "./useArtifactUrlCache.js";
import { useUITranslation } from "../../../i18n/index.js";
import { VegaLiteChart } from "./VegaLiteChart";
import { AgentRightPanel, type WorkstreamInfo } from "./AgentRightPanel.js";
import { useAgentStream } from "./hooks/useAgentStream.js";
import { useAgentPlans } from "./hooks/useAgentPlans.js";
import { useDocumentPanel } from "./hooks/useDocumentPanel.js";
import { useFileProcessing } from "./hooks/useFileProcessing.js";

export type StartWorkflowFn = (
    initialMessage?: string,
) => Promise<{ agent_run_id: string } | undefined>;

function printElementToPdf(sourceElement: HTMLElement, title: string): boolean {
    if (typeof window === "undefined" || typeof document === "undefined") {
        return false;
    }

    // Use a hidden iframe to avoid opening a new window
    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    iframe.style.visibility = "hidden";
    document.body.appendChild(iframe);

    const iframeWindow = iframe.contentWindow;
    if (!iframeWindow) {
        iframe.parentNode?.removeChild(iframe);
        return false;
    }

    const doc = iframeWindow.document;
    doc.open();
    doc.write(`<!doctype html><html><head><title>${title}</title></head><body></body></html>`);
    doc.close();
    doc.title = title;

    const styles = document.querySelectorAll<HTMLLinkElement | HTMLStyleElement>("link[rel=\"stylesheet\"], style");
    styles.forEach((node) => {
        doc.head.appendChild(node.cloneNode(true));
    });

    doc.body.innerHTML = sourceElement.innerHTML;
    iframeWindow.focus();
    iframeWindow.print();

    setTimeout(() => {
        iframe.parentNode?.removeChild(iframe);
    }, 1000);

    return true;
}

interface ModernAgentConversationProps {
    /** Stable AgentRun ID — the primary identifier for all runtime operations. */
    agentRunId?: string;
    title?: string;
    interactive?: boolean;
    onClose?: () => void;
    isModal?: boolean;
    fullWidth?: boolean;
    initialMessage?: string;
    startWorkflow?: StartWorkflowFn;
    startButtonText?: string;
    placeholder?: string;
    hideUserInput?: boolean;
    resetWorkflow?: () => void;
    /** Called after a restart succeeds — receives the new AgentRun for navigation */
    onRestart?: (newRun: AgentRun) => void;
    /** Called after a fork succeeds — receives the new AgentRun for navigation */
    onFork?: (newRun: AgentRun) => void;
    /** Called to show run details/internals modal */
    onShowDetails?: () => void;

    // File upload props - passed through to MessageInput
    /** Called when files are dropped/pasted/selected */
    onFilesSelected?: (files: File[]) => void;
    /** Currently uploaded files to display */
    uploadedFiles?: UploadedFile[];
    /** Called when user removes an uploaded file */
    onRemoveFile?: (fileId: string) => void;
    /** Accepted file types (e.g., ".pdf,.doc,.png") */
    acceptedFileTypes?: string;
    /** Max number of files allowed */
    maxFiles?: number;

    /** Ref populated with the internal file upload handler for external triggering */
    fileUploadRef?: React.MutableRefObject<((files: File[]) => void) | null>;
    /** Called when processingFiles state changes (for external progress display) */
    onProcessingFilesChange?: (files: Map<string, ConversationFile>) => void;
    /** Processing files to display in the right panel Uploads tab */
    processingFiles?: Map<string, ConversationFile>;
    /** Called when plans change (for external plan panel) */
    onPlansChange?: (plans: Array<{ plan: Plan; timestamp: number }>, activePlanIndex: number) => void;
    /** Called when workstream status changes (for external plan panel) */
    onWorkstreamStatusChange?: (statusMap: Map<number, Map<string, "pending" | "in_progress" | "completed" | "skipped">>) => void;

    /** Controlled view mode — when provided, overrides internal state */
    viewMode?: AgentConversationViewMode;
    /** Called when view mode changes (for external control) */
    onViewModeChange?: (mode: AgentConversationViewMode) => void;
    /** Called when follow-up input availability is determined (after messages load) */
    onShowInputChange?: (canSendFollowUp: boolean) => void;
    /** Ref populated with the stop handler — call to interrupt the active agent. null when stop unavailable. */
    stopRef?: React.MutableRefObject<(() => void) | null>;
    /** Called when the stopping (in-progress) state changes */
    onStoppingChange?: (isStopping: boolean) => void;

    // Document search props (render prop for custom search UI)
    /** Render custom document search UI - if provided, shows search button */
    renderDocumentSearch?: (props: {
        isOpen: boolean;
        onClose: () => void;
        onSelect: (doc: SelectedDocument) => void;
    }) => React.ReactNode;
    /** Currently selected documents from search */
    selectedDocuments?: SelectedDocument[];
    /** Called when user removes a selected document */
    onRemoveDocument?: (docId: string) => void;

    // Hide the default object linking (for apps that don't use it)
    hideObjectLinking?: boolean;
    /** Hide the internal header (for apps that render their own) */
    hideHeader?: boolean;
    /** Hide the internal message input (for apps that render their own) */
    hideMessageInput?: boolean;
    /** Hide the internal plan panel (for apps that render their own) */
    hidePlanPanel?: boolean;
    /** Hide workstream tabs */
    hideWorkstreamTabs?: boolean;
    /** Enable or disable the internal right panel (plan/workstreams/documents/uploads) */
    showRightPanel?: boolean;
    /** Hide the default file upload */
    hideFileUpload?: boolean;
    /** Show the Artifacts tab in the right panel (default false) */
    showArtifacts?: boolean;
    /** Hide the document preview panel that auto-opens on create_document */
    hideDocumentPanel?: boolean;

    // Callback to get attached documents when sending messages
    // Returns array of { id, name } to include in message metadata and display
    getAttachedDocs?: () => SelectedDocument[];
    // Called after attachments are sent to allow clearing them
    onAttachmentsSent?: () => void;
    // Whether files are currently being uploaded - disables send/start buttons
    isUploading?: boolean;
    // Callback to get additional context metadata to include in every message
    // Returns object with context like { fundId, fundName } to include in signal metadata
    getMessageContext?: () => Record<string, unknown> | undefined;

    // Styling props for Tailwind customization - passed through to MessageInput
    /** Additional className for the MessageInput container */
    inputContainerClassName?: string;
    /** Additional className for the input field */
    inputClassName?: string;

    /** Additional className for the root container */
    className?: string;

    messageItemClassNames?: MessageItemClassNames;
    /** Sparse MESSAGE_STYLES overrides passed to every MessageItem */
    messageStyleOverrides?: import("./ModernAgentOutput/MessageItem").MessageItemProps['messageStyleOverrides'];
    toolCallGroupClassNames?: ToolCallGroupClassNames;
    /** Hide ToolCallGroup in this view mode */
    hideToolCallsInViewMode?: AgentConversationViewMode[];
    streamingMessageClassNames?: StreamingMessageClassNames;
    batchProgressPanelClassNames?: BatchProgressPanelClassNames;

    /** className override for the working indicator container */
    workingIndicatorClassName?: string;
    /** className override for the message list container */
    messageListClassName?: string;
    /** Custom component to render store/document links instead of default NavLink navigation */
    StoreLinkComponent?: React.ComponentType<{ href: string; documentId: string; children: React.ReactNode }>;
    /** Custom component to render store/collection links instead of default NavLink navigation */
    CollectionLinkComponent?: React.ComponentType<{ href: string; collectionId: string; children: React.ReactNode }>;

    /** Optional message to display as the first user message in the conversation.
     *  Purely visual/UI — not sent to temporal. Renders as a QUESTION MessageItem before real messages. */
    prependFriendlyMessage?: string;

    // Fusion fragment props
    /**
     * Data to provide to fusion-fragment code blocks for rendering.
     * When provided, fusion-fragments in agent responses will display
     * this data according to their template structure.
     * @example { fundName: "Tech Growth IV", vintage: 2024, totalCommitments: 500000000 }
     */
    fusionData?: Record<string, unknown>;

    /** Optional payload content to show as a "Payload" tab in the right panel */
    payloadContent?: React.ReactNode;
    /** Optional conversation content to show as a "Conversation" tab in the right panel */
    conversationContent?: React.ReactNode;
    /** When true, renders the conversation inside the right panel as a "Conversation" tab */
    conversationTab?: boolean;
}

export function ModernAgentConversation(
    props: ModernAgentConversationProps,
) {
    const { agentRunId, startWorkflow } = props;

    if (agentRunId) {
        return (
            <SkillWidgetProvider>
                <ModernAgentConversationInner {...props} agentRunId={agentRunId} />
            </SkillWidgetProvider>
        );
    } else if (startWorkflow) {
        // If we have startWorkflow capability but no agentRunId yet
        return <StartWorkflowView {...props} />;
    } else {
        // Empty state
        return <EmptyState />;
    }
}

// Empty state when no agent is running
function EmptyState() {
    const { t } = useUITranslation();
    return (
        <MessageBox
            status="info"
            icon={<Bot className="size-16 text-muted mb-4" />}
        >
            <div className="text-base font-medium text-muted">
                {t('agent.noAgentRunning')}
            </div>
            <div className="mt-3 text-sm text-muted">
                {t('agent.selectInteraction')}
            </div>
        </MessageBox>
    );
}

// Start workflow view - allows initiating a new agent conversation
// Files can be staged locally before workflow starts, then uploaded when the workflow is created
function StartWorkflowView({
    initialMessage,
    startWorkflow,
    onClose,
    isModal = false,
    fullWidth = false,
    placeholder,
    startButtonText,
    title,
    // Attachment callback - used to include existing document attachments in the first message
    getAttachedDocs,
    onAttachmentsSent,
    // File upload props
    acceptedFileTypes,
    maxFiles = 5,
}: ModernAgentConversationProps) {
    const { t } = useUITranslation();
    const resolvedPlaceholder = placeholder ?? t('agent.typeYourMessage');
    const resolvedStartButtonText = startButtonText ?? t('agent.startAgent');
    const resolvedTitle = title ?? t('agent.startNewConversation');
    const { client } = useUserSession();
    const [inputValue, setInputValue] = useState<string>("");
    const [isSending, setIsSending] = useState(false);
    const [startedAgentRunId, setStartedAgentRunId] = useState<string | null>(null);
    const toast = useToast();
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Staged files - stored locally until workflow starts
    const [stagedFiles, setStagedFiles] = useState<File[]>([]);

    // Drag and drop state
    const [isDragOver, setIsDragOver] = useState(false);
    const dragCounterRef = useRef(0);

    // Drag and drop handlers for file staging
    const handleDragEnter = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        dragCounterRef.current++;
        if (e.dataTransfer?.types?.includes('Files')) {
            setIsDragOver(true);
        }
    }, []);

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        dragCounterRef.current--;
        if (dragCounterRef.current === 0) {
            setIsDragOver(false);
        }
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        dragCounterRef.current = 0;
        setIsDragOver(false);

        if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
            const filesArray = Array.from(e.dataTransfer.files);
            setStagedFiles(prev => {
                const newFiles = [...prev, ...filesArray].slice(0, maxFiles);
                return newFiles;
            });
        }
    }, [maxFiles]);

    const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const filesArray = Array.from(e.target.files);
            setStagedFiles(prev => {
                const newFiles = [...prev, ...filesArray].slice(0, maxFiles);
                return newFiles;
            });
        }
        // Reset input so the same file can be selected again
        e.target.value = '';
    }, [maxFiles]);

    const removeStagedFile = useCallback((index: number) => {
        setStagedFiles(prev => prev.filter((_, i) => i !== index));
    }, []);

    useEffect(() => {
        // Focus the input field when component mounts
        if (inputRef.current) {
            inputRef.current.focus();
        }
    }, []);

    // Start a new workflow with the message
    const startWorkflowWithMessage = async () => {
        if (!startWorkflow) return;

        const message = inputValue.trim();
        if (!message || isSending) return;

        setIsSending(true);
        try {
            // Reset plan panel state when starting a new agent
            sessionStorage.removeItem("plan-panel-shown");

            toast({
                title: stagedFiles.length > 0 ? t('agent.startingAgentUploading') : t('agent.startingAgent'),
                status: "info",
                duration: 3000,
            });

            // Get attached documents if callback provided
            const attachedDocs = getAttachedDocs?.() || [];

            // Build message content with attachment references as markdown links
            let messageContent = message;
            if (attachedDocs.length > 0 && !/store:\S+/.test(message)) {
                const lines = attachedDocs.map((doc) => `[${doc.name}](/store/objects/${doc.id})`);
                messageContent = [message, '', 'Attachments:', ...lines].join('\n');
            }

            // If files are staged, add a note to the message so the agent knows files are coming
            if (stagedFiles.length > 0) {
                const fileNames = stagedFiles.map(f => f.name).join(', ');
                messageContent = [
                    messageContent,
                    '',
                    `[System: ${stagedFiles.length} file(s) are being uploaded: ${fileNames}. Please wait for the "Files Ready" notification before processing them.]`
                ].join('\n');
            }

            const newRun = await startWorkflow(messageContent);
            if (newRun) {
                const agentId = newRun.agent_run_id;

                // Upload staged files to the new run's artifact space and signal agent
                const uploadedFiles: string[] = [];
                if (stagedFiles.length > 0) {
                    for (const file of stagedFiles) {
                        try {
                            const artifactPath = `files/${file.name}`;
                            await client.agents.uploadArtifact(agentId, artifactPath, file);

                            // Signal agent that file was uploaded
                            await client.agents.sendSignal(
                                agentId,
                                "FileUploaded",
                                {
                                    id: `file-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                                    name: file.name,
                                    content_type: file.type || 'application/octet-stream',
                                    reference: `artifact:${artifactPath}`,
                                    artifact_path: artifactPath,
                                } as ConversationFileRef
                            );
                            uploadedFiles.push(file.name);
                        } catch (uploadErr) {
                            console.error(`Failed to upload staged file ${file.name}:`, uploadErr);
                            // Continue with other files
                        }
                    }

                    // Send a follow-up message to notify the agent that all files are ready
                    if (uploadedFiles.length > 0) {
                        try {
                            await client.agents.sendSignal(
                                agentId,
                                "UserInput",
                                {
                                    message: `[Files Ready] All ${uploadedFiles.length} file(s) have been uploaded and are now available: ${uploadedFiles.join(', ')}. You can now process them.`,
                                    metadata: {
                                        type: 'files_ready',
                                        files: uploadedFiles,
                                    },
                                } as UserInputSignal
                            );
                        } catch (signalErr) {
                            console.error('Failed to send files ready signal:', signalErr);
                        }
                    }

                    setStagedFiles([]);
                }

                // Clear attachments after successful start
                onAttachmentsSent?.();
                setStartedAgentRunId(agentId);
                setInputValue("");
                toast({
                    title: t('agent.agentStarted'),
                    status: "success",
                    duration: 3000,
                });
            }
        } catch (err: any) {
            toast({
                title: t('agent.errorStarting'),
                status: "error",
                duration: 3000,
                description: err instanceof Error ? err.message : t('agent.unknownError'),
            });
        } finally {
            setIsSending(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            startWorkflowWithMessage();
        }
        // Shift+Enter allows newline (default textarea behavior)
    };

    // Auto-resize textarea as content grows
    const adjustTextareaHeight = useCallback(() => {
        const textarea = inputRef.current;
        if (textarea) {
            textarea.style.height = 'auto';
            textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
        }
    }, []);

    useEffect(() => {
        adjustTextareaHeight();
    }, [inputValue, adjustTextareaHeight]);

    // If a run has been started, show the conversation
    if (startedAgentRunId) {
        return (
            <ModernAgentConversationInner
                {...{ onClose, isModal, initialMessage, placeholder }}
                agentRunId={startedAgentRunId}
                title={title}
            />
        );
    }

    return (
        <div className="flex flex-col h-full bg-background items-center">
            <div
                className={cn(
                    "flex flex-col h-full w-full overflow-hidden border-0 relative",
                    fullWidth ? "" : "max-w-4xl"
                )}
                onDragEnter={handleDragEnter}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
            >
                {/* Drag overlay for full-panel file drop */}
                {isDragOver && (
                    <div className="absolute inset-0 flex items-center justify-center bg-info-background z-50 pointer-events-none rounded-lg">
                        <div className="text-info font-medium flex items-center gap-2 text-lg">
                            <UploadIcon className="size-6" />
                            Drop files to stage for upload
                        </div>
                    </div>
                )}

                {/* Hidden file input */}
                <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept={acceptedFileTypes}
                    onChange={handleFileInputChange}
                    className="hidden"
                />

                {/* Header */}
                <div className="flex items-center justify-between py-2 px-3 border-b border-border bg-background">
                    <div className="flex items-center space-x-2">
                        <div className="p-1">
                            <Cpu className="size-3.5 text-muted" />
                        </div>
                        <span className="font-medium text-sm text-foreground">
                            {resolvedTitle}
                        </span>
                    </div>

                    {/* Close button if needed */}
                    {onClose && !isModal && (
                        <Button
                            size="xs"
                            variant="ghost"
                            onClick={onClose}
                            title={t('agent.close')}
                            className="text-muted hover:text-foreground"
                        >
                            <XIcon className="size-4" />
                        </Button>
                    )}
                </div>

                {/* Empty conversation area with instructions */}
                <div className="flex-1 overflow-y-auto bg-background flex flex-col items-center justify-end">
                    <div className="w-full px-4 py-6">
                        {initialMessage && (
                            <div className="px-4 py-3 mb-4 bg-info-background border-l-2 border-info text-info">
                                {initialMessage}
                            </div>
                        )}

                        <div className="bg-card p-4 border-l-2 border-info">
                            <div className="text-base text-foreground font-medium">
                                {t('agent.enterMessage')}
                            </div>
                            <div className="mt-3 text-sm text-muted">
                                {t('agent.typeQuestionBelow', { buttonText: resolvedStartButtonText })}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Input Area */}
                <div className="py-3 px-3 border-t border-border bg-background">
                {/* Staged files display */}
                {stagedFiles.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-3">
                        {stagedFiles.map((file, index) => (
                            <div
                                key={`${file.name}-${index}`}
                                className="flex items-center gap-1.5 px-2 py-1 bg-attention/10 text-attention rounded-md text-sm"
                            >
                                <FileTextIcon className="size-3.5" />
                                <span className="max-w-[120px] truncate">{file.name}</span>
                                <span className="text-xs opacity-70">{t('agent.staged')}</span>
                                <button
                                    onClick={() => removeStagedFile(index)}
                                    className="ml-1 p-0.5 hover:bg-attention/20 rounded"
                                >
                                    <XIcon className="size-3" />
                                </button>
                            </div>
                        ))}
                    </div>
                )}

                {/* Upload button row */}
                <div className="flex gap-2 mb-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isSending || stagedFiles.length >= maxFiles}
                        className="text-xs"
                    >
                        <UploadIcon className="size-3.5 mr-1.5" />
                        {t('agent.upload')}
                    </Button>
                </div>

                <div className="flex items-end gap-2">
                    <textarea
                        ref={inputRef}
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder={resolvedPlaceholder}
                        disabled={isSending}
                        rows={2}
                        className="flex-1 py-2.5 px-3 text-sm border border-border bg-background text-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring rounded-md resize-none overflow-hidden"
                        style={{ minHeight: '60px', maxHeight: '200px' }}
                    />
                    <Button
                        onClick={startWorkflowWithMessage}
                        disabled={!inputValue.trim() || isSending}
                        className="px-3 py-2.5 text-xs rounded-md transition-colors"
                    >
                        {isSending ? (
                            <Spinner size="sm" className="mr-1.5" />
                        ) : (
                            <SendIcon className="size-3.5 mr-1.5" />
                        )}
                        {resolvedStartButtonText}
                    </Button>
                </div>
                <div className="text-xs text-muted mt-2 text-center">
                    {stagedFiles.length > 0
                        ? t('agent.filesStagedCount', { count: stagedFiles.length })
                        : t('agent.enterToSend')}
                </div>
            </div>
        </div>
        </div>
    );
}

// Inner component that handles the agent conversation - similar to ModernAgentOutput
function ModernAgentConversationInner({
    agentRunId,
    title,
    interactive = true,
    onClose,
    isModal = false,
    fullWidth = false,
    placeholder,
    resetWorkflow,
    onRestart,
    onFork,
    onShowDetails,
    // File upload props (onFilesSelected handled internally by handleFileUpload)
    uploadedFiles,
    onRemoveFile,
    acceptedFileTypes,
    maxFiles,
    // Document search props
    renderDocumentSearch,
    selectedDocuments,
    onRemoveDocument,
    // Object linking
    hideObjectLinking,
    // Section visibility
    hideHeader,
    hideMessageInput,
    hidePlanPanel,
    hideWorkstreamTabs,
    showRightPanel: showRightPanelProp = true,
    hideFileUpload,
    showArtifacts = false,
    hideDocumentPanel: _hideDocumentPanel,
    // Attachment callback
    getAttachedDocs,
    onAttachmentsSent,
    // Upload state
    isUploading = false,
    // Context callback
    getMessageContext,
    // Styling props
    className,
    inputContainerClassName,
    inputClassName,
    // Fusion fragment data
    fusionData,
    // External file upload API
    fileUploadRef,
    onProcessingFilesChange,
    processingFiles: processingFilesProp,
    // External plan panel API
    onPlansChange,
    onWorkstreamStatusChange,
    // External view mode control
    viewMode: controlledViewMode,
    onViewModeChange: onViewModeChangeProp,
    onShowInputChange,
    // External stop API
    stopRef,
    onStoppingChange,
    // MessageItem className/style overrides
    messageItemClassNames,
    messageStyleOverrides,
    // ToolCallGroup className overrides + view mode visibility
    toolCallGroupClassNames,
    hideToolCallsInViewMode,
    // StreamingMessage className overrides
    streamingMessageClassNames,
    // BatchProgressPanel className overrides
    batchProgressPanelClassNames,
    // AllMessagesMixed className overrides
    workingIndicatorClassName,
    messageListClassName,
    StoreLinkComponent,
    CollectionLinkComponent,
    prependFriendlyMessage,
    payloadContent,
    conversationContent,
    conversationTab = false,
}: ModernAgentConversationProps & { agentRunId: string }) {
    const { t } = useUITranslation();
    const { client } = useUserSession();
    const toast = useToast();
    const instanceIdRef = useRef(
        `mac-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
    );

    // ────────────────────────────────────────────
    // Extracted hooks
    // ────────────────────────────────────────────
    const {
        messages,
        streamingMessages,
        isCompleted,
        debugChunkFlash,
        addOptimisticMessage,
        removeOptimisticMessages,
        workflowStatus,
        serverFileUpdates,
    } = useAgentStream(client, agentRunId);

    const {
        plans,
        activePlanIndex,
        setActivePlanIndex,
        workstreamStatusMap,
        showInput,
        showSlidingPanel,
        setShowSlidingPanel,
    } = useAgentPlans(messages, interactive, isModal);

    const {
        openDocuments,
        activeDocumentId,
        isDocPanelOpen,
        docRefreshKey,
        closeDocPanel: handleCloseDocPanel,
        closeDocument: handleCloseDocument,
        selectDocument,
        openDocInPanel,
    } = useDocumentPanel(messages);

    const {
        processingFiles,
        hasProcessingFiles,
        handleFileUpload,
    } = useFileProcessing(client, agentRunId, serverFileUpdates, toast);

    // ────────────────────────────────────────────
    // Local state (UI-only concerns)
    // ────────────────────────────────────────────
    const bottomRef = useRef<HTMLDivElement | null>(null);
    const conversationRef = useRef<HTMLDivElement | null>(null);
    const conversationLayoutRef = useRef<HTMLDivElement | null>(null);
    const [isSending, setIsSending] = useState(false);
    const [internalViewMode, setInternalViewMode] = useState<AgentConversationViewMode>("sliding");
    const viewMode = controlledViewMode ?? internalViewMode;
    const handleViewModeChange = useCallback((mode: AgentConversationViewMode) => {
        if (onViewModeChangeProp) {
            onViewModeChangeProp(mode);
        } else {
            setInternalViewMode(mode);
        }
    }, [onViewModeChangeProp]);
    const [isStopping, setIsStopping] = useState(false);
    const [thinkingMessageIndex, setThinkingMessageIndex] = useState(0);
    const [isDragOver, setIsDragOver] = useState(false);
    const [activeWorkstreams, setActiveWorkstreams] = useState<ActiveWorkstreamEntry[]>([]);
    const workstreamFetchFailedRef = useRef(false);
    const dragCounterRef = useRef(0);

    // PERFORMANCE: Refs for values used inside useCallback to avoid re-creating the callback
    const isSendingRef = useRef(isSending);
    isSendingRef.current = isSending;
    const hasProcessingFilesRef = useRef(hasProcessingFiles);
    hasProcessingFilesRef.current = hasProcessingFiles;

    // Derive effective workflow status — only main workstream TERMINATED overrides API status.
    const effectiveWorkflowStatus = useMemo(() => {
        const mainMessages = messages.filter(m => (m.workstream_id || 'main') === 'main');
        const lastMain = mainMessages[mainMessages.length - 1];
        if (lastMain?.type === AgentMessageType.TERMINATED) return "TERMINATED";
        return workflowStatus;
    }, [messages, workflowStatus]);

    console.debug("[ModernAgentConversation] render", {
        agentRunId,
        instanceId: instanceIdRef.current,
        messageCount: messages.length,
        activeWorkstreams: activeWorkstreams.length,
    });

    useEffect(() => {
        console.debug("[ModernAgentConversation] mount", {
            agentRunId,
            instanceId: instanceIdRef.current,
        });

        return () => {
            console.debug("[ModernAgentConversation] unmount", {
                agentRunId,
                instanceId: instanceIdRef.current,
            });
        };
    }, [agentRunId]);

    // ────────────────────────────────────────────
    // Computed values
    // ────────────────────────────────────────────
    const getActivePlan = useMemo(() => {
        const currentPlanData = plans[activePlanIndex] || {
            plan: { plan: [] },
            timestamp: 0,
        };
        const currentWorkstreamStatus =
            workstreamStatusMap.get(currentPlanData.timestamp) || new Map();
        return {
            plan: currentPlanData.plan,
            workstreamStatus: currentWorkstreamStatus,
        };
    }, [plans, activePlanIndex, workstreamStatusMap]);

    const panelWorkstreams = useMemo<WorkstreamInfo[]>(() => {
        return activeWorkstreams.map((ws) => ({
            workstream_id: ws.workstream_id,
            launch_id: ws.launch_id,
            elapsed_ms: ws.elapsed_ms,
            deadline_ms: ws.deadline_ms,
            remaining_ms: Math.max(0, ws.deadline_ms - ws.elapsed_ms),
            status: ws.status,
            phase: ws.latest_progress?.phase,
            child_workflow_id: ws.child_workflow_id,
            child_workflow_run_id: ws.child_workflow_run_id,
        }));
    }, [activeWorkstreams]);

    // ────────────────────────────────────────────
    // Stable callbacks
    // ────────────────────────────────────────────
    const handleTogglePlanPanel = useCallback(() => {
        setShowSlidingPanel((prev: boolean) => {
            if (!prev) {
                sessionStorage.setItem("plan-panel-shown", "true");
            }
            return !prev;
        });
    }, [setShowSlidingPanel]);

    const handleChangePlan = useCallback((index: number) => {
        setActivePlanIndex(index);
    }, [setActivePlanIndex]);

    // ────────────────────────────────────────────
    // Unified right panel state
    // ────────────────────────────────────────────
    type RightPanelTab = 'plan' | 'workstreams' | 'documents' | 'uploads' | 'artifacts' | 'conversation';
    const [rightPanelTab, _setRightPanelTab] = useState<RightPanelTab>((conversationContent || conversationTab) ? 'conversation' : 'plan');
    const [rightPanelWidth, setRightPanelWidth] = useState(400);
    const [isRightPanelResizing, setIsRightPanelResizing] = useState(false);

    const isRightPanelVisible = showRightPanelProp && (showSlidingPanel
        || isDocPanelOpen
        || (!hideWorkstreamTabs && panelWorkstreams.length > 0)
        || !!conversationContent
        || conversationTab);

    useEffect(() => {
        if (!isRightPanelVisible && isRightPanelResizing) {
            setIsRightPanelResizing(false);
        }
    }, [isRightPanelVisible, isRightPanelResizing]);

    useEffect(() => {
        if (!isRightPanelResizing) return;

        const minRightPanelWidth = 300;
        const minConversationWidth = 420;

        const handleMouseMove = (event: MouseEvent) => {
            const container = conversationLayoutRef.current;
            if (!container) return;

            const containerRect = container.getBoundingClientRect();
            const maxRightPanelWidth = Math.max(minRightPanelWidth, containerRect.width - minConversationWidth);
            const nextWidth = containerRect.right - event.clientX;
            const clampedWidth = Math.min(Math.max(nextWidth, minRightPanelWidth), maxRightPanelWidth);
            setRightPanelWidth(clampedWidth);
        };

        const handleMouseUp = () => {
            setIsRightPanelResizing(false);
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        };
    }, [isRightPanelResizing]);

const handleCloseRightPanel = useCallback(() => {
        setShowSlidingPanel(false);
        handleCloseDocPanel();
    }, [setShowSlidingPanel, handleCloseDocPanel]);

    // Default StoreLinkComponent that opens documents in the panel
    const internalStoreLinkComponent = useCallback(
        ({ href, documentId, children }: { href: string; documentId: string; children: React.ReactNode }) => (
            <a
                href={href}
                className="text-info underline cursor-pointer hover:text-info/80"
                onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    openDocInPanel(documentId);
                }}
            >
                {children}
            </a>
        ),
        [openDocInPanel]
    );

    const effectiveStoreLinkComponent = StoreLinkComponent ?? internalStoreLinkComponent;

    // ────────────────────────────────────────────
    // Effects
    // ────────────────────────────────────────────

    // Show rotating thinking messages
    useEffect(() => {
        if (!isCompleted) {
            const interval = setInterval(() => {
                setThinkingMessageIndex(() =>
                    Math.floor(Math.random() * (ThinkingMessages.length - 1)),
                );
            }, 4000);
            return () => clearInterval(interval);
        }
    }, [isCompleted]);

    // Expose handleFileUpload to external callers via ref
    useEffect(() => {
        if (fileUploadRef) fileUploadRef.current = handleFileUpload;
        return () => { if (fileUploadRef) fileUploadRef.current = null; };
    }, [fileUploadRef, handleFileUpload]);

    // Notify parent when processingFiles changes
    useEffect(() => {
        onProcessingFilesChange?.(processingFiles);
    }, [processingFiles, onProcessingFilesChange]);

    // Notify parent when plans change
    useEffect(() => {
        onPlansChange?.(plans, activePlanIndex);
    }, [plans, activePlanIndex, onPlansChange]);

    // Notify parent when workstream status changes
    useEffect(() => {
        onWorkstreamStatusChange?.(workstreamStatusMap);
    }, [workstreamStatusMap, onWorkstreamStatusChange]);

    // Poll active workstreams from backend query for right-panel visibility and details.
    useEffect(() => {
        const shouldPoll = !isCompleted || activeWorkstreams.length > 0;
        if (!shouldPoll) {
            setActiveWorkstreams((prev) => (prev.length === 0 ? prev : []));
            return;
        }

        let isCancelled = false;

        const fetchActiveWorkstreams = async () => {
            try {
                const result = await client.agents.getActiveWorkstreams(agentRunId);
                if (isCancelled) return;
                setActiveWorkstreams(result.running ?? []);
                workstreamFetchFailedRef.current = false;
            } catch (error) {
                if (isCancelled) return;
                setActiveWorkstreams([]);
                if (!workstreamFetchFailedRef.current) {
                    console.warn("Failed to fetch active workstreams:", error);
                    workstreamFetchFailedRef.current = true;
                }
            }
        };

        fetchActiveWorkstreams();
        const pollHandle = window.setInterval(fetchActiveWorkstreams, 10000);

        return () => {
            isCancelled = true;
            window.clearInterval(pollHandle);
        };
    }, [client.agents, agentRunId, isCompleted, activeWorkstreams.length]);

    // Notify parent when input availability is determined
    useEffect(() => {
        if (messages.length === 0) return;
        if (!showInput) {
            onShowInputChange?.(false);
            return;
        }
        if (effectiveWorkflowStatus && effectiveWorkflowStatus !== "RUNNING") {
            onShowInputChange?.(false);
            return;
        }
        if (effectiveWorkflowStatus !== null) {
            onShowInputChange?.(true);
        }
    }, [showInput, effectiveWorkflowStatus, messages.length, onShowInputChange]);

    // ────────────────────────────────────────────
    // Handlers
    // ────────────────────────────────────────────

    // Send a message to the agent
    const handleSendMessage = useCallback((message: string) => {
        const trimmed = message.trim();
        if (!trimmed || isSendingRef.current) return;

        // Block if files are still processing
        if (hasProcessingFilesRef.current) {
            toast({
                status: "warning",
                title: t('agent.filesProcessing'),
                description: t('agent.waitForFilesProcessing'),
                duration: 3000,
            });
            return;
        }

        setIsSending(true);

        const attachedDocs = getAttachedDocs?.() || [];
        const contextMetadata = getMessageContext?.() || {};

        let messageContent = trimmed;
        if (attachedDocs.length > 0 && !/store:\S+/.test(trimmed)) {
            const lines = attachedDocs.map((doc) => `[${doc.name}](/store/objects/${doc.id})`);
            messageContent = [trimmed, '', 'Attachments:', ...lines].join('\n');
        }

        const messageId = `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        const optimisticMessage: AgentMessage = {
            timestamp: Date.now(),
            workflow_run_id: agentRunId,
            type: AgentMessageType.QUESTION,
            message: messageContent,
            workstream_id: "main",
            details: { _optimistic: true, _messageId: messageId },
        };

        addOptimisticMessage(optimisticMessage);

        const metadata = {
            ...(attachedDocs.length > 0 ? { attached_docs: attachedDocs.map((d) => d.id) } : {}),
            ...contextMetadata,
            _messageId: messageId,
        };

        client.agents
            .sendSignal(agentRunId, "UserInput", {
                message: messageContent,
                metadata,
            } as UserInputSignal)
            .then(() => {
                onAttachmentsSent?.();
            })
            .catch((err) => {
                removeOptimisticMessages((m) =>
                    (m.details as any)?._messageId === messageId
                );
                toast({
                    status: "error",
                    title: t('agent.failedToSend'),
                    description: err instanceof Error ? err.message : t('agent.unknownError'),
                    duration: 3000,
                });
            })
            .finally(() => {
                setIsSending(false);
            });
    }, [agentRunId, client, toast, getAttachedDocs, getMessageContext, onAttachmentsSent, addOptimisticMessage, removeOptimisticMessages]);

    // Drag and drop handlers for full-panel file upload
    const handleDragEnter = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        dragCounterRef.current++;
        if (e.dataTransfer?.types?.includes('Files')) {
            setIsDragOver(true);
        }
    }, []);

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        dragCounterRef.current--;
        if (dragCounterRef.current === 0) {
            setIsDragOver(false);
        }
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        dragCounterRef.current = 0;
        setIsDragOver(false);

        if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
            const filesArray = Array.from(e.dataTransfer.files);
            handleFileUpload(filesArray);
        }
    }, [handleFileUpload]);

    // Stop/interrupt the active workflow
    const handleStopWorkflow = useCallback(async () => {
        if (isStopping) return;

        setIsStopping(true);
        try {
            await client.agents.sendSignal(agentRunId, "Stop", {
                message: "User requested stop",
            });

            toast({
                status: "info",
                title: t('agent.agentInterrupted'),
                description: t('agent.typeNewInstructions'),
                duration: 3000,
            });
        } catch (err) {
            toast({
                status: "error",
                title: t('agent.failedToInterrupt'),
                description: err instanceof Error ? err.message : t('agent.unknownError'),
                duration: 3000,
            });
        } finally {
            setIsStopping(false);
        }
    }, [isStopping, client, agentRunId, toast]);

    // Expose stop handler to external callers via ref
    useEffect(() => {
        if (stopRef) stopRef.current = !isCompleted ? handleStopWorkflow : null;
        return () => { if (stopRef) stopRef.current = null; };
    }, [stopRef, isCompleted, handleStopWorkflow]);

    // Notify parent when stopping state changes
    useEffect(() => {
        onStoppingChange?.(isStopping);
    }, [isStopping, onStoppingChange]);

    // Calculate number of active tasks for the status indicator
    const getActiveTaskCount = (): number => {
        if (activeWorkstreams.length > 0) {
            return activeWorkstreams.filter((ws) => ws.status === "running").length;
        }

        if (!messages.length) return 0;

        // Group messages by workstream
        const workstreamMessages = new Map<string, AgentMessage[]>();

        messages.forEach((message) => {
            const workstreamId = getWorkstreamId(message);
            if (workstreamId !== "main" && workstreamId !== "all") {
                if (!workstreamMessages.has(workstreamId)) {
                    workstreamMessages.set(workstreamId, []);
                }
                workstreamMessages.get(workstreamId)!.push(message);
            }
        });

        // Count workstreams that don't have completion messages
        let activeCount = 0;

        for (const [_, msgs] of workstreamMessages.entries()) {
            if (msgs.length > 0) {
                const lastMessage = msgs[msgs.length - 1];
                // If the last message isn't a completion message, the workstream is active
                if (
                    ![AgentMessageType.COMPLETE, AgentMessageType.IDLE].includes(
                        lastMessage.type,
                    )
                ) {
                    activeCount++;
                }
            }
        }

        return activeCount;
    };

    const actualTitle = title || t('agent.agentConversation');

    // Handle downloading conversation
    const downloadConversation = async () => {
        try {
            const url = await getConversationUrl(client, agentRunId);
            if (url) window.open(url, "_blank");
        } catch (err) {
            console.error("Failed to download conversation", err);
            toast({
                status: "error",
                title: t('agent.failedToDownload'),
                duration: 3000,
            });
        }
    };

    // Handle copying run ID
    const copyRunId = () => {
        navigator.clipboard.writeText(agentRunId);
        toast({
            status: "success",
            title: t('agent.runIdCopied'),
            duration: 2000,
        });
    };

    const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);

    const exportConversationPdf = () => {
        if (!conversationRef.current) {
            toast({
                status: "error",
                title: t('agent.pdfExportFailed'),
                description: t('agent.noConversationContent'),
                duration: 3000,
            });
            return;
        }
        setIsPdfModalOpen(true);
    };

    const handleConfirmExportPdf = () => {
        if (!conversationRef.current) {
            toast({
                status: "error",
                title: t('agent.pdfExportFailed'),
                description: t('agent.noConversationContent'),
                duration: 3000,
            });
            return;
        }

        const pdfTitle = `${actualTitle} - ${agentRunId}`;
        const success = printElementToPdf(conversationRef.current, pdfTitle);

        if (!success) {
            toast({
                status: "error",
                title: t('agent.pdfExportFailed'),
                description: t('agent.unableToOpenPrint'),
                duration: 4000,
            });
            return;
        }

        toast({
            status: "success",
            title: t('agent.pdfExportReady'),
            description: t('agent.printDialogDescription'),
            duration: 4000,
        });
        setIsPdfModalOpen(false);
    };

    // Artifact refresh key — bumps when tool calls complete or conversation finishes,
    // which is when new artifacts are most likely to appear.
    const artifactRefreshKey = useMemo(() => {
        return messages.filter((m) => {
            if (m.type === AgentMessageType.COMPLETE) return true;
            if (m.type === AgentMessageType.THOUGHT) {
                const details = m.details as Record<string, unknown> | undefined;
                return details?.tool_status === 'completed';
            }
            return false;
        }).length;
    }, [messages]);

    // PERFORMANCE: Memoize taskLabels to prevent AllMessagesMixed re-renders
    const taskLabels = useMemo(() =>
        getActivePlan.plan.plan?.reduce((acc, task) => {
            if (task.id && task.goal) acc.set(task.id.toString(), task.goal);
            return acc;
        }, new Map<string, string>()),
    [getActivePlan.plan]);

    // Conversation area inner content — shared between main layout and conversationTab mode
    const conversationAreaJsx = (
        <div
            ref={conversationRef}
            className={cn(
                "flex flex-col min-h-0 min-w-0 border-0",
                conversationTab
                    ? "flex-1 h-full"
                    : isRightPanelVisible
                        ? "w-full flex-1 min-h-[50vh]"
                        : fullWidth
                            ? "flex-1 w-full"
                            : `flex-1 mx-auto ${!isModal ? "max-w-4xl" : ""}`
            )}
        >
            {!hideHeader && (
                <div className="flex-shrink-0">
                    <Header
                        title={actualTitle}
                        isCompleted={isCompleted}
                        onClose={onClose}
                        isModal={isModal}
                        agentRunId={agentRunId}
                        viewMode={viewMode}
                        onViewModeChange={handleViewModeChange}
                        showPlanPanel={showRightPanelProp && showSlidingPanel}
                        hasPlan={showRightPanelProp && plans.length > 0}
                        showPlanButton={showRightPanelProp && !conversationTab}
                        onTogglePlanPanel={handleTogglePlanPanel}
                        onDownload={downloadConversation}
                        onCopyRunId={copyRunId}
                        resetWorkflow={resetWorkflow}
                        onRestart={onRestart}
                        onFork={onFork}
                        onShowDetails={onShowDetails}
                        onExportPdf={exportConversationPdf}
                        isReceivingChunks={debugChunkFlash}
                    />
                </div>
            )}

            {messages.length === 0 && !isCompleted ? (
                <div className="flex-1 flex flex-col items-center justify-center h-full text-center py-6">
                    <div className="p-5 max-w-md border border-info rounded-lg shadow-sm">
                        <div className="flex items-center space-x-3 mb-3">
                            <PulsatingCircle size="sm" color="blue" />
                            <div className="text-sm text-muted font-medium">
                                {ThinkingMessages[thinkingMessageIndex]}
                            </div>
                        </div>
                        <div className="mt-4 flex justify-center">
                            <AnimatedThinkingDots color="blue" className="mt-1" />
                        </div>
                    </div>
                </div>
            ) : (
                <AllMessagesMixed
                    messages={messages}
                    bottomRef={bottomRef as React.RefObject<HTMLDivElement>}
                    isCompleted={isCompleted}
                    plan={getActivePlan.plan}
                    workstreamStatus={getActivePlan.workstreamStatus}
                    showPlanPanel={showRightPanelProp && showSlidingPanel}
                    onTogglePlanPanel={handleTogglePlanPanel}
                    plans={plans}
                    activePlanIndex={activePlanIndex}
                    onChangePlan={handleChangePlan}
                    taskLabels={taskLabels}
                    streamingMessages={streamingMessages}
                    onSendMessage={handleSendMessage}
                    thinkingMessageIndex={thinkingMessageIndex}
                    messageItemClassNames={messageItemClassNames}
                    messageStyleOverrides={messageStyleOverrides}
                    toolCallGroupClassNames={toolCallGroupClassNames}
                    hideToolCallsInViewMode={hideToolCallsInViewMode}
                    streamingMessageClassNames={streamingMessageClassNames}
                    batchProgressPanelClassNames={batchProgressPanelClassNames}
                    artifactRunId={agentRunId}
                    viewMode={viewMode}
                    hideWorkstreamTabs={hideWorkstreamTabs}
                    workingIndicatorClassName={workingIndicatorClassName}
                    messageListClassName={messageListClassName}
                    StoreLinkComponent={effectiveStoreLinkComponent}
                    CollectionLinkComponent={CollectionLinkComponent}
                    prependFriendlyMessage={prependFriendlyMessage}
                />
            )}

            {!hideMessageInput && (
                <div className="flex-shrink-0" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
                    {effectiveWorkflowStatus && effectiveWorkflowStatus !== "RUNNING" ? (
                        <MessageBox
                            status={effectiveWorkflowStatus === "COMPLETED" ? 'success' : 'done'}
                            icon={null}
                            className="m-2"
                        >
                            This Workflow is {effectiveWorkflowStatus}
                        </MessageBox>
                    ) : showInput && (
                        <MessageInput
                            onSend={handleSendMessage}
                            onStop={handleStopWorkflow}
                            disabled={isUploading}
                            isSending={isSending || isUploading}
                            isStopping={isStopping}
                            isStreaming={!isCompleted}
                            isCompleted={isCompleted}
                            activeTaskCount={getActiveTaskCount()}
                            placeholder={placeholder ?? 'Type your message...'}
                            onFilesSelected={handleFileUpload}
                            uploadedFiles={uploadedFiles}
                            onRemoveFile={onRemoveFile}
                            acceptedFileTypes={acceptedFileTypes}
                            maxFiles={maxFiles}
                            processingFiles={processingFiles}
                            hasProcessingFiles={hasProcessingFiles}
                            renderDocumentSearch={renderDocumentSearch}
                            selectedDocuments={selectedDocuments}
                            onRemoveDocument={onRemoveDocument}
                            hideObjectLinking={hideObjectLinking}
                            hideFileUpload={hideFileUpload}
                            className={inputContainerClassName}
                            inputClassName={inputClassName}
                        />
                    )}
                </div>
            )}
        </div>
    );

    // Main content - wrapped with FusionFragmentProvider when fusionData is provided
    const mainContent = (
        <ArtifactUrlCacheProvider>
        <ImageLightboxProvider>
        <div
            ref={conversationLayoutRef}
            className={cn("flex flex-col lg:flex-row gap-2 w-full h-full relative overflow-hidden", isDragOver && "ring-2 ring-blue-400 ring-inset", className)}
            onDragEnter={handleDragEnter}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
        >
            {/* Drag overlay for full-panel file drop */}
            {isDragOver && (
                <div className="absolute inset-0 flex items-center justify-center bg-blue-100/80 dark:bg-blue-900/40 z-50 pointer-events-none rounded-lg">
                    <div className="text-blue-600 dark:text-blue-400 font-medium flex items-center gap-2 text-lg">
                        <UploadIcon className="size-6" />
                        Drop files to upload
                    </div>
                </div>
            )}
            {/* Conversation Area — hidden when conversationTab moves it into the right panel */}
            {!conversationTab && conversationAreaJsx}

            {/* Unified Right Panel — Plan | Workstreams | Documents | Uploads */}
            {isRightPanelVisible && (
                <>
                    {!conversationTab && (
                        <div
                            className="hidden lg:block lg:w-1 lg:shrink-0 cursor-col-resize bg-border/70 hover:bg-border transition-colors"
                            onMouseDown={() => setIsRightPanelResizing(true)}
                            role="separator"
                            aria-orientation="vertical"
                            aria-label="Resize right panel"
                        />
                    )}
                    <div
                        className={conversationTab
                            ? "w-full h-full overflow-auto"
                            : "w-full lg:w-[var(--agent-right-panel-width)] lg:shrink-0 min-h-[50vh] lg:h-full border-t lg:border-t-0 lg:border-l"}
                        style={!conversationTab ? ({ ['--agent-right-panel-width' as string]: `${rightPanelWidth}px` } as React.CSSProperties) : undefined}
                    >
                    <AgentRightPanel
                        // Plan
                        plan={getActivePlan.plan}
                        workstreamStatus={getActivePlan.workstreamStatus}
                        plans={plans}
                        activePlanIndex={activePlanIndex}
                        onChangePlan={handleChangePlan}
                        showPlan={!hidePlanPanel && showSlidingPanel}
                        // Workstreams
                        activeWorkstreams={panelWorkstreams}
                        hideWorkstreams={hideWorkstreamTabs}
                        // Documents
                        openDocuments={openDocuments}
                        activeDocumentId={activeDocumentId}
                        onSelectDocument={selectDocument}
                        onCloseDocument={handleCloseDocument}
                        docRefreshKey={docRefreshKey}
                        runId={agentRunId}
                        // Uploads
                        processingFiles={processingFilesProp ?? processingFiles}
                        // Artifacts
                        showArtifacts={showArtifacts}
                        artifactRefreshKey={artifactRefreshKey}
                        // Messages (for workstreams tab context)
                        messages={messages}
                        // Payload content
                        payloadContent={payloadContent}
                        // Conversation content
                        conversationContent={conversationTab ? conversationAreaJsx : conversationContent}
                        // Panel control
                        onClose={handleCloseRightPanel}
                        defaultTab={rightPanelTab}
                    />
                    </div>
                </>
            )}
            <Modal isOpen={isPdfModalOpen} onClose={() => setIsPdfModalOpen(false)}>
                <ModalTitle>Export conversation as PDF</ModalTitle>
                <ModalBody>
                    <p className="mb-2">
                        This will open your browser&apos;s print dialog with the current conversation.
                    </p>
                    <p className="text-sm text-muted">
                        To save a PDF, choose &quot;Save as PDF&quot; or a similar option in the print dialog.
                    </p>
                </ModalBody>
                <ModalFooter align="right">
                    <Button variant="ghost" size="sm" onClick={() => setIsPdfModalOpen(false)}>
                        Cancel
                    </Button>
                    <Button size="sm" onClick={handleConfirmExportPdf}>
                        Open print dialog
                    </Button>
                </ModalFooter>
            </Modal>
        </div>
        </ImageLightboxProvider>
        </ArtifactUrlCacheProvider>
    );

    // Wrap with FusionFragmentProvider when fusionData is provided
    // This enables fusion-fragment code blocks to display data and supports
    // agent-mode interactions where clicking editable fields sends messages
    if (fusionData) {
        return (
            <FusionFragmentProvider
                data={fusionData}
                sendMessage={handleSendMessage}
                ChartComponent={VegaLiteChart}
                artifactRunId={agentRunId}
            >
                {mainContent}
            </FusionFragmentProvider>
        );
    }

    return mainContent;
}
