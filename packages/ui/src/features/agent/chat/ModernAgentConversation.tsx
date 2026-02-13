import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Bot, Cpu, FileTextIcon, SendIcon, UploadIcon, XIcon } from "lucide-react";
import { useUserSession } from "@vertesia/ui/session";
import { AsyncExecutionResult, VertesiaClient } from "@vertesia/client";
import {
    AgentMessage,
    AgentMessageType,
    ConversationFile,
    ConversationFileRef,
    FileProcessingDetails,
    FileProcessingStatus,
    Plan,
    StreamingChunkDetails,
    UserInputSignal,
} from "@vertesia/common";
import { FusionFragmentProvider } from "@vertesia/fusion-ux";
import { Button, cn, MessageBox, Spinner, useToast, Modal, ModalBody, ModalFooter, ModalTitle } from "@vertesia/ui/core";

import { AnimatedThinkingDots, PulsatingCircle } from "./AnimatedThinkingDots";
import { ConversationThemeProvider, useConversationTheme, type ConversationTheme } from "./theme/ConversationThemeContext";
import { resolveModernAgentConversationTheme } from "./theme/resolveModernAgentConversationTheme";
import { ImageLightboxProvider } from "./ImageLightbox";
import AllMessagesMixed from "./ModernAgentOutput/AllMessagesMixed";
import Header from "./ModernAgentOutput/Header";
import MessageInput, { UploadedFile, SelectedDocument } from "./ModernAgentOutput/MessageInput";
import { getWorkstreamId, insertMessageInTimeline, isInProgress } from "./ModernAgentOutput/utils";
import { ThinkingMessages } from "./WaitingMessages";
import InlineSlidingPlanPanel from "./ModernAgentOutput/InlineSlidingPlanPanel";
import { SkillWidgetProvider } from "./SkillWidgetProvider";
import { ArtifactUrlCacheProvider } from "./useArtifactUrlCache.js";
import { SchemeRouteProvider } from "../../../widgets/markdown/SchemeRouteContext";
import { VegaLiteChart } from "./VegaLiteChart";

export type StartWorkflowFn = (
    initialMessage?: string,
) => Promise<{ run_id: string; workflow_id: string } | undefined>;

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
    run?: AsyncExecutionResult | { workflow_id: string; run_id: string };
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
    /** Called when plans change (for external plan panel) */
    onPlansChange?: (plans: Array<{ plan: Plan; timestamp: number }>, activePlanIndex: number) => void;
    /** Called when workstream status changes (for external plan panel) */
    onWorkstreamStatusChange?: (statusMap: Map<number, Map<string, "pending" | "in_progress" | "completed" | "skipped">>) => void;

    /** Controlled view mode — when provided, overrides internal state */
    viewMode?: "stacked" | "sliding";
    /** Called when view mode changes (for external control) */
    onViewModeChange?: (mode: "stacked" | "sliding") => void;

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

    /** Override the route for store: and document:// object links. Receives the object ID, returns the href. */
    resolveStoreUrl?: (objectId: string) => string;

    // Callback to get attached document IDs when sending messages
    // Returns array of document IDs to include in message metadata
    getAttachedDocs?: () => string[];
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

    /** Conversation theme — cascading overrides for all child components */
    theme?: ConversationTheme;

    // Fusion fragment props
    /**
     * Data to provide to fusion-fragment code blocks for rendering.
     * When provided, fusion-fragments in agent responses will display
     * this data according to their template structure.
     * @example { fundName: "Tech Growth IV", vintage: 2024, totalCommitments: 500000000 }
     */
    fusionData?: Record<string, unknown>;
}

export function ModernAgentConversation(
    props: ModernAgentConversationProps,
) {
    const { run, startWorkflow, theme, resolveStoreUrl } = props;

    if (run) {
        // If we have a run, convert it to AsyncExecutionResult format if needed
        const execRun: AsyncExecutionResult =
            "runId" in run
                ? run
                : {
                    runId: run.run_id,
                    workflowId: run.workflow_id,
                };
        let content = (
            <SkillWidgetProvider>
                <ModernAgentConversationInner {...props} run={execRun} />
            </SkillWidgetProvider>
        );
        if (resolveStoreUrl) {
            content = <SchemeRouteProvider overrides={{ resolveStoreUrl }}>{content}</SchemeRouteProvider>;
        }
        return theme
            ? <ConversationThemeProvider theme={theme}>{content}</ConversationThemeProvider>
            : content;
    } else if (startWorkflow) {
        // If we have startWorkflow capability but no run yet
        return <StartWorkflowView {...props} />;
    } else {
        // Empty state
        return <EmptyState />;
    }
}

// Empty state when no agent is running
function EmptyState() {
    return (
        <MessageBox
            status="info"
            icon={<Bot className="size-16 text-muted mb-4" />}
        >
            <div className="text-base font-medium text-muted">
                No agent currently running
            </div>
            <div className="mt-3 text-sm text-muted">
                Select an interaction and click Start to start an agent
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
    placeholder = "Type your message...",
    startButtonText = "Start Agent",
    title = "Start New Conversation",
    // Attachment callback - used to include existing document attachments in the first message
    getAttachedDocs,
    onAttachmentsSent,
    // File upload props
    acceptedFileTypes = ".pdf,.doc,.docx,.txt,.csv,.xlsx,.xls,.png,.jpg,.jpeg,.gif,.webp",
    maxFiles = 5,
}: ModernAgentConversationProps) {
    const { client } = useUserSession();
    const [inputValue, setInputValue] = useState<string>("");
    const [isSending, setIsSending] = useState(false);
    const [run, setRun] = useState<AsyncExecutionResult>();
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
                title: stagedFiles.length > 0 ? "Starting agent and uploading files..." : "Starting agent...",
                status: "info",
                duration: 3000,
            });

            // Get attached document IDs if callback provided
            const attachedDocs = getAttachedDocs?.() || [];

            // Build message content with attachment references if present
            let messageContent = message;
            if (attachedDocs.length > 0 && !/store:\S+/.test(message)) {
                const lines = attachedDocs.map((id) => `store:${id}`);
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
                // Upload staged files to the new run's artifact space and signal workflow
                const uploadedFiles: string[] = [];
                if (stagedFiles.length > 0) {
                    for (const file of stagedFiles) {
                        try {
                            const artifactPath = `files/${file.name}`;
                            await client.files.uploadArtifact(newRun.run_id, artifactPath, file);

                            // Signal workflow that file was uploaded
                            await client.store.workflows.sendSignal(
                                newRun.workflow_id,
                                newRun.run_id,
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
                            await client.store.workflows.sendSignal(
                                newRun.workflow_id,
                                newRun.run_id,
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
                setRun({
                    runId: newRun.run_id,
                    workflowId: newRun.workflow_id,
                });
                setInputValue("");
                toast({
                    title: "Agent started",
                    status: "success",
                    duration: 3000,
                });
            }
        } catch (err: any) {
            toast({
                title: "Error starting workflow",
                status: "error",
                duration: 3000,
                description: err instanceof Error ? err.message : "Unknown error",
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
    if (run) {
        return (
            <ModernAgentConversationInner
                {...{ onClose, isModal, initialMessage, placeholder }}
                run={run}
                title={title}
            />
        );
    }

    return (
        <div
            className={`flex flex-col h-full bg-white dark:bg-gray-900 overflow-hidden border-0 relative ${isDragOver ? 'ring-2 ring-blue-400 ring-inset' : ''}`}
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
            <div className="flex items-center justify-between py-2 px-3 border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900">
                <div className="flex items-center space-x-2">
                    <div className="p-1">
                        <Cpu className="size-3.5 text-muted" />
                    </div>
                    <span className="font-medium text-sm text-gray-700 dark:text-gray-300">
                        {title}
                    </span>
                </div>

                {/* Close button if needed */}
                {onClose && !isModal && (
                    <Button
                        size="xs"
                        variant="ghost"
                        onClick={onClose}
                        title="Close"
                        className="text-slate-500 hover:text-slate-700"
                    >
                        <XIcon className="size-4" />
                    </Button>
                )}
            </div>

            {/* Empty conversation area with instructions */}
            <div
                className={`flex-1 overflow-y-auto px-4 py-6 bg-white dark:bg-gray-900 flex flex-col ${
                    fullWidth ? 'items-start justify-start' : 'items-center justify-center'
                }`}
            >
                {initialMessage && (
                    <div
                        className={`px-4 py-3 mb-4 bg-blue-50/80 dark:bg-blue-900/30 border-l-2 border-blue-400 dark:border-blue-500 text-blue-700 dark:text-blue-300 ${
                            fullWidth ? 'w-full' : 'max-w-md'
                        }`}
                    >
                        {initialMessage}
                    </div>
                )}

                <div
                    className={`bg-white dark:bg-slate-800 p-4 border-l-2 border-blue-400 dark:border-blue-500 ${
                        fullWidth ? 'w-full' : 'max-w-md'
                    }`}
                >
                    <div className="text-base text-slate-600 dark:text-slate-300 font-medium">
                        Enter a message to start a conversation
                    </div>
                    <div className="mt-3 text-sm text-slate-500 dark:text-slate-400">
                        Type your question below and press Enter or click {startButtonText}{" "}
                        to begin
                    </div>
                </div>
            </div>

            {/* Input Area */}
            <div className="py-3 px-3 border-t border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900">
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
                                <span className="text-xs opacity-70">Staged</span>
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
                        Upload
                    </Button>
                </div>

                <div className="flex items-end gap-2">
                    <div className="flex-1">
                        <textarea
                            ref={inputRef}
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder={placeholder}
                            disabled={isSending}
                            rows={2}
                            className="w-full py-2.5 px-3 text-sm border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white focus:border-gray-300 dark:focus:border-gray-600 focus:outline-none focus:ring-1 focus:ring-gray-300 dark:focus:ring-gray-600 rounded-md resize-none overflow-hidden"
                            style={{ minHeight: '60px', maxHeight: '200px' }}
                        />
                    </div>
                    <Button
                        onClick={startWorkflowWithMessage}
                        disabled={!inputValue.trim() || isSending}
                        className="px-3 py-2.5 bg-gray-800 dark:bg-gray-700 hover:bg-gray-700 dark:hover:bg-gray-600 text-white text-xs rounded-md transition-colors"
                    >
                        {isSending ? (
                            <Spinner size="sm" className="mr-1.5" />
                        ) : (
                            <SendIcon className="size-3.5 mr-1.5" />
                        )}
                        {startButtonText}
                    </Button>
                </div>
                <div className="text-xs text-gray-400 dark:text-gray-500 mt-2 text-center">
                    {stagedFiles.length > 0
                        ? `${stagedFiles.length} file${stagedFiles.length > 1 ? 's' : ''} staged - will upload when conversation starts`
                        : 'Enter to send • Shift+Enter for new line'}
                </div>
            </div>
        </div>
    );
}

// Inner component that handles the agent conversation - similar to ModernAgentOutput
function ModernAgentConversationInner({
    run,
    title,
    interactive = true,
    onClose,
    isModal = false,
    fullWidth = false,
    placeholder = "Type your message...",
    resetWorkflow,
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
    // Attachment callback
    getAttachedDocs,
    onAttachmentsSent,
    // Upload state
    isUploading = false,
    // Context callback
    getMessageContext,
    // Styling props
    inputContainerClassName,
    inputClassName,
    // Fusion fragment data
    fusionData,
    // External file upload API
    fileUploadRef,
    onProcessingFilesChange,
    // External plan panel API
    onPlansChange,
    onWorkstreamStatusChange,
    // External view mode control
    viewMode: controlledViewMode,
    onViewModeChange: onViewModeChangeProp,
}: ModernAgentConversationProps & { run: AsyncExecutionResult }) {
    const { client } = useUserSession();

    // Theme context: resolve cascade into flat classes
    const outerTheme = useConversationTheme();
    const theme = resolveModernAgentConversationTheme(outerTheme?.conversation);

    const bottomRef = useRef<HTMLDivElement | null>(null);
    const conversationRef = useRef<HTMLDivElement | null>(null);
    const [messages, setMessages] = useState<AgentMessage[]>([]);
    const [isCompleted, setIsCompleted] = useState(false);
    const [isSending, setIsSending] = useState(false);
    // View mode: controlled externally when props are provided, otherwise managed locally
    const [internalViewMode, setInternalViewMode] = useState<"stacked" | "sliding">("sliding");
    const viewMode = controlledViewMode ?? internalViewMode;
    const handleViewModeChange = useCallback((mode: "stacked" | "sliding") => {
        if (onViewModeChangeProp) {
            onViewModeChangeProp(mode);
        } else {
            setInternalViewMode(mode);
        }
    }, [onViewModeChangeProp]);
    // Re-provide theme context with runtime viewMode so children read it from context
    const themeWithViewMode = useMemo(() => ({ ...outerTheme, viewMode }), [outerTheme, viewMode]);
    const [showSlidingPanel, setShowSlidingPanel] = useState<boolean>(!isModal);
    const [isStopping, setIsStopping] = useState(false);
    // Keep track of multiple plans and their timestamps
    const [plans, setPlans] = useState<Array<{ plan: Plan; timestamp: number }>>(
        [],
    );
    // Track which plan is currently active in the UI
    const [activePlanIndex, setActivePlanIndex] = useState<number>(0);
    // Store workstream status for each plan separately
    const [workstreamStatusMap, setWorkstreamStatusMap] = useState<
        Map<
            number,
            Map<string, "pending" | "in_progress" | "completed" | "skipped">
        >
    >(new Map());
    const [thinkingMessageIndex, setThinkingMessageIndex] = useState(0);
    const toast = useToast();
    const [showInput, setShowInput] = useState(interactive);
    const [workflowStatus, setWorkflowStatus] = useState<string | null>(null);
    // Track streaming messages by streaming_id for real-time chunk aggregation
    // Include startTimestamp to preserve chronological order when converting to regular messages
    const [streamingMessages, setStreamingMessages] = useState<Map<string, { text: string; workstreamId?: string; isComplete?: boolean; startTimestamp: number; activityId?: string }>>(new Map());

    // Track files being processed by the workflow
    const [processingFiles, setProcessingFiles] = useState<Map<string, ConversationFile>>(new Map());

    // Check if any files are still uploading or processing
    const hasProcessingFiles = useMemo(() =>
        Array.from(processingFiles.values()).some(
            f => f.status === FileProcessingStatus.UPLOADING || f.status === FileProcessingStatus.PROCESSING
        ), [processingFiles]);

    // PERFORMANCE: Refs for values used inside useCallback to avoid re-creating the callback
    const isSendingRef = useRef(isSending);
    isSendingRef.current = isSending;
    const hasProcessingFilesRef = useRef(hasProcessingFiles);
    hasProcessingFilesRef.current = hasProcessingFiles;

    // Performance optimization: Batch streaming updates using RAF
    // Instead of updating state on every chunk (100+ times/sec), batch them per animation frame
    const pendingStreamingChunks = useRef<Map<string, { text: string; workstreamId?: string; isComplete?: boolean; startTimestamp: number; activityId?: string }>>(new Map());
    const streamingFlushScheduled = useRef<number | null>(null);

    // Debug: Visual flash indicator for incoming chunks
    const [debugChunkFlash, setDebugChunkFlash] = useState(false);
    const debugFlashTimeout = useRef<NodeJS.Timeout | null>(null);

    const flushStreamingChunks = useCallback(() => {
        if (pendingStreamingChunks.current.size > 0) {
            setStreamingMessages(new Map(pendingStreamingChunks.current));
            // Flash indicator fires at most once per animation frame instead of per chunk
            setDebugChunkFlash(true);
            if (debugFlashTimeout.current) clearTimeout(debugFlashTimeout.current);
            debugFlashTimeout.current = setTimeout(() => setDebugChunkFlash(false), 50);
        }
        streamingFlushScheduled.current = null;
    }, []);

    // Drag and drop state for full-panel file upload
    const [isDragOver, setIsDragOver] = useState(false);
    const dragCounterRef = useRef(0);

    // Helper function to get the current active plan and its workstream status
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

    // PERFORMANCE: Stabilize callback props to prevent child re-renders
    const handleTogglePlanPanel = useCallback(() => {
        setShowSlidingPanel((prev) => {
            if (!prev) {
                sessionStorage.setItem("plan-panel-shown", "true");
            }
            return !prev;
        });
    }, []);

    const handleChangePlan = useCallback((index: number) => {
        setActivePlanIndex(index);
    }, []);

    const handleClosePlanPanel = useCallback(() => {
        setShowSlidingPanel(false);
    }, []);

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

    const checkWorkflowStatus = async () => {
        try {
            const statusResult = await client.store.workflows.getRunDetails(run.runId, run.workflowId);
            setWorkflowStatus(statusResult.status as string);
        } catch (error) {
            console.error('Failed to check workflow status:', error);
        }
    }

    // Stream messages from the agent
    useEffect(() => {
        // Reset all state when runId changes (new agent)
        setMessages([]);
        setPlans([]);
        setActivePlanIndex(0);
        setWorkstreamStatusMap(new Map());
        setShowSlidingPanel(false);
        setWorkflowStatus(null);
        setStreamingMessages(new Map());

        checkWorkflowStatus();
        client.store.workflows.streamMessages(run.workflowId, run.runId, (message) => {
            // Client now converts compact wire format to AgentMessage internally

            // Handle streaming chunks separately for real-time aggregation
            // PERFORMANCE: Batch updates using RAF instead of immediate state updates
            if (message.type === AgentMessageType.STREAMING_CHUNK) {
                const details = message.details as StreamingChunkDetails;
                // Use activity_id as key if available (for dedup), fall back to streaming_id
                const streamKey = details?.activity_id || details?.streaming_id;
                if (!streamKey) return;

                // Accumulate chunks in the ref (no state update yet)
                const current = pendingStreamingChunks.current.get(streamKey) || {
                    text: '',
                    workstreamId: message.workstream_id,
                    startTimestamp: Date.now(),
                    activityId: details?.activity_id,
                };
                const newText = current.text + (message.message || '');

                pendingStreamingChunks.current.set(streamKey, {
                    text: newText,
                    workstreamId: message.workstream_id,
                    isComplete: details.is_final,
                    startTimestamp: current.startTimestamp,
                    activityId: details?.activity_id,
                });

                // Schedule a flush if not already scheduled (batches ~60 updates/sec max)
                if (streamingFlushScheduled.current === null) {
                    streamingFlushScheduled.current = requestAnimationFrame(flushStreamingChunks);
                }
                return;
            }

            // Handle file processing status updates (SYSTEM messages with system_type: 'file_processing')
            if (message.type === AgentMessageType.SYSTEM) {
                const details = message.details as FileProcessingDetails | undefined;
                if (details?.system_type === 'file_processing' && details.files) {
                    setProcessingFiles(prev => {
                        const newMap = new Map(prev);
                        for (const file of details.files) {
                            newMap.set(file.id, file);
                        }
                        return newMap;
                    });
                    return; // Don't add to messages array - this is status only
                }
                // Other SYSTEM messages fall through to normal handling
            }

            // When THOUGHT or ANSWER arrives with activity_id, remove matching streaming message
            // This prevents duplicate content (streamed content replaced by final message)
            if ((message.type === AgentMessageType.THOUGHT || message.type === AgentMessageType.ANSWER) && message.details?.activity_id) {
                const activityId = message.details.activity_id as string;
                // Remove from pending chunks
                pendingStreamingChunks.current.delete(activityId);
                // Remove from streaming messages state
                setStreamingMessages(prev => {
                    if (prev.has(activityId)) {
                        const next = new Map(prev);
                        next.delete(activityId);
                        return next;
                    }
                    return prev;
                });
            }

            // On COMPLETE or IDLE, just flush any pending chunks
            if (message.type === AgentMessageType.COMPLETE || message.type === AgentMessageType.IDLE) {
                if (pendingStreamingChunks.current.size > 0) {
                    flushStreamingChunks();
                }
            }

            if (message.message) {
                setMessages((prev_messages) => {
                    // Check for duplicate by timestamp
                    if (prev_messages.find((m) => m.timestamp === message.timestamp)) {
                        return prev_messages;
                    }

                    // For QUESTION messages from server, replace any optimistic version
                    if (message.type === AgentMessageType.QUESTION && !message.details?._optimistic) {
                        const withoutOptimistic = prev_messages.filter(
                            (m) => !(m.type === AgentMessageType.QUESTION &&
                                m.details?._optimistic &&
                                m.message === message.message)
                        );
                        insertMessageInTimeline(withoutOptimistic, message);
                        return [...withoutOptimistic];
                    }

                    insertMessageInTimeline(prev_messages, message);
                    return [...prev_messages];
                });
            }
        });

        // Clear messages and unsubscribe when component unmounts or runId changes
        return () => {
            setMessages([]);
            // Cancel any pending streaming flush
            if (streamingFlushScheduled.current !== null) {
                cancelAnimationFrame(streamingFlushScheduled.current);
                streamingFlushScheduled.current = null;
            }
            pendingStreamingChunks.current.clear();
            // Client handles unsubscribing from the message stream internally
        };
    }, [run.runId, client.store.workflows, flushStreamingChunks]);


    // Update completion status when messages change
    // This now accounts for multiple workstreams
    useEffect(() => {
        setIsCompleted(!isInProgress(messages));

        // Only automatically hide the panel when there are no plans
        // But don't auto-show it when plans appear
        if (plans.length === 0) {
            // If there are no plans, make sure the plan panel is hidden
            setShowSlidingPanel(false);
        }
        // We removed the auto-show functionality to allow users to keep the panel closed if they want
    }, [messages, plans.length]);

    // Update plans and workstream status based on incoming messages
    useEffect(() => {
        // Only show the sliding panel for the very first plan and only once
        if (
            plans.length === 1 &&
            !showSlidingPanel &&
            !sessionStorage.getItem("plan-panel-shown")
        ) {
            // For first-time plan detection only, show the panel with a delay
            const notificationTimeout = setTimeout(() => {
                setShowSlidingPanel(true);
                // Mark that we've shown the panel once
                sessionStorage.setItem("plan-panel-shown", "true");
            }, 500); // Short delay to ensure the UI has fully rendered

            return () => clearTimeout(notificationTimeout);
        }

        // Process messages to extract plan information
        messages.forEach((message) => {
            if (message.type === AgentMessageType.PLAN) {
                try {
                    // Log message details for debugging
                    console.log("PLAN message received:", message.type);

                    let newPlanDetails: Plan | null = null;

                    // Extract the plan from the message details object
                    if (message.details && typeof message.details === "object") {
                        // For a PLAN type message like the example you provided
                        if (message.details.plan && Array.isArray(message.details.plan)) {
                            console.log("Valid plan array found in message.details.plan");
                            newPlanDetails = { plan: message.details.plan } as Plan;
                        }
                    }

                    // Only proceed if we have a valid plan
                    if (newPlanDetails) {
                        const timestamp =
                            typeof message.timestamp === "number"
                                ? message.timestamp
                                : new Date(message.timestamp).getTime();

                        // Check if we already have this plan
                        const existingPlanIndex = plans.findIndex(
                            (p) => p.timestamp === timestamp,
                        );

                        if (existingPlanIndex === -1 && newPlanDetails) {
                            console.log("Adding new plan to plans array");
                            // This is a new plan - add it to our plans array
                            const newPlan = {
                                plan: newPlanDetails,
                                timestamp,
                            };

                            // Add new plan to the beginning of the array (newest first)
                            console.log("Adding plan to plans array:", newPlan);
                            setPlans((prev) => {
                                const newPlans = [newPlan, ...prev];
                                console.log("New plans array:", newPlans);
                                return newPlans;
                            });
                            // Set this as the active plan
                            setActivePlanIndex(0);

                            // Automatically show sliding plan panel when a plan is detected
                            console.log("Setting showSlidingPanel to true");
                            setShowSlidingPanel(true);

                            // Initialize workstreams as pending based on the plan tasks
                            const newWorkstreamStatus = new Map<
                                string,
                                "pending" | "in_progress" | "completed" | "skipped"
                            >();

                            // Always initialize main workstream
                            newWorkstreamStatus.set("main", "in_progress");

                            // Initialize each task in the plan with its status
                            if (Array.isArray(newPlanDetails.plan)) {
                                newPlanDetails.plan.forEach((task) => {
                                    if (task && typeof task === "object" && task.id) {
                                        const taskId = task.id.toString();
                                        // Use the task's status if available, otherwise default to pending
                                        newWorkstreamStatus.set(taskId, task.status || "pending");
                                    }
                                });
                            }

                            // Update the workstream status map with the new status for this plan
                            setWorkstreamStatusMap((prev) => {
                                const newMap = new Map(prev);
                                newMap.set(timestamp, newWorkstreamStatus);
                                return newMap;
                            });
                        }
                    }
                } catch (error) {
                    console.error("Failed to parse plan from message:", error);
                }
            }

            // Handle UPDATE type messages with plan updates
            if (message.type === AgentMessageType.UPDATE && message.details) {
                // We no longer process UPDATE messages with details.updates
                // Instead, we rely on the PLAN message that follows with the complete plan
                if (message.details.updates && Array.isArray(message.details.updates)) {
                    console.log(
                        "Ignoring UPDATE message with details.updates - waiting for PLAN message with full plan",
                    );
                    // This is an initial update notification, but we'll wait for the PLAN message that follows
                    // with the complete updated plan before making any UI changes
                }
            }
        });

        const lastMessage = messages[messages.length - 1];
        if (lastMessage) {
            if (lastMessage.type === AgentMessageType.TERMINATED) {
                setShowInput(false);
                setWorkflowStatus("TERMINATED");
            }
            else {
                if (interactive) {
                    setShowInput(true);
                } else {
                    setShowInput(lastMessage.type === AgentMessageType.REQUEST_INPUT);
                }
            }
        }
    }, [messages, plans, activePlanIndex]);

    // Send a message to the agent
    const handleSendMessage = useCallback((message: string) => {
        const trimmed = message.trim();
        if (!trimmed || isSendingRef.current) return;

        // Block if files are still processing
        if (hasProcessingFilesRef.current) {
            toast({
                status: "warning",
                title: "Files Still Processing",
                description: "Please wait for all files to finish processing before sending",
                duration: 3000,
            });
            return;
        }

        setIsSending(true);

        // Add optimistic QUESTION message immediately for better UX
        const optimisticTimestamp = Date.now();
        const optimisticMessage: AgentMessage = {
            timestamp: optimisticTimestamp,
            workflow_run_id: run.runId,
            type: AgentMessageType.QUESTION,
            message: trimmed,
            workstream_id: "main",
            details: { _optimistic: true },
        };

        console.log("[Optimistic] Adding user message:", trimmed);

        setMessages((prev) => {
            const newMessages = [...prev, optimisticMessage];
            // Sort by timestamp to maintain order
            newMessages.sort((a, b) => {
                const timeA = typeof a.timestamp === "number" ? a.timestamp : new Date(a.timestamp).getTime();
                const timeB = typeof b.timestamp === "number" ? b.timestamp : new Date(b.timestamp).getTime();
                return timeA - timeB;
            });
            console.log("[Optimistic] Messages after add:", newMessages.length, "messages");
            return newMessages;
        });

        // Get attached document IDs if callback provided
        const attachedDocs = getAttachedDocs?.() || [];

        // Get additional context metadata if callback provided (e.g., fundId)
        const contextMetadata = getMessageContext?.() || {};

        // Build message content with attachment references if present
        let messageContent = trimmed;
        if (attachedDocs.length > 0 && !/store:\S+/.test(trimmed)) {
            const lines = attachedDocs.map((id) => `store:${id}`);
            messageContent = [trimmed, '', 'Attachments:', ...lines].join('\n');
        }

        // Build metadata combining attached docs and context
        const metadata = {
            ...(attachedDocs.length > 0 ? { attached_docs: attachedDocs } : {}),
            ...contextMetadata,
        };

        client.store.workflows
            .sendSignal(run.workflowId, run.runId, "UserInput", {
                message: messageContent,
                metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
            } as UserInputSignal)
            .then(() => {
                setIsCompleted(false);
                // Clear attachments after successful send
                onAttachmentsSent?.();
            })
            .catch((err) => {
                // Remove optimistic message on failure
                setMessages((prev) => prev.filter((m) => m.timestamp !== optimisticTimestamp));
                toast({
                    status: "error",
                    title: "Failed to Send Message",
                    description: err instanceof Error ? err.message : "Unknown error",
                    duration: 3000,
                });
            })
            .finally(() => {
                setIsSending(false);
            });
    }, [run.runId, run.workflowId, client, toast, getAttachedDocs, getMessageContext, onAttachmentsSent]);

    // Handle file uploads - upload to artifact storage and signal workflow
    const handleFileUpload = useCallback(async (files: File[]) => {
        for (const file of files) {
            const fileId = `file-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            const artifactPath = `files/${file.name}`;

            // Add to local state immediately (optimistic - uploading status)
            const fileState: ConversationFile = {
                id: fileId,
                name: file.name,
                content_type: file.type || 'application/octet-stream',
                size: file.size,
                status: FileProcessingStatus.UPLOADING,
                started_at: Date.now(),
            };

            setProcessingFiles(prev => new Map(prev).set(fileId, fileState));

            try {
                // Upload to artifact storage
                await client.files.uploadArtifact(run.runId, artifactPath, file);

                // Update local state to processing
                setProcessingFiles(prev => {
                    const newMap = new Map(prev);
                    const f = newMap.get(fileId);
                    if (f) {
                        f.status = FileProcessingStatus.PROCESSING;
                        f.artifact_path = artifactPath;
                        f.reference = `artifact:${artifactPath}`;
                    }
                    return newMap;
                });

                // Signal workflow that file was uploaded
                await client.store.workflows.sendSignal(
                    run.workflowId,
                    run.runId,
                    "FileUploaded",
                    {
                        id: fileId,
                        name: file.name,
                        content_type: file.type || 'application/octet-stream',
                        reference: `artifact:${artifactPath}`,
                        artifact_path: artifactPath,
                    } as ConversationFileRef
                );

            } catch (error) {
                // Update local state to error
                setProcessingFiles(prev => {
                    const newMap = new Map(prev);
                    const f = newMap.get(fileId);
                    if (f) {
                        f.status = FileProcessingStatus.ERROR;
                        f.error = error instanceof Error ? error.message : 'Upload failed';
                        f.completed_at = Date.now();
                    }
                    return newMap;
                });

                toast({
                    status: "error",
                    title: "Upload Failed",
                    description: error instanceof Error ? error.message : "Failed to upload file",
                    duration: 3000,
                });
            }
        }
    }, [client, run, toast]);

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

    // Drag and drop handlers for full-panel file upload
    const handleDragEnter = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        dragCounterRef.current++;
        // Enable drag if we have a run (for internal file processing)
        if (run && e.dataTransfer?.types?.includes('Files')) {
            setIsDragOver(true);
        }
    }, [run]);

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

        // Use internal handleFileUpload for proper workflow signaling and status tracking
        if (run && e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
            const filesArray = Array.from(e.dataTransfer.files);
            handleFileUpload(filesArray);
        }
    }, [run, handleFileUpload]);

    // Stop/interrupt the active workflow
    const handleStopWorkflow = async () => {
        if (isStopping) return;

        setIsStopping(true);
        try {
            await client.store.workflows.sendSignal(run.workflowId, run.runId, "Stop", {
                message: "User requested stop",
            });

            toast({
                status: "info",
                title: "Agent Interrupted",
                description: "Type your message to give new instructions",
                duration: 3000,
            });
            setIsCompleted(true);
        } catch (err) {
            toast({
                status: "error",
                title: "Failed to Interrupt",
                description: err instanceof Error ? err.message : "Unknown error",
                duration: 3000,
            });
        } finally {
            setIsStopping(false);
        }
    };

    // Calculate number of active tasks for the status indicator
    const getActiveTaskCount = (): number => {
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

    const actualTitle =
        title || run.workflowId.split(":")[2] || "Agent Conversation";

    // Handle downloading conversation
    const downloadConversation = async () => {
        try {
            const url = await getConversationUrl(client, run.runId);
            if (url) window.open(url, "_blank");
        } catch (err) {
            console.error("Failed to download conversation", err);
            toast({
                status: "error",
                title: "Failed to download conversation",
                duration: 3000,
            });
        }
    };

    // Handle copying run ID
    const copyRunId = () => {
        navigator.clipboard.writeText(run.runId);
        toast({
            status: "success",
            title: "Run ID copied",
            duration: 2000,
        });
    };

    const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);

    const exportConversationPdf = () => {
        if (!conversationRef.current) {
            toast({
                status: "error",
                title: "PDF export failed",
                description: "No conversation content available to export",
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
                title: "PDF export failed",
                description: "No conversation content available to export",
                duration: 3000,
            });
            return;
        }

        const pdfTitle = `${actualTitle} - ${run.runId}`;
        const success = printElementToPdf(conversationRef.current, pdfTitle);

        if (!success) {
            toast({
                status: "error",
                title: "PDF export failed",
                description: "Unable to open print preview",
                duration: 4000,
            });
            return;
        }

        toast({
            status: "success",
            title: "PDF export ready",
            description: "Use your browser's Print dialog to save as PDF",
            duration: 4000,
        });
        setIsPdfModalOpen(false);
    };

    // PERFORMANCE: Memoize taskLabels to prevent AllMessagesMixed re-renders
    const taskLabels = useMemo(() =>
        getActivePlan.plan.plan?.reduce((acc, task) => {
            if (task.id && task.goal) acc.set(task.id.toString(), task.goal);
            return acc;
        }, new Map<string, string>()),
    [getActivePlan.plan]);

    // Main content - wrapped with FusionFragmentProvider when fusionData is provided
    const mainContent = (
        <ConversationThemeProvider theme={themeWithViewMode}>
        <ArtifactUrlCacheProvider>
        <ImageLightboxProvider>
        <div
            className={cn("flex flex-col lg:flex-row gap-2 h-full relative overflow-hidden", isDragOver && "ring-2 ring-blue-400 ring-inset", theme.root)}
            onDragEnter={handleDragEnter}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
        >
            {/* Drag overlay for full-panel file drop */}
            {isDragOver && (
                <div className={cn("absolute inset-0 flex items-center justify-center bg-blue-100/80 dark:bg-blue-900/40 z-50 pointer-events-none rounded-lg", theme.dragOverlay)}>
                    <div className="text-blue-600 dark:text-blue-400 font-medium flex items-center gap-2 text-lg">
                        <UploadIcon className="size-6" />
                        Drop files to upload
                    </div>
                </div>
            )}
            {/* Conversation Area - responsive width based on panel visibility */}
            <div
                ref={conversationRef}
                className={cn(
                    "flex flex-col min-h-0 border-0",
                    showSlidingPanel
                        ? "w-full lg:w-2/3 flex-1 min-h-[50vh]"
                        : fullWidth
                            ? "flex-1 w-full"
                            : `flex-1 mx-auto ${!isModal ? "max-w-4xl" : ""}`,
                    theme.conversationArea
                )}
            >
                {/* Streaming activity indicator moved to Header */}

                {/* Header - flex-shrink-0 to prevent shrinking */}
                <div className={cn("flex-shrink-0", theme.headerWrapper)}>
                    <Header
                        title={actualTitle}
                        isCompleted={isCompleted}
                        onClose={onClose}
                        isModal={isModal}
                        run={run}
                        viewMode={viewMode}
                        onViewModeChange={handleViewModeChange}
                        showPlanPanel={showSlidingPanel}
                        hasPlan={plans.length > 0}
                        onTogglePlanPanel={handleTogglePlanPanel}
                        onDownload={downloadConversation}
                        onCopyRunId={copyRunId}
                        resetWorkflow={resetWorkflow}
                        onExportPdf={exportConversationPdf}
                        isReceivingChunks={debugChunkFlash}
                    />
                </div>

                {messages.length === 0 && !isCompleted ? (
                    <div className={cn("flex-1 flex flex-col items-center justify-center h-full text-center py-6", theme.emptyState)}>
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
                        showPlanPanel={showSlidingPanel}
                        onTogglePlanPanel={handleTogglePlanPanel}
                        plans={plans}
                        activePlanIndex={activePlanIndex}
                        onChangePlan={handleChangePlan}
                        taskLabels={taskLabels}
                        streamingMessages={streamingMessages}
                        onSendMessage={handleSendMessage}
                        thinkingMessageIndex={thinkingMessageIndex}
                    />
                )}

                {/* Show workflow status message when not running, or show input when running/unknown */}
                {/* Input area - flex-shrink-0 to stay pinned at bottom, with iOS safe area support */}
                <div className={cn("flex-shrink-0", theme.inputWrapper)} style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
                    {workflowStatus && workflowStatus !== "RUNNING" ? (
                        <MessageBox
                            status={workflowStatus === "COMPLETED" ? 'success' : 'done'}
                            icon={null}
                            className="m-2"
                        >
                            This Workflow is {workflowStatus}
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
                            placeholder={placeholder}
                            // File upload props - use internal handler that signals workflow
                            onFilesSelected={handleFileUpload}
                            uploadedFiles={uploadedFiles}
                            onRemoveFile={onRemoveFile}
                            acceptedFileTypes={acceptedFileTypes}
                            maxFiles={maxFiles}
                            // File processing state
                            processingFiles={processingFiles}
                            hasProcessingFiles={hasProcessingFiles}
                            // Document search props
                            renderDocumentSearch={renderDocumentSearch}
                            selectedDocuments={selectedDocuments}
                            onRemoveDocument={onRemoveDocument}
                            // Object linking
                            hideObjectLinking={hideObjectLinking}
                            // Styling props
                            className={inputContainerClassName}
                            inputClassName={inputClassName}
                        />
                    )}
                </div>
            </div>

            {/* Plan Panel Area - only rendered when panel should be shown */}
            {showSlidingPanel && (
                <div className={cn("w-full lg:w-1/3 min-h-[50vh] lg:h-full border-t lg:border-t-0 lg:border-l", theme.planPanel)}>
                    <InlineSlidingPlanPanel
                        plan={getActivePlan.plan}
                        workstreamStatus={getActivePlan.workstreamStatus}
                        isOpen={showSlidingPanel}
                        onClose={handleClosePlanPanel}
                        plans={plans}
                        activePlanIndex={activePlanIndex}
                        onChangePlan={handleChangePlan}
                    />
                </div>
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
        </ConversationThemeProvider>
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
                artifactRunId={run.runId}
            >
                {mainContent}
            </FusionFragmentProvider>
        );
    }

    return mainContent;
}

// Helper function to get conversation URL - used by other components
export async function getConversationUrl(
    vertesia: VertesiaClient,
    workflowRunId: string,
): Promise<string> {
    return vertesia.files
        .getDownloadUrl(`agents/${workflowRunId}/conversation.json`)
        .then((r) => r.url);
}
