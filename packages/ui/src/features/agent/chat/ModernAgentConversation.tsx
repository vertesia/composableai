import {
    type ActiveWorkstreamEntry,
    type AgentMessage,
    AgentMessageType,
    type AgentRun,
    type AgentToolApprovalMode,
    type CompletedWorkstreamEntry,
    type ConversationFile,
    type ConversationFileRef,
    type McpConnectUxConfig,
    normalizeAgentToolApprovalMode,
    type Plan,
    type StopSignal,
    type UserInputSignal,
} from '@vertesia/common';
import { FusionFragmentProvider } from '@vertesia/fusion-ux';
import {
    Button,
    cn,
    insertNewlineAtCursor,
    MessageBox,
    Modal,
    ModalBody,
    ModalFooter,
    ModalTitle,
    Spinner,
    Textarea,
    useToast,
} from '@vertesia/ui/core';
import { useUITranslation } from '@vertesia/ui/i18n';
import { useUserSession } from '@vertesia/ui/session';
import { ArrowUpIcon, Bot, CheckCircle, Cpu, FileTextIcon, UploadIcon, XIcon } from 'lucide-react';
import type React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { McpConnectionsActionMenu } from '../../oauth/McpConnectionsButton.js';
import { AgentApprovalModeSelector } from './AgentApprovalModeSelector';
import { AgentChatPlaybackControls } from './AgentChatPlaybackControls';
import { AgentRequestInputOverlay } from './AgentRequestInputOverlay';
import { AgentRightPanel, type WorkstreamInfo } from './AgentRightPanel.js';
import { AnimatedThinkingDots, PulsatingCircle } from './AnimatedThinkingDots';
import { extractFilesFromClipboard } from './clipboardFiles.js';
import { useAgentPlans } from './hooks/useAgentPlans.js';
import { useAgentStream } from './hooks/useAgentStream.js';
import { useDocumentPanel } from './hooks/useDocumentPanel.js';
import { useFileProcessing } from './hooks/useFileProcessing.js';
import { ImageLightboxProvider } from './ImageLightbox';
import { ActiveWorkstreamsSummary } from './ModernAgentOutput/ActiveWorkstreamsSummary';
import type {
    AgentConversationViewMode,
    AgentInitialRequestTemplate,
    AgentInitialRequestTemplateContext,
} from './ModernAgentOutput/AllMessagesMixed';
import AllMessagesMixed from './ModernAgentOutput/AllMessagesMixed';
import type { BatchProgressPanelClassNames } from './ModernAgentOutput/BatchProgressPanel';
import Header from './ModernAgentOutput/Header';
import MessageInput, {
    type ContextWindowUsage,
    type SelectedDocument,
    type UploadedFile,
} from './ModernAgentOutput/MessageInput';
import type { MessageItemClassNames } from './ModernAgentOutput/MessageItem';
import { getPendingRequestInputMessage } from './ModernAgentOutput/requestInputMessages';
import type { StreamingMessageClassNames } from './ModernAgentOutput/StreamingMessage';
import type { ToolCallGroupClassNames } from './ModernAgentOutput/ToolCallGroup';
import {
    debugAgentChat,
    filterMessagesForActiveWorkstream,
    getConversationUrl,
    getWorkstreamId,
    isInProgress,
} from './ModernAgentOutput/utils';
import {
    type AgentChatPlaybackCursor,
    createPlaybackState,
    getPlaybackCursorIndex,
    isAgentChatPlaybackAvailable,
    isAgentChatPlaybackEnabled,
} from './playback';
import { SkillWidgetProvider } from './SkillWidgetProvider';
import { ArtifactUrlCacheProvider } from './useArtifactUrlCache.js';
import { VegaLiteChart } from './VegaLiteChart';
import { ThinkingMessages } from './WaitingMessages';
import {
    getWorkstreamDisplayName,
    getWorkstreamLaunchDetails,
    getWorkstreamLifecycleStatus,
    isWorkstreamInternalResultMessage,
} from './workstreams.js';

export interface StartWorkflowOptions {
    tool_approval_mode?: AgentToolApprovalMode;
}

export type StartWorkflowFn = (
    initialMessage?: string,
    options?: StartWorkflowOptions,
) => Promise<{ agent_run_id: string } | undefined>;

const EMPTY_STREAMING_MESSAGES = new Map<string, never>();

function getTimestampMs(timestamp: number | string | undefined): number {
    if (typeof timestamp === 'number') return timestamp;
    if (!timestamp) return Date.now();
    const parsed = new Date(timestamp).getTime();
    return Number.isFinite(parsed) ? parsed : Date.now();
}

type DerivedWorkstreamInfo = WorkstreamInfo & {
    started_at: number;
    updated_at: number;
    order: number;
};

function isActiveWorkstreamStatus(status: WorkstreamInfo['status']) {
    return status === 'running' || status === 'canceling';
}

function isTerminalWorkstreamStatus(status: WorkstreamInfo['status']) {
    return !isActiveWorkstreamStatus(status);
}

function getNumberDetail(value: unknown): number | undefined {
    return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function toContextWindowUsage(messages: AgentMessage[]): ContextWindowUsage | undefined {
    for (let index = messages.length - 1; index >= 0; index--) {
        const details = messages[index].details;
        if (!details) continue;

        const tokenUsage = details.token_usage as { total?: unknown } | undefined;
        const usedTokens = getNumberDetail(tokenUsage?.total);
        const checkpointTokens =
            getNumberDetail(details.checkpoint_threshold) ?? getNumberDetail(details.checkpoint_at);

        if (typeof usedTokens !== 'number' || typeof checkpointTokens !== 'number' || checkpointTokens <= 0) {
            continue;
        }

        const usedPercent = Math.max(0, Math.min(100, Math.round((usedTokens / checkpointTokens) * 100)));
        return {
            usedTokens,
            checkpointTokens,
            usedPercent,
            remainingPercent: Math.max(0, 100 - usedPercent),
        };
    }

    return undefined;
}

function mergePreservingTerminalStatus(existing: WorkstreamInfo, next: WorkstreamInfo): WorkstreamInfo {
    if (!isTerminalWorkstreamStatus(existing.status) || !isActiveWorkstreamStatus(next.status)) {
        return { ...existing, ...next };
    }

    return {
        ...existing,
        interaction: existing.interaction ?? next.interaction,
        elapsed_ms: Math.max(existing.elapsed_ms, next.elapsed_ms),
        deadline_ms: Math.max(existing.deadline_ms, next.deadline_ms),
        remaining_ms: 0,
        phase: existing.phase ?? next.phase,
        child_workflow_id: existing.child_workflow_id ?? next.child_workflow_id,
        child_workflow_run_id: existing.child_workflow_run_id ?? next.child_workflow_run_id,
    };
}

function getWorkstreamMessageDetails(message: AgentMessage): {
    workstreamId: string;
    launchId?: string;
    interaction?: string;
    childWorkflowId?: string;
    childWorkflowRunId?: string;
} | null {
    const details = message.details as
        | {
              workstream_id?: unknown;
              launch_id?: unknown;
              interaction?: unknown;
              child_workflow_id?: unknown;
              child_workflow_run_id?: unknown;
          }
        | undefined;

    const workstreamId =
        typeof details?.workstream_id === 'string' && details.workstream_id.trim()
            ? details.workstream_id
            : getWorkstreamId(message);

    if (workstreamId === 'main' || workstreamId === 'all') return null;

    return {
        workstreamId,
        launchId: typeof details?.launch_id === 'string' ? details.launch_id : undefined,
        interaction: typeof details?.interaction === 'string' ? details.interaction : undefined,
        childWorkflowId: typeof details?.child_workflow_id === 'string' ? details.child_workflow_id : undefined,
        childWorkflowRunId:
            typeof details?.child_workflow_run_id === 'string' ? details.child_workflow_run_id : undefined,
    };
}

function isWorkstreamActivityFailureMessage(message: AgentMessage): boolean {
    if (message.type !== AgentMessageType.ERROR) return false;

    const details = message.details as
        | {
              activity_group_id?: unknown;
              event_class?: unknown;
              tool?: unknown;
              tool_event?: unknown;
              tool_run_id?: unknown;
              tool_status?: unknown;
              workstream_event?: unknown;
          }
        | undefined;

    if (details?.event_class !== 'activity') return false;
    if (details.workstream_event) return false;

    return !(
        details.tool ||
        details.tool_status ||
        details.tool_run_id ||
        details.activity_group_id ||
        details.tool_event
    );
}

function ensureWorkstreamRecord(
    records: Map<string, DerivedWorkstreamInfo>,
    latestKeyByWorkstream: Map<string, string>,
    workstreamId: string,
    launchId: string | undefined,
    timestamp: number,
    order: number,
): DerivedWorkstreamInfo {
    if (launchId) {
        const previousKey = latestKeyByWorkstream.get(workstreamId);
        if (previousKey?.startsWith('message-derived:')) {
            const previous = records.get(previousKey);
            if (previous) {
                records.delete(previousKey);
                records.set(launchId, {
                    ...previous,
                    launch_id: launchId,
                    updated_at: Math.max(previous.updated_at, timestamp),
                });
            }
        }
        latestKeyByWorkstream.set(workstreamId, launchId);
    }

    const key = launchId ?? latestKeyByWorkstream.get(workstreamId) ?? `message-derived:${workstreamId}`;
    const existing = records.get(key);
    if (existing) return existing;

    const record: DerivedWorkstreamInfo = {
        workstream_id: workstreamId,
        launch_id: key,
        elapsed_ms: 0,
        deadline_ms: 0,
        remaining_ms: 0,
        status: 'running',
        started_at: timestamp,
        updated_at: timestamp,
        order,
    };
    records.set(key, record);
    if (!latestKeyByWorkstream.has(workstreamId)) latestKeyByWorkstream.set(workstreamId, key);
    return record;
}

function deriveWorkstreamsFromMessages(messages: AgentMessage[]): WorkstreamInfo[] {
    const records = new Map<string, DerivedWorkstreamInfo>();
    const latestKeyByWorkstream = new Map<string, string>();

    messages.forEach((message, order) => {
        const timestamp = getTimestampMs(message.timestamp);
        const details = getWorkstreamMessageDetails(message);
        const launchDetails = getWorkstreamLaunchDetails(message);
        const workstreamId = launchDetails?.workstreamId ?? details?.workstreamId;
        if (!workstreamId) return;

        const launchId = launchDetails?.launchId ?? details?.launchId;
        const isInternalResult = isWorkstreamInternalResultMessage(message);
        if (!launchDetails && !launchId && isInternalResult && !latestKeyByWorkstream.has(workstreamId)) return;

        const record = ensureWorkstreamRecord(records, latestKeyByWorkstream, workstreamId, launchId, timestamp, order);

        if (launchDetails) {
            record.interaction = launchDetails.interaction ?? record.interaction;
            record.child_workflow_id = launchDetails.childWorkflowId ?? record.child_workflow_id;
            record.child_workflow_run_id = launchDetails.childWorkflowRunId ?? record.child_workflow_run_id;
            record.status = 'running';
        } else {
            record.interaction = details?.interaction ?? record.interaction;
            record.child_workflow_id = details?.childWorkflowId ?? record.child_workflow_id;
            record.child_workflow_run_id = details?.childWorkflowRunId ?? record.child_workflow_run_id;
        }

        const lifecycleStatus = getWorkstreamLifecycleStatus(message);
        if (lifecycleStatus) {
            record.status = lifecycleStatus;
        } else if (!isInternalResult) {
            if (isWorkstreamActivityFailureMessage(message)) {
                record.status = 'failed';
            } else if (message.type === AgentMessageType.COMPLETE || message.type === AgentMessageType.IDLE) {
                record.status = 'completed';
            }
        }

        if (isInternalResult) return;

        record.updated_at = Math.max(record.updated_at, timestamp);
        if (isActiveWorkstreamStatus(record.status)) {
            record.elapsed_ms = Math.max(record.elapsed_ms, timestamp - record.started_at);
        } else {
            record.elapsed_ms = Math.max(record.elapsed_ms, timestamp - record.started_at);
            record.remaining_ms = 0;
        }
    });

    return Array.from(records.values())
        .sort((a, b) => {
            const activeDelta =
                Number(!isActiveWorkstreamStatus(a.status)) - Number(!isActiveWorkstreamStatus(b.status));
            if (activeDelta !== 0) return activeDelta;
            if (isActiveWorkstreamStatus(a.status)) return a.order - b.order;
            return b.updated_at - a.updated_at || a.order - b.order;
        })
        .map(({ started_at, updated_at, order, ...workstream }) => workstream);
}

function activeWorkstreamEntryToInfo(ws: ActiveWorkstreamEntry): WorkstreamInfo {
    return {
        workstream_id: ws.workstream_id,
        launch_id: ws.launch_id,
        interaction: ws.interaction,
        elapsed_ms: ws.elapsed_ms,
        deadline_ms: ws.deadline_ms,
        remaining_ms: Math.max(0, ws.deadline_ms - ws.elapsed_ms),
        status: ws.status,
        phase: ws.latest_progress?.phase,
        child_workflow_id: ws.child_workflow_id,
        child_workflow_run_id: ws.child_workflow_run_id,
    };
}

function completedWorkstreamEntryToInfo(ws: CompletedWorkstreamEntry): WorkstreamInfo {
    return {
        workstream_id: ws.workstream_id,
        launch_id: ws.launch_id,
        interaction: ws.interaction,
        elapsed_ms: ws.duration_ms ?? 0,
        deadline_ms: 0,
        remaining_ms: 0,
        status: ws.status,
        phase: ws.last_progress?.phase,
        child_workflow_id: ws.child_workflow_id,
        child_workflow_run_id: ws.child_workflow_run_id,
    };
}

function mergeWorkstreamInfo(workstreams: WorkstreamInfo[], next: WorkstreamInfo) {
    const existingIndex = workstreams.findIndex((ws) => ws.launch_id === next.launch_id);
    if (existingIndex >= 0) {
        workstreams[existingIndex] = mergePreservingTerminalStatus(workstreams[existingIndex], next);
        return;
    }

    const fallbackIndex = workstreams.findIndex(
        (ws) => ws.workstream_id === next.workstream_id && ws.launch_id.startsWith('message-derived:'),
    );
    if (fallbackIndex >= 0 && !next.launch_id.startsWith('message-derived:')) {
        workstreams[fallbackIndex] = mergePreservingTerminalStatus(workstreams[fallbackIndex], next);
        return;
    }

    workstreams.push(next);
}

function formatCompactDuration(seconds: number): string {
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
}

function useElapsedSeconds(timestamp?: number | string, enabled = true): number {
    const [elapsed, setElapsed] = useState(() =>
        Math.max(0, Math.floor((Date.now() - getTimestampMs(timestamp)) / 1000)),
    );

    useEffect(() => {
        if (!enabled) return;

        const updateElapsed = () => {
            setElapsed(Math.max(0, Math.floor((Date.now() - getTimestampMs(timestamp)) / 1000)));
        };

        updateElapsed();
        const intervalId = window.setInterval(updateElapsed, 1000);
        return () => window.clearInterval(intervalId);
    }, [enabled, timestamp]);

    return elapsed;
}

function useThinkingMessageIndex(enabled = true): number {
    const [thinkingMessageIndex, setThinkingMessageIndex] = useState(0);

    useEffect(() => {
        if (!enabled) return;

        const intervalId = window.setInterval(() => {
            setThinkingMessageIndex(() => Math.floor(Math.random() * ThinkingMessages.length));
        }, 4000);
        return () => window.clearInterval(intervalId);
    }, [enabled]);

    return thinkingMessageIndex;
}

function PendingStartConversation({ message, startedAt }: { message: string; startedAt: number }) {
    const { t } = useUITranslation();
    const elapsed = useElapsedSeconds(startedAt);
    const thinkingMessageIndex = useThinkingMessageIndex();

    return (
        <div className="mx-auto flex min-h-full w-full max-w-3xl flex-col justify-end gap-6 px-1 py-8">
            <div className="flex w-full justify-end">
                <div
                    className={cn(
                        'max-w-[min(44rem,82%)] rounded-[1.35rem] bg-mixer-muted/35 px-4 py-2.5',
                        'break-words text-sm font-normal leading-6 text-foreground/90 shadow-sm shadow-black/5',
                        'dark:bg-mixer-muted/15 dark:text-foreground/88 dark:shadow-none [overflow-wrap:anywhere]',
                    )}
                >
                    <div className="whitespace-pre-wrap">{message}</div>
                </div>
            </div>
            <div className="border-b border-border/70 pb-4 text-sm text-muted">
                <div className="flex items-center gap-3">
                    <PulsatingCircle size="sm" color="blue" />
                    <div className="min-w-0">
                        <div>
                            <span className="font-medium">{t('agent.preparing')}</span>
                            <span className="ms-2 text-muted/75">for {formatCompactDuration(elapsed)}</span>
                        </div>
                        <div className="mt-1 truncate text-muted/80">{ThinkingMessages[thinkingMessageIndex]}</div>
                    </div>
                </div>
                <div className="mt-3 ps-6">
                    <AnimatedThinkingDots color="blue" />
                </div>
            </div>
        </div>
    );
}

function printElementToPdf(sourceElement: HTMLElement, title: string): boolean {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
        return false;
    }

    // Use a hidden iframe to avoid opening a new window
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    iframe.style.visibility = 'hidden';
    document.body.appendChild(iframe);

    const iframeWindow = iframe.contentWindow;
    if (!iframeWindow) {
        iframe.parentNode?.removeChild(iframe);
        return false;
    }

    const doc = iframeWindow.document;
    doc.open();
    // Write a static skeleton only; the (untrusted) title is assigned via doc.title below,
    // which sets it as text and avoids constructing HTML from input (CodeQL js/html-constructed-from-input).
    doc.write('<!doctype html><html><head><title></title></head><body></body></html>');
    doc.close();
    doc.title = title;

    const styles = document.querySelectorAll<HTMLLinkElement | HTMLStyleElement>('link[rel="stylesheet"], style');
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

function trimHyphens(value: string): string {
    let start = 0;
    let end = value.length;
    while (start < end && value[start] === '-') start++;
    while (end > start && value[end - 1] === '-') end--;
    return value.slice(start, end);
}

function sanitizeFilenamePart(value: string): string {
    return trimHyphens(value.trim().replace(/[^a-z0-9-_]+/gi, '-')).slice(0, 80);
}

function downloadJsonFile(filename: string, payload: unknown) {
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
}

export interface ModernAgentConversationProps {
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
    /** Called after a clone succeeds — receives the new AgentRun for navigation */
    onClone?: (newRun: AgentRun) => void;
    /** Called to show run details/internals modal */
    onShowDetails?: () => void;
    /** Whether workflow control actions such as cancel should be shown. */
    allowWorkflowControl?: boolean;

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
    onWorkstreamStatusChange?: (
        statusMap: Map<number, Map<string, 'pending' | 'in_progress' | 'completed' | 'skipped'>>,
    ) => void;

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
    /** Header density. Use compact when the surrounding page already identifies the run. */
    headerVariant?: 'full' | 'compact';
    /** Hide the internal message input (for apps that render their own) */
    hideMessageInput?: boolean;
    /** Custom action shown in place of the input box when the run status is FAILED.
     *  When omitted, the default "This Workflow is FAILED" message box is shown. */
    failedAction?: React.ReactNode;
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
    /** Message types to exclude from the conversation view */
    hiddenMessageTypes?: AgentMessageType[];

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
    messageStyleOverrides?: import('./ModernAgentOutput/MessageItem').MessageItemProps['messageStyleOverrides'];
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
    /** Optional structured request data to render as the first user entry in the conversation. */
    initialRequestData?: unknown;
    /** Optional schema used by the default request renderer. */
    initialRequestSchema?: AgentInitialRequestTemplateContext['schema'];
    /** Optional label/title for the default structured request renderer. */
    initialRequestTitle?: string;
    /** Optional agent-specific request renderer for arbitrary input schemas. */
    initialRequestTemplate?: AgentInitialRequestTemplate;

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
    /** Internal optimistic first message shown while a newly-started run is waiting for persisted messages. */
    pendingStartMessage?: string;
    /** Timestamp for the internal optimistic first-message waiting state. */
    pendingStartTimestamp?: number;
    /** Initial approval mode to show while active run metadata loads. */
    initialToolApprovalMode?: AgentToolApprovalMode;
    /** Force display playback controls on or off. When omitted, local playback can be toggled from the header. */
    enablePlayback?: boolean;
    /** Show a local toggle for display playback controls in the conversation action rail. */
    showPlaybackToggle?: boolean;
}

export function ModernAgentConversation(props: ModernAgentConversationProps) {
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
        <MessageBox status="info" icon={<Bot className="size-16 text-muted mb-4" />}>
            <div className="text-base font-medium text-muted">{t('agent.noAgentRunning')}</div>
            <div className="mt-3 text-sm text-muted">{t('agent.selectInteraction')}</div>
        </MessageBox>
    );
}

// Start workflow view - allows initiating a new agent conversation
// Files can be staged locally before workflow starts, then uploaded when the workflow is created
function StartWorkflowView({
    initialMessage,
    interactive = true,
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
    hideHeader = false,
    hideFileUpload = false,
    hideObjectLinking,
    headerVariant,
    inputContainerClassName,
    inputClassName,
    className,
    allowWorkflowControl,
}: ModernAgentConversationProps) {
    const { t } = useUITranslation();
    const canStageFiles = !hideFileUpload;
    const resolvedPlaceholder = placeholder ?? t('agent.typeYourMessage');
    const resolvedStartButtonText = startButtonText ?? t('agent.startAgent');
    const resolvedTitle = title ?? t('agent.startNewConversation');
    const { client } = useUserSession();
    const [inputValue, setInputValue] = useState<string>('');
    const [isSending, setIsSending] = useState(false);
    const [startedAgentRunId, setStartedAgentRunId] = useState<string | null>(null);
    const [pendingStartMessage, setPendingStartMessage] = useState<string | null>(null);
    const [pendingStartTimestamp, setPendingStartTimestamp] = useState<number | null>(null);
    const [toolApprovalMode, setToolApprovalMode] = useState<AgentToolApprovalMode>(() =>
        normalizeAgentToolApprovalMode(undefined, interactive),
    );
    const toast = useToast();
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Staged files - stored locally until workflow starts
    const [stagedFiles, setStagedFiles] = useState<File[]>([]);

    // Drag and drop state
    const [isDragOver, setIsDragOver] = useState(false);
    const dragCounterRef = useRef(0);

    // Drag and drop handlers for file staging
    const handleDragEnter = useCallback(
        (e: React.DragEvent) => {
            if (!canStageFiles) return;
            e.preventDefault();
            e.stopPropagation();
            dragCounterRef.current++;
            if (e.dataTransfer?.types?.includes('Files')) {
                setIsDragOver(true);
            }
        },
        [canStageFiles],
    );

    const handleDragOver = useCallback(
        (e: React.DragEvent) => {
            if (!canStageFiles) return;
            e.preventDefault();
            e.stopPropagation();
        },
        [canStageFiles],
    );

    const handleDragLeave = useCallback(
        (e: React.DragEvent) => {
            if (!canStageFiles) return;
            e.preventDefault();
            e.stopPropagation();
            dragCounterRef.current--;
            if (dragCounterRef.current === 0) {
                setIsDragOver(false);
            }
        },
        [canStageFiles],
    );

    const handleDrop = useCallback(
        (e: React.DragEvent) => {
            if (!canStageFiles) return;
            e.preventDefault();
            e.stopPropagation();
            dragCounterRef.current = 0;
            setIsDragOver(false);

            if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
                const filesArray = Array.from(e.dataTransfer.files);
                setStagedFiles((prev) => {
                    const newFiles = [...prev, ...filesArray].slice(0, maxFiles);
                    return newFiles;
                });
            }
        },
        [maxFiles, canStageFiles],
    );

    // Paste handler for files — mirrors MessageInput.handlePaste so the start
    // screen and the live chat both accept pasted clipboard images/files. Files
    // are staged locally here; they get uploaded when the workflow starts.
    const handlePaste = useCallback(
        (e: React.ClipboardEvent) => {
            if (!canStageFiles) return;
            const files = extractFilesFromClipboard(e.clipboardData?.items);
            if (files.length > 0) {
                setStagedFiles((prev) => [...prev, ...files].slice(0, maxFiles));
            }
        },
        [canStageFiles, maxFiles],
    );

    const handleFileInputChange = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => {
            if (e.target.files && e.target.files.length > 0) {
                const filesArray = Array.from(e.target.files);
                setStagedFiles((prev) => {
                    const newFiles = [...prev, ...filesArray].slice(0, maxFiles);
                    return newFiles;
                });
            }
            // Reset input so the same file can be selected again
            e.target.value = '';
        },
        [maxFiles],
    );

    const removeStagedFile = useCallback((index: number) => {
        setStagedFiles((prev) => prev.filter((_, i) => i !== index));
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
            sessionStorage.removeItem('plan-panel-shown');

            toast({
                title:
                    canStageFiles && stagedFiles.length > 0
                        ? t('agent.startingAgentUploading')
                        : t('agent.startingAgent'),
                status: 'info',
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
            if (canStageFiles && stagedFiles.length > 0) {
                const fileNames = stagedFiles.map((f) => f.name).join(', ');
                messageContent = [
                    messageContent,
                    '',
                    `[System: ${stagedFiles.length} file(s) are being uploaded: ${fileNames}. Please wait for the "Files Ready" notification before processing them.]`,
                ].join('\n');
            }

            setPendingStartMessage(messageContent);
            setPendingStartTimestamp(Date.now());

            const newRun = await startWorkflow(messageContent, { tool_approval_mode: toolApprovalMode });
            if (newRun) {
                const agentId = newRun.agent_run_id;

                // Upload staged files to the new run's artifact space and signal agent
                const uploadedFiles: string[] = [];
                if (canStageFiles && stagedFiles.length > 0) {
                    for (const file of stagedFiles) {
                        try {
                            const artifactPath = `files/${file.name}`;
                            await client.agents.uploadArtifact(agentId, artifactPath, file);

                            // Signal agent that file was uploaded
                            await client.agents.sendSignal(agentId, 'FileUploaded', {
                                id: `file-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                                name: file.name,
                                content_type: file.type || 'application/octet-stream',
                                reference: `artifact:${artifactPath}`,
                                artifact_path: artifactPath,
                            } as ConversationFileRef);
                            uploadedFiles.push(file.name);
                        } catch (uploadErr) {
                            console.error(`Failed to upload staged file ${file.name}:`, uploadErr);
                            // Continue with other files
                        }
                    }

                    // Send a follow-up message to notify the agent that all files are ready
                    if (uploadedFiles.length > 0) {
                        try {
                            await client.agents.sendSignal(agentId, 'UserInput', {
                                message: `[Files Ready] All ${uploadedFiles.length} file(s) have been uploaded and are now available: ${uploadedFiles.join(', ')}. You can now process them.`,
                                metadata: {
                                    type: 'files_ready',
                                    files: uploadedFiles,
                                },
                            } as UserInputSignal);
                        } catch (signalErr) {
                            console.error('Failed to send files ready signal:', signalErr);
                        }
                    }

                    setStagedFiles([]);
                }

                // Clear attachments after successful start
                onAttachmentsSent?.();
                setStartedAgentRunId(agentId);
                setInputValue('');
                toast({
                    title: t('agent.agentStarted'),
                    status: 'success',
                    duration: 3000,
                });
            }
        } catch (err: unknown) {
            setPendingStartMessage(null);
            setPendingStartTimestamp(null);
            toast({
                title: t('agent.errorStarting'),
                status: 'error',
                duration: 3000,
                description: err instanceof Error ? err.message : t('agent.unknownError'),
            });
        } finally {
            setIsSending(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key !== 'Enter') return;
        const hasModifier = e.metaKey || e.ctrlKey || e.altKey || e.shiftKey;
        if (!hasModifier) {
            // Plain Enter sends.
            e.preventDefault();
            void startWorkflowWithMessage();
            return;
        }
        // Shift+Enter inserts \n natively; Cmd/Ctrl/Alt+Enter do not in most browsers.
        if (!e.shiftKey) {
            e.preventDefault();
            insertNewlineAtCursor(e.currentTarget, setInputValue);
        }
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
        void inputValue;
        adjustTextareaHeight();
    }, [inputValue, adjustTextareaHeight]);

    // If a run has been started, show the conversation
    if (startedAgentRunId) {
        return (
            <ModernAgentConversationInner
                {...{
                    onClose,
                    isModal,
                    initialMessage,
                    placeholder,
                    fullWidth,
                    hideHeader,
                    headerVariant,
                    hideFileUpload,
                    hideObjectLinking,
                    inputContainerClassName,
                    inputClassName,
                    className,
                    allowWorkflowControl,
                }}
                agentRunId={startedAgentRunId}
                title={title}
                pendingStartMessage={pendingStartMessage ?? undefined}
                pendingStartTimestamp={pendingStartTimestamp ?? undefined}
                initialToolApprovalMode={toolApprovalMode}
            />
        );
    }

    return (
        <div className={cn('flex h-full flex-col items-center bg-background', className)}>
            {/* biome-ignore lint/a11y/noStaticElementInteractions: drag/drop target only; file selection is also exposed via the upload button. */}
            <div
                className={cn(
                    'relative flex h-full w-full flex-col overflow-hidden border-0',
                    fullWidth ? '' : 'max-w-4xl',
                )}
                onDragEnter={canStageFiles ? handleDragEnter : undefined}
                onDragOver={canStageFiles ? handleDragOver : undefined}
                onDragLeave={canStageFiles ? handleDragLeave : undefined}
                onDrop={canStageFiles ? handleDrop : undefined}
            >
                {/* Drag overlay for full-panel file drop */}
                {canStageFiles && isDragOver && (
                    <div className="absolute inset-0 flex items-center justify-center bg-info-background z-50 pointer-events-none rounded-lg">
                        <div className="text-info font-medium flex items-center gap-2 text-lg">
                            <UploadIcon className="size-6" />
                            Drop files to stage for upload
                        </div>
                    </div>
                )}

                {/* Hidden file input */}
                {canStageFiles && (
                    <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        accept={acceptedFileTypes}
                        onChange={handleFileInputChange}
                        className="hidden"
                    />
                )}

                {/* Header */}
                {!hideHeader && (
                    <div className="flex items-center justify-between border-b border-border/60 bg-background px-3 py-2">
                        <div className="flex items-center gap-2">
                            <div className="p-1">
                                <Cpu className="size-3.5 text-muted" />
                            </div>
                            <span className="text-sm font-medium text-foreground">{resolvedTitle}</span>
                        </div>

                        {/* Close button if needed */}
                        {onClose && !isModal && (
                            <Button
                                size="xs"
                                variant="ghost"
                                onClick={onClose}
                                aria-label={t('agent.close')}
                                title={t('agent.close')}
                                className="text-muted hover:text-foreground"
                            >
                                <XIcon className="size-4" />
                            </Button>
                        )}
                    </div>
                )}

                {/* Empty conversation area with instructions */}
                <div className="flex flex-1 flex-col items-center justify-end overflow-y-auto bg-background px-4">
                    {pendingStartMessage && pendingStartTimestamp ? (
                        <PendingStartConversation message={pendingStartMessage} startedAt={pendingStartTimestamp} />
                    ) : (
                        <div className="mx-auto flex min-h-full w-full max-w-3xl flex-col justify-end py-8">
                            {initialMessage && (
                                <div className="text-[15px] leading-relaxed text-foreground/80">{initialMessage}</div>
                            )}
                        </div>
                    )}
                </div>

                {/* Input Area */}
                <div className="shrink-0 bg-background px-4 pb-safe-area-4 pt-2">
                    <div
                        className={cn(
                            'mx-auto flex max-w-3xl flex-col gap-3 rounded-2xl border border-border/70 bg-mixer-muted/15 p-3 shadow-lg shadow-black/5',
                            inputContainerClassName,
                        )}
                    >
                        {/* Staged files display */}
                        {canStageFiles && stagedFiles.length > 0 && (
                            <div className="flex flex-wrap gap-2">
                                {stagedFiles.map((file, index) => (
                                    <div
                                        key={`${file.name}-${file.size}-${file.lastModified}`}
                                        className="flex items-center gap-1.5 rounded-md bg-attention/10 px-2 py-1 text-sm text-attention"
                                        title={t('agent.fileStagedTooltip')}
                                    >
                                        <FileTextIcon className="size-3.5" />
                                        <span className="max-w-[120px] truncate">{file.name}</span>
                                        <span className="text-xs opacity-70">{t('agent.staged')}</span>
                                        <Button
                                            variant="unstyled"
                                            aria-label={`Remove staged file ${file.name}`}
                                            onClick={() => removeStagedFile(index)}
                                            className="ms-1 rounded p-0.5 hover:bg-attention/20"
                                        >
                                            <XIcon className="size-3" />
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        )}

                        <Textarea
                            ref={inputRef}
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            onKeyDown={handleKeyDown}
                            onPaste={handlePaste}
                            placeholder={resolvedPlaceholder}
                            disabled={isSending}
                            rows={2}
                            className={cn(
                                'min-h-[72px] resize-none overflow-hidden border-0 bg-transparent px-0 py-0 text-sm leading-6 shadow-none focus-visible:ring-0',
                                inputClassName,
                            )}
                            style={{ minHeight: '72px', maxHeight: '200px' }}
                        />

                        <div className="flex items-center justify-between gap-3">
                            <div className="flex min-w-0 items-center gap-2">
                                {canStageFiles && (
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => fileInputRef.current?.click()}
                                        disabled={isSending || stagedFiles.length >= maxFiles}
                                        aria-label={t('agent.upload')}
                                        className="rounded-full text-muted"
                                        title={t('agent.upload')}
                                    >
                                        <UploadIcon className="size-4" />
                                    </Button>
                                )}
                                {interactive && (
                                    <AgentApprovalModeSelector
                                        mode={toolApprovalMode}
                                        onChange={setToolApprovalMode}
                                        disabled={isSending}
                                    />
                                )}
                            </div>
                            <Button
                                onClick={startWorkflowWithMessage}
                                disabled={!inputValue.trim() || isSending}
                                variant="ghost"
                                size="icon"
                                className={cn(
                                    'size-9 rounded-full border border-border/60 bg-foreground text-background shadow-sm',
                                    'hover:bg-foreground/90 hover:text-background',
                                    'disabled:bg-mixer-muted/25 disabled:text-muted disabled:opacity-100',
                                )}
                                title={resolvedStartButtonText}
                                aria-label={resolvedStartButtonText}
                            >
                                {isSending ? <Spinner size="sm" /> : <ArrowUpIcon className="size-4" />}
                            </Button>
                        </div>
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
    onClone,
    onShowDetails,
    allowWorkflowControl = true,
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
    headerVariant = 'full',
    hideMessageInput,
    failedAction,
    hidePlanPanel,
    hideWorkstreamTabs,
    showRightPanel: showRightPanelProp = true,
    hideFileUpload,
    showArtifacts = false,
    hideDocumentPanel: _hideDocumentPanel,
    hiddenMessageTypes,
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
    initialRequestData,
    initialRequestSchema,
    initialRequestTitle,
    initialRequestTemplate,
    payloadContent,
    conversationContent,
    conversationTab = false,
    pendingStartMessage,
    pendingStartTimestamp,
    initialToolApprovalMode,
    enablePlayback,
    showPlaybackToggle = true,
}: ModernAgentConversationProps & { agentRunId: string }) {
    const { t } = useUITranslation();
    const { client } = useUserSession();
    const toast = useToast();

    // ────────────────────────────────────────────
    // Extracted hooks
    // ────────────────────────────────────────────
    const {
        messages,
        streamingMessages,
        isCompleted,
        initialHistoryStatus,
        debugChunkFlash,
        addOptimisticMessage,
        updateOptimisticMessageStatus,
        reconnect: reconnectStream,
        agentRunStatus,
        workflowRunId,
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
        updateDocumentTitle,
    } = useDocumentPanel(messages);

    const { processingFiles, hasProcessingFiles, handleFileUpload, removeProcessingFile } = useFileProcessing(
        client,
        agentRunId,
        serverFileUpdates,
        toast,
    );
    const canUploadFiles = interactive && !hideFileUpload;

    const handleRemoveProcessingFile = useCallback(
        (fileId: string) => {
            void removeProcessingFile(fileId);
        },
        [removeProcessingFile],
    );

    // ────────────────────────────────────────────
    // Local state (UI-only concerns)
    // ────────────────────────────────────────────
    const bottomRef = useRef<HTMLDivElement | null>(null);
    const conversationRef = useRef<HTMLDivElement | null>(null);
    const conversationLayoutRef = useRef<HTMLDivElement | null>(null);
    const [isSending, setIsSending] = useState(false);
    const [isCompactingContext, setIsCompactingContext] = useState(false);
    const [internalViewMode, setInternalViewMode] = useState<AgentConversationViewMode>('sliding');
    const viewMode = controlledViewMode ?? internalViewMode;
    const handleViewModeChange = useCallback(
        (mode: AgentConversationViewMode) => {
            if (onViewModeChangeProp) {
                onViewModeChangeProp(mode);
            } else {
                setInternalViewMode(mode);
            }
        },
        [onViewModeChangeProp],
    );
    const [isStopping, setIsStopping] = useState(false);
    const [isDragOver, setIsDragOver] = useState(false);
    const [activeWorkstream, setActiveWorkstream] = useState('all');
    const [playbackCursor, setPlaybackCursor] = useState<AgentChatPlaybackCursor>('live');
    const [isPlaybackToggleEnabled, setIsPlaybackToggleEnabled] = useState(false);
    const [playbackScrollRequestId, setPlaybackScrollRequestId] = useState(0);
    const [queriedActiveWorkstreams, setQueriedActiveWorkstreams] = useState<ActiveWorkstreamEntry[]>([]);
    const [queriedCompletedWorkstreams, setQueriedCompletedWorkstreams] = useState<CompletedWorkstreamEntry[]>([]);
    const [isWorkstreamQueryUnavailable, setIsWorkstreamQueryUnavailable] = useState(false);
    const initialResolvedToolApprovalMode = useMemo<AgentToolApprovalMode | undefined>(
        () =>
            initialToolApprovalMode === undefined && interactive
                ? undefined
                : normalizeAgentToolApprovalMode(initialToolApprovalMode, interactive),
        [initialToolApprovalMode, interactive],
    );
    const [toolApprovalMode, setToolApprovalMode] = useState<AgentToolApprovalMode | undefined>(
        initialResolvedToolApprovalMode,
    );
    const workstreamFetchFailedRef = useRef(false);
    const dragCounterRef = useRef(0);
    const pendingPlaybackScrollRef = useRef(false);

    useEffect(() => {
        setToolApprovalMode(initialResolvedToolApprovalMode);
    }, [initialResolvedToolApprovalMode]);

    // PERFORMANCE: Refs for values used inside useCallback to avoid re-creating the callback
    const isSendingRef = useRef(isSending);
    isSendingRef.current = isSending;
    const hasProcessingFilesRef = useRef(hasProcessingFiles);
    hasProcessingFilesRef.current = hasProcessingFiles;

    const lastMainMessage = useMemo(() => {
        const mainMessages = messages.filter((m) => (m.workstream_id || 'main') === 'main');
        return mainMessages[mainMessages.length - 1];
    }, [messages]);

    // Derive effective status from AgentRun state; main workstream terminal events cover live-stream races.
    const effectiveWorkflowStatus = useMemo(() => {
        if (lastMainMessage?.type === AgentMessageType.TERMINATED) return 'TERMINATED';
        if (lastMainMessage?.type === AgentMessageType.COMPLETE && (!agentRunStatus || agentRunStatus === 'RUNNING')) {
            return 'COMPLETED';
        }
        return agentRunStatus;
    }, [lastMainMessage, agentRunStatus]);

    const isWorkflowTerminal = useMemo(() => {
        const normalizedStatus = effectiveWorkflowStatus?.toUpperCase();
        return (
            normalizedStatus === 'COMPLETED' ||
            normalizedStatus === 'FAILED' ||
            normalizedStatus === 'CANCELED' ||
            normalizedStatus === 'CANCELLED' ||
            normalizedStatus === 'TERMINATED' ||
            normalizedStatus === 'TIMED_OUT'
        );
    }, [effectiveWorkflowStatus]);

    // When a terminal conversation can be restarted (host provided a restart handler),
    // we keep the composer visible and seamlessly resume the agent on the next message
    // instead of forcing the user to click "Continue Conversation".
    // FAILED runs are excluded: a failed run is a dead end, so we surface the failed box /
    // `failedAction` (e.g. an explicit Restart button) instead of silently resuming.
    const canContinueConversation = useMemo(
        () => isWorkflowTerminal && effectiveWorkflowStatus?.toUpperCase() !== 'FAILED' && !!onRestart,
        [isWorkflowTerminal, effectiveWorkflowStatus, onRestart],
    );
    const shouldRenderMessageInputArea = !hideMessageInput || canContinueConversation;

    // A failed run is a dead end: the input box must never show, in any state. We key off
    // both effectiveWorkflowStatus and the authoritative API status (agentRunStatus) so the
    // loading race (status fetch vs. message stream, where `showInput` defaults to `true`)
    // can't transiently re-show the composer once we know the run failed.
    const isFailed = useMemo(
        () => effectiveWorkflowStatus?.toUpperCase() === 'FAILED' || agentRunStatus?.toUpperCase() === 'FAILED',
        [effectiveWorkflowStatus, agentRunStatus],
    );

    // Read inside handleSendMessage (a stable callback) without widening its deps.
    const isWorkflowTerminalRef = useRef(isWorkflowTerminal);
    isWorkflowTerminalRef.current = isWorkflowTerminal;
    const canContinueConversationRef = useRef(canContinueConversation);
    canContinueConversationRef.current = canContinueConversation;

    // ────────────────────────────────────────────
    // Computed values
    // ────────────────────────────────────────────
    const getActivePlan = useMemo(() => {
        const currentPlanData = plans[activePlanIndex] || {
            plan: { plan: [] },
            timestamp: 0,
        };
        const currentWorkstreamStatus = workstreamStatusMap.get(currentPlanData.timestamp) || new Map();
        return {
            plan: currentPlanData.plan,
            workstreamStatus: currentWorkstreamStatus,
        };
    }, [plans, activePlanIndex, workstreamStatusMap]);

    const messageDerivedWorkstreams = useMemo(() => deriveWorkstreamsFromMessages(messages), [messages]);

    const panelWorkstreams = useMemo<WorkstreamInfo[]>(() => {
        const merged = [...messageDerivedWorkstreams];
        for (const ws of queriedCompletedWorkstreams) {
            mergeWorkstreamInfo(merged, completedWorkstreamEntryToInfo(ws));
        }
        for (const ws of queriedActiveWorkstreams) {
            mergeWorkstreamInfo(merged, activeWorkstreamEntryToInfo(ws));
        }
        return merged
            .map((workstream, index) => ({ workstream, index }))
            .sort((a, b) => {
                const activeDelta =
                    Number(!isActiveWorkstreamStatus(a.workstream.status)) -
                    Number(!isActiveWorkstreamStatus(b.workstream.status));
                return activeDelta || a.index - b.index;
            })
            .map(({ workstream }) => workstream);
    }, [messageDerivedWorkstreams, queriedActiveWorkstreams, queriedCompletedWorkstreams]);

    const composerActiveWorkstreams = useMemo(
        () => panelWorkstreams.filter((ws) => isActiveWorkstreamStatus(ws.status)),
        [panelWorkstreams],
    );

    const activeTaskCount = useMemo(
        () => composerActiveWorkstreams.filter((ws) => ws.status === 'running').length,
        [composerActiveWorkstreams],
    );

    const activeWorkstreamDisplayName = useMemo(() => {
        if (activeWorkstream === 'all') return undefined;
        const workstream = panelWorkstreams.find(
            (ws) => ws.workstream_id === activeWorkstream || ws.launch_id === activeWorkstream,
        );
        if (!workstream) return getWorkstreamDisplayName(activeWorkstream);
        return getWorkstreamDisplayName(workstream.workstream_id, workstream.interaction);
    }, [activeWorkstream, panelWorkstreams]);

    const composerPlaceholder = useMemo(() => {
        if (placeholder) return placeholder;
        if (activeWorkstreamDisplayName) {
            return t('agent.messageMainAgentWhileViewingWorkstream', { workstream: activeWorkstreamDisplayName });
        }
        return undefined;
    }, [activeWorkstreamDisplayName, placeholder, t]);

    const canShowPlaybackToggle = showPlaybackToggle && enablePlayback === undefined && isAgentChatPlaybackAvailable();
    const isPlaybackEnabled = enablePlayback ?? (isAgentChatPlaybackEnabled() || isPlaybackToggleEnabled);
    const playbackSourceMessages = useMemo(() => {
        const visibleMessages = hiddenMessageTypes?.length
            ? messages.filter((message) => !hiddenMessageTypes.includes(message.type))
            : messages;
        return filterMessagesForActiveWorkstream(visibleMessages, activeWorkstream);
    }, [activeWorkstream, hiddenMessageTypes, messages]);
    const playbackState = useMemo(
        () => createPlaybackState(playbackSourceMessages, playbackCursor, isPlaybackEnabled),
        [isPlaybackEnabled, playbackCursor, playbackSourceMessages],
    );
    const clampedPlaybackCursor = playbackState.cursor;
    const isPlaybackLive = playbackState.isLive;
    const isPlaybackAtLatest =
        isPlaybackEnabled && !isPlaybackLive && playbackState.cursorIndex === playbackSourceMessages.length - 1;
    const displayedMessages = playbackState.displayedMessages;
    const displayedStreamingMessages = isPlaybackLive ? streamingMessages : EMPTY_STREAMING_MESSAGES;
    const playbackDerivedWorkstreams = useMemo(
        () => deriveWorkstreamsFromMessages(displayedMessages),
        [displayedMessages],
    );
    const playbackActiveWorkstreams = useMemo(
        () => playbackDerivedWorkstreams.filter((ws) => isActiveWorkstreamStatus(ws.status)),
        [playbackDerivedWorkstreams],
    );
    const effectiveIsCompleted = useMemo(() => isCompleted || !isInProgress(messages), [isCompleted, messages]);
    const displayedIsCompleted = isPlaybackLive || isPlaybackAtLatest ? effectiveIsCompleted : false;
    const pendingRequestInputMessage = useMemo(
        () => getPendingRequestInputMessage(displayedMessages),
        [displayedMessages],
    );
    const shouldShowRequestInputOverlay = Boolean(pendingRequestInputMessage) && !isFailed;
    const isViewingPlaybackHistory = isPlaybackEnabled && !isPlaybackLive;
    const shouldRenderLiveMessageInputArea = shouldRenderMessageInputArea && !isViewingPlaybackHistory;
    const contextWindowUsage = useMemo(() => toContextWindowUsage(messages), [messages]);
    // The run is still "alive" while it waits for user input (idle on ask_user), so keep the
    // context-usage indicator visible then — it's only truly hidden once the run terminates.
    const canCompactContext =
        allowWorkflowControl &&
        (!effectiveIsCompleted || shouldShowRequestInputOverlay) &&
        isPlaybackLive &&
        Boolean(contextWindowUsage);

    useEffect(() => {
        debugAgentChat('conversation render state', {
            agentRunId,
            messageCount: messages.length,
            playbackMessageCount: playbackSourceMessages.length,
            displayedMessageCount: displayedMessages.length,
            streamingCount: streamingMessages.size,
            displayedStreamingCount: displayedStreamingMessages.size,
            initialHistoryStatus,
            isCompleted,
            effectiveIsCompleted,
            displayedIsCompleted,
            agentRunStatus,
            effectiveWorkflowStatus,
            isWorkflowTerminal,
            playbackCursor: clampedPlaybackCursor,
            isPlaybackEnabled,
            isPlaybackLive,
            isPlaybackAtLatest,
            activeWorkstream,
            showInitialRequest: initialHistoryStatus === 'empty' && messages.length === 0,
            pendingStartVisible: messages.length === 0 && !effectiveIsCompleted && Boolean(pendingStartMessage),
        });
    }, [
        activeWorkstream,
        agentRunId,
        agentRunStatus,
        clampedPlaybackCursor,
        displayedIsCompleted,
        displayedMessages.length,
        displayedStreamingMessages.size,
        effectiveIsCompleted,
        effectiveWorkflowStatus,
        initialHistoryStatus,
        isCompleted,
        isPlaybackAtLatest,
        isPlaybackEnabled,
        isPlaybackLive,
        isWorkflowTerminal,
        messages.length,
        pendingStartMessage,
        playbackSourceMessages.length,
        streamingMessages.size,
    ]);

    const handleTogglePlayback = useCallback(() => {
        setIsPlaybackToggleEnabled((prev) => !prev);
    }, []);

    const handleChangePlaybackCursor = useCallback(
        (nextCursor: AgentChatPlaybackCursor) => {
            const currentIndex = getPlaybackCursorIndex(clampedPlaybackCursor, playbackSourceMessages.length);
            const nextIndex = getPlaybackCursorIndex(nextCursor, playbackSourceMessages.length);
            const returningToLive = nextCursor === 'live' && clampedPlaybackCursor !== 'live';
            if (isPlaybackEnabled && (nextIndex > currentIndex || returningToLive)) {
                pendingPlaybackScrollRef.current = true;
                setPlaybackScrollRequestId((requestId) => requestId + 1);
            }
            setPlaybackCursor(nextCursor);
        },
        [clampedPlaybackCursor, isPlaybackEnabled, playbackSourceMessages.length],
    );

    useEffect(() => {
        if (!isPlaybackEnabled) {
            if (playbackCursor !== 'live') setPlaybackCursor('live');
            return;
        }
        if (clampedPlaybackCursor !== playbackCursor) {
            setPlaybackCursor(clampedPlaybackCursor);
        }
    }, [clampedPlaybackCursor, isPlaybackEnabled, playbackCursor]);

    useEffect(() => {
        void playbackScrollRequestId;
        if (!isPlaybackEnabled || !pendingPlaybackScrollRef.current) return;
        pendingPlaybackScrollRef.current = false;
        const animationFrame = window.requestAnimationFrame(() => {
            bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
        });
        return () => window.cancelAnimationFrame(animationFrame);
    }, [isPlaybackEnabled, playbackScrollRequestId]);

    // ────────────────────────────────────────────
    // Stable callbacks
    // ────────────────────────────────────────────
    const handleTogglePlanPanel = useCallback(() => {
        setShowSlidingPanel((prev: boolean) => {
            if (!prev) {
                sessionStorage.setItem('plan-panel-shown', 'true');
            }
            return !prev;
        });
    }, [setShowSlidingPanel]);

    const handleChangePlan = useCallback(
        (index: number) => {
            setActivePlanIndex(index);
        },
        [setActivePlanIndex],
    );

    // ────────────────────────────────────────────
    // Unified right panel state
    // ────────────────────────────────────────────
    type RightPanelTab = 'plan' | 'workstreams' | 'documents' | 'uploads' | 'artifacts' | 'payload' | 'conversation';
    const [rightPanelTab, setRightPanelTab] = useState<RightPanelTab>(
        conversationContent || conversationTab ? 'conversation' : 'plan',
    );
    const [rightPanelWidth, setRightPanelWidth] = useState(400);
    const [isRightPanelResizing, setIsRightPanelResizing] = useState(false);

    const isRightPanelVisible =
        showRightPanelProp &&
        (showSlidingPanel ||
            isDocPanelOpen ||
            (!hideWorkstreamTabs && panelWorkstreams.length > 0) ||
            !!conversationContent ||
            conversationTab);

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
                    setRightPanelTab('documents');
                }}
            >
                {children}
            </a>
        ),
        [openDocInPanel],
    );

    const effectiveStoreLinkComponent = StoreLinkComponent ?? internalStoreLinkComponent;

    // ────────────────────────────────────────────
    // Effects
    // ────────────────────────────────────────────

    // Expose handleFileUpload to external callers via ref
    useEffect(() => {
        if (fileUploadRef) fileUploadRef.current = canUploadFiles ? handleFileUpload : null;
        return () => {
            if (fileUploadRef) fileUploadRef.current = null;
        };
    }, [fileUploadRef, handleFileUpload, canUploadFiles]);

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

    useEffect(() => {
        void agentRunId;
        workstreamFetchFailedRef.current = false;
        setIsWorkstreamQueryUnavailable(false);
        setQueriedActiveWorkstreams([]);
        setQueriedCompletedWorkstreams([]);
    }, [agentRunId]);

    // Poll the backend query only as live enrichment. Persisted messages remain the
    // source of truth for the right-panel history once a workflow can no longer be queried.
    useEffect(() => {
        const shouldPoll =
            initialHistoryStatus !== 'loading' &&
            !effectiveIsCompleted &&
            !isWorkflowTerminal &&
            !isWorkstreamQueryUnavailable;
        debugAgentChat('active workstreams poll state', {
            agentRunId,
            shouldPoll,
            initialHistoryStatus,
            effectiveIsCompleted,
            isWorkflowTerminal,
            isWorkstreamQueryUnavailable,
        });
        if (!shouldPoll) {
            setQueriedActiveWorkstreams((prev) => (prev.length === 0 ? prev : []));
            return;
        }

        let isCancelled = false;
        let isFetchInFlight = false;

        const fetchActiveWorkstreams = async () => {
            if (isFetchInFlight) {
                debugAgentChat('active workstreams fetch skipped while previous request is pending', { agentRunId });
                return;
            }

            isFetchInFlight = true;
            try {
                debugAgentChat('active workstreams fetch start', { agentRunId });
                const result = await client.agents.getActiveWorkstreams(agentRunId);
                if (isCancelled) return;
                debugAgentChat('active workstreams fetch success', {
                    agentRunId,
                    runningCount: result.running?.length ?? 0,
                    completedCount: result.completed?.length ?? 0,
                    unavailable: result.unavailable === true,
                });
                setQueriedActiveWorkstreams(result.running ?? []);
                setQueriedCompletedWorkstreams(result.completed ?? []);
                if (result.unavailable) {
                    setIsWorkstreamQueryUnavailable(true);
                    return;
                }
                workstreamFetchFailedRef.current = false;
            } catch (error) {
                if (isCancelled) return;
                setQueriedActiveWorkstreams((prev) => (prev.length === 0 ? prev : []));
                setIsWorkstreamQueryUnavailable(true);
                debugAgentChat('active workstreams fetch failed', {
                    agentRunId,
                    error: error instanceof Error ? error.message : String(error),
                });
                if (!workstreamFetchFailedRef.current) {
                    console.warn('Failed to fetch active workstreams:', error);
                    workstreamFetchFailedRef.current = true;
                }
            } finally {
                isFetchInFlight = false;
            }
        };

        void fetchActiveWorkstreams();
        const pollHandle = window.setInterval(fetchActiveWorkstreams, 10000);

        return () => {
            isCancelled = true;
            window.clearInterval(pollHandle);
        };
    }, [
        client.agents,
        agentRunId,
        effectiveIsCompleted,
        initialHistoryStatus,
        isWorkflowTerminal,
        isWorkstreamQueryUnavailable,
    ]);

    // Notify parent when input availability is determined
    useEffect(() => {
        if (messages.length === 0) return;
        if (canContinueConversation) {
            onShowInputChange?.(true);
            return;
        }
        if (!showInput) {
            onShowInputChange?.(false);
            return;
        }
        if (effectiveWorkflowStatus && effectiveWorkflowStatus !== 'RUNNING') {
            onShowInputChange?.(false);
            return;
        }
        if (effectiveWorkflowStatus !== null) {
            onShowInputChange?.(true);
        }
    }, [showInput, effectiveWorkflowStatus, messages.length, onShowInputChange, canContinueConversation]);

    // ────────────────────────────────────────────
    // Handlers
    // ────────────────────────────────────────────

    // Send a message to the agent
    const handleSendMessage = useCallback(
        (message: string) => {
            const trimmed = message.trim();
            if (!trimmed || isSendingRef.current) return;

            // A terminal run only accepts input when it can be continued (restarted).
            // handleSendMessage is also reachable from inline message actions (AllMessagesMixed),
            // so guard here too — read-only terminal views that hide the composer must not restart.
            if (isWorkflowTerminalRef.current && !canContinueConversationRef.current) return;

            // Block if files are still processing
            if (hasProcessingFilesRef.current) {
                toast({
                    status: 'warning',
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
                workstream_id: 'main',
                details: { _optimistic: true, _messageId: messageId, _deliveryStatus: 'sending' },
            };

            addOptimisticMessage(optimisticMessage);

            const metadata = {
                ...(attachedDocs.length > 0 ? { attached_docs: attachedDocs.map((d) => d.id) } : {}),
                ...contextMetadata,
                id: messageId,
                _messageId: messageId,
            };

            const sendUserInput = () =>
                client.agents.sendSignal(agentRunId, 'UserInput', {
                    message: messageContent,
                    client_message_id: messageId,
                    metadata,
                } as UserInputSignal);

            const markReceived = () => {
                updateOptimisticMessageStatus(messageId, 'received');
                onAttachmentsSent?.();
            };

            // When the workflow has already completed, restart it first so it resumes
            // from the existing conversation history, then deliver the message. Temporal
            // buffers the signal until the new run is ready to receive it. We reconnect
            // the stream in place (rather than remounting via onRestart) so the existing
            // timeline is preserved and the new exchange appends seamlessly at the bottom.
            const deliver = isWorkflowTerminalRef.current
                ? client.agents.restart(agentRunId).then(() => {
                      reconnectStream();
                      return sendUserInput().then(markReceived);
                  })
                : sendUserInput().then(markReceived);

            deliver
                .catch((err) => {
                    updateOptimisticMessageStatus(messageId, 'failed');
                    toast({
                        status: 'error',
                        title: t('agent.failedToSend'),
                        description: err instanceof Error ? err.message : t('agent.unknownError'),
                        duration: 3000,
                    });
                })
                .finally(() => {
                    setIsSending(false);
                });
        },
        [
            agentRunId,
            client,
            toast,
            getAttachedDocs,
            getMessageContext,
            onAttachmentsSent,
            reconnectStream,
            addOptimisticMessage,
            updateOptimisticMessageStatus,
            t,
        ],
    );

    // After the user connects an MCP server requested via request_mcp_connection, flag the
    // conversation for tool re-discovery and resume it with a confirmation message so the agent
    // continues automatically with the newly-available tools.
    const handleMcpConnected = useCallback(
        async (cfg: McpConnectUxConfig) => {
            // Await the dirty-flag signal BEFORE sending the follow-up message so Temporal records
            // McpConfigChanged ahead of the UserInput. Otherwise the resume turn could run before
            // the flag is set and use the stale tool catalog. An omitted disabled list preserves
            // the user's current deactivation set.
            try {
                await client.agents.sendSignal(agentRunId, 'McpConfigChanged', {});
            } catch (err: unknown) {
                console.error('Failed to signal MCP config change', err);
            }
            handleSendMessage(t('agent.mcpConnectedMessage', { name: cfg.name }));
        },
        [client, agentRunId, handleSendMessage, t],
    );

    // Per-conversation MCP deactivation set, seeded from the run and updated live via the
    // MCP action menu in the composer toolbar. Changes are pushed to the running workflow
    // (which re-discovers tools at the next turn).
    const [mcpDisabled, setMcpDisabled] = useState<string[] | undefined>(undefined);
    useEffect(() => {
        let cancelled = false;
        client.agents
            .retrieve(agentRunId)
            .then((run) => {
                if (!cancelled) {
                    setMcpDisabled(run.disabled_mcp_collections);
                    if (run.tool_approval_mode !== undefined || run.interactive !== undefined) {
                        setToolApprovalMode(normalizeAgentToolApprovalMode(run.tool_approval_mode, run.interactive));
                    }
                }
            })
            .catch(() => {
                /* best-effort: toggles default to all-active */
            });
        return () => {
            cancelled = true;
        };
    }, [client, agentRunId]);

    const handleMcpDisabledChange = useCallback(
        (disabled: string[]) => {
            const next = disabled.length > 0 ? disabled : undefined;
            setMcpDisabled(next);
            client.agents
                .sendSignal(agentRunId, 'McpConfigChanged', { disabled_mcp_collections: disabled })
                .catch((err: unknown) => console.error('Failed to signal MCP config change', err));
        },
        [client, agentRunId],
    );

    const handleMcpConnectionChange = useCallback(() => {
        // A connect/disconnect doesn't change the activation set — omit disabled_mcp_collections so
        // the workflow preserves the current denylist (rather than overwriting it with possibly
        // stale UI state) and just re-discovers tools.
        client.agents
            .sendSignal(agentRunId, 'McpConfigChanged', {})
            .catch((err: unknown) => console.error('Failed to signal MCP config change', err));
    }, [client, agentRunId]);

    const handleToolApprovalModeChange = useCallback(
        (mode: AgentToolApprovalMode) => {
            const nextMode = normalizeAgentToolApprovalMode(mode, interactive);
            setToolApprovalMode(nextMode);
            client.agents
                .sendSignal(agentRunId, 'ToolApprovalModeChanged', { mode: nextMode })
                .catch((err: unknown) => {
                    toast({
                        status: 'error',
                        title: t('agent.approvalMode.changeFailed'),
                        description: err instanceof Error ? err.message : t('agent.unknownError'),
                        duration: 3000,
                    });
                });
        },
        [agentRunId, client, interactive, t, toast],
    );

    // Drag and drop handlers for full-panel file upload
    const handleDragEnter = useCallback(
        (e: React.DragEvent) => {
            if (!canUploadFiles) return;
            e.preventDefault();
            e.stopPropagation();
            dragCounterRef.current++;
            if (e.dataTransfer?.types?.includes('Files')) {
                setIsDragOver(true);
            }
        },
        [canUploadFiles],
    );

    const handleDragOver = useCallback(
        (e: React.DragEvent) => {
            if (!canUploadFiles) return;
            e.preventDefault();
            e.stopPropagation();
        },
        [canUploadFiles],
    );

    const handleDragLeave = useCallback(
        (e: React.DragEvent) => {
            if (!canUploadFiles) return;
            e.preventDefault();
            e.stopPropagation();
            dragCounterRef.current--;
            if (dragCounterRef.current === 0) {
                setIsDragOver(false);
            }
        },
        [canUploadFiles],
    );

    const handleDrop = useCallback(
        (e: React.DragEvent) => {
            if (!canUploadFiles) return;
            e.preventDefault();
            e.stopPropagation();
            dragCounterRef.current = 0;
            setIsDragOver(false);

            if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
                const filesArray = Array.from(e.dataTransfer.files);
                void handleFileUpload(filesArray);
            }
        },
        [handleFileUpload, canUploadFiles],
    );

    // Stop/interrupt the active workflow
    const handleStopWorkflow = useCallback(async () => {
        if (isStopping) return;

        const messageId = `stop-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const optimisticMessage: AgentMessage = {
            timestamp: Date.now(),
            workflow_run_id: agentRunId,
            type: AgentMessageType.IDLE,
            message: 'Stopped. Waiting for your command...',
            workstream_id: 'main',
            details: {
                _optimistic: true,
                _messageId: messageId,
                _deliveryStatus: 'sending',
                display_role: 'user_stopped',
                status_reason: 'user_stopped',
            },
        };

        addOptimisticMessage(optimisticMessage);
        setIsStopping(true);
        try {
            await client.agents.sendSignal(agentRunId, 'Stop', {
                message: 'User requested stop',
                client_message_id: messageId,
                metadata: {
                    id: messageId,
                    _messageId: messageId,
                },
            } as StopSignal);

            updateOptimisticMessageStatus(messageId, 'received');
        } catch (err) {
            toast({
                status: 'error',
                title: t('agent.failedToInterrupt'),
                description: err instanceof Error ? err.message : t('agent.unknownError'),
                duration: 3000,
            });
            updateOptimisticMessageStatus(messageId, 'failed');
        } finally {
            setIsStopping(false);
        }
    }, [isStopping, agentRunId, addOptimisticMessage, client.agents, toast, t, updateOptimisticMessageStatus]);

    const handleCompactContext = useCallback(async () => {
        if (isCompactingContext || effectiveIsCompleted || !isPlaybackLive) return;

        setIsCompactingContext(true);
        try {
            await client.agents.sendSignal(agentRunId, 'TriggerCheckpoint', {
                reason: 'manual user request',
            });
        } catch (err) {
            toast({
                status: 'error',
                title: t('agent.failedToCompactContext'),
                description: err instanceof Error ? err.message : t('agent.unknownError'),
                duration: 3000,
            });
        } finally {
            setIsCompactingContext(false);
        }
    }, [agentRunId, client.agents, effectiveIsCompleted, isCompactingContext, isPlaybackLive, t, toast]);

    // Expose stop handler to external callers via ref
    useEffect(() => {
        if (stopRef) stopRef.current = allowWorkflowControl && !effectiveIsCompleted ? handleStopWorkflow : null;
        return () => {
            if (stopRef) stopRef.current = null;
        };
    }, [stopRef, effectiveIsCompleted, handleStopWorkflow, allowWorkflowControl]);

    // Notify parent when stopping state changes
    useEffect(() => {
        onStoppingChange?.(isStopping);
    }, [isStopping, onStoppingChange]);

    const actualTitle = title || t('agent.agentConversation');

    // Handle downloading conversation
    const downloadConversation = async () => {
        try {
            const url = await getConversationUrl(client, agentRunId);
            if (url) window.open(url, '_blank');
        } catch (err) {
            console.error('Failed to download conversation', err);
            toast({
                status: 'error',
                title: t('agent.failedToDownload'),
                duration: 3000,
            });
        }
    };

    const exportReplayFixture = useCallback(() => {
        const exportedAt = new Date().toISOString();
        const streamingFrame =
            streamingMessages.size > 0
                ? [
                      {
                          cursor: 'live',
                          streamingMessages: Array.from(streamingMessages, ([id, data]) => ({ id, ...data })),
                      },
                  ]
                : undefined;
        const fixture = {
            metadata: {
                title: actualTitle,
                agent_run_id: agentRunId,
                exported_at: exportedAt,
                message_count: messages.length,
            },
            messages,
            ...(streamingFrame ? { streamingFrames: streamingFrame } : {}),
        };
        const filename = `${sanitizeFilenamePart(actualTitle) || 'agent-chat'}-${sanitizeFilenamePart(agentRunId)}.json`;
        downloadJsonFile(filename, fixture);
        toast({
            status: 'success',
            title: t('agent.rewind.fixtureExported'),
            duration: 2000,
        });
    }, [actualTitle, agentRunId, messages, streamingMessages, t, toast]);

    const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);

    const exportConversationPdf = () => {
        if (!conversationRef.current) {
            toast({
                status: 'error',
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
                status: 'error',
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
                status: 'error',
                title: t('agent.pdfExportFailed'),
                description: t('agent.unableToOpenPrint'),
                duration: 4000,
            });
            return;
        }

        toast({
            status: 'success',
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
    const taskLabels = useMemo(
        () =>
            getActivePlan.plan.plan?.reduce((acc, task) => {
                if (task.id && task.goal) acc.set(task.id.toString(), task.goal);
                return acc;
            }, new Map<string, string>()),
        [getActivePlan.plan],
    );

    const renderConversationHeader = (variant: 'full' | 'compact') => (
        <Header
            title={actualTitle}
            variant={variant}
            isCompleted={effectiveIsCompleted}
            isTerminal={isWorkflowTerminal}
            onClose={onClose}
            isModal={isModal}
            agentRunId={agentRunId}
            workflowRunId={workflowRunId || ''}
            viewMode={viewMode}
            onViewModeChange={handleViewModeChange}
            showPlanPanel={showRightPanelProp && showSlidingPanel}
            hasPlan={showRightPanelProp && plans.length > 0}
            showPlanButton={showRightPanelProp && !conversationTab}
            onTogglePlanPanel={handleTogglePlanPanel}
            showPlaybackButton={canShowPlaybackToggle}
            isPlaybackEnabled={isPlaybackEnabled}
            onTogglePlayback={handleTogglePlayback}
            onDownload={downloadConversation}
            onExportFixture={exportReplayFixture}
            resetWorkflow={resetWorkflow}
            onClone={onClone}
            onShowDetails={onShowDetails}
            allowWorkflowControl={allowWorkflowControl}
            onExportPdf={exportConversationPdf}
            isReceivingChunks={debugChunkFlash}
        />
    );

    // Conversation area inner content — shared between main layout and conversationTab mode
    const conversationAreaJsx = (
        <div
            ref={conversationRef}
            data-agent-playback-enabled={isPlaybackEnabled || undefined}
            data-agent-playback-cursor={isPlaybackEnabled ? clampedPlaybackCursor : undefined}
            data-agent-live-message-count={messages.length}
            data-agent-rendered-message-count={displayedMessages.length}
            className={cn(
                'flex flex-col min-h-0 min-w-0 border-0',
                conversationTab
                    ? 'flex-1 h-full'
                    : isRightPanelVisible
                      ? 'w-full flex-1 min-h-[50vh]'
                      : fullWidth
                        ? 'flex-1 w-full'
                        : `flex-1 mx-auto ${!isModal ? 'max-w-4xl' : ''}`,
            )}
        >
            {!hideHeader && headerVariant === 'compact' && (
                <div className="flex flex-shrink-0 justify-end border-b border-border/60 px-2 py-1 lg:hidden">
                    {renderConversationHeader('compact')}
                </div>
            )}
            {!hideHeader && headerVariant !== 'compact' && (
                <div className="flex-shrink-0">{renderConversationHeader(headerVariant)}</div>
            )}

            {isPlaybackEnabled && (
                <div className="flex flex-shrink-0 justify-end px-2 py-1.5">
                    <AgentChatPlaybackControls
                        cursor={clampedPlaybackCursor}
                        messages={playbackSourceMessages}
                        onChangeCursor={handleChangePlaybackCursor}
                    />
                </div>
            )}

            {messages.length === 0 && !effectiveIsCompleted && pendingStartMessage && pendingStartTimestamp ? (
                <PendingStartConversation message={pendingStartMessage} startedAt={pendingStartTimestamp} />
            ) : (
                <AllMessagesMixed
                    messages={displayedMessages}
                    bottomRef={bottomRef as React.RefObject<HTMLDivElement>}
                    isCompleted={displayedIsCompleted}
                    plan={getActivePlan.plan}
                    workstreamStatus={getActivePlan.workstreamStatus}
                    showPlanPanel={showRightPanelProp && showSlidingPanel}
                    onTogglePlanPanel={handleTogglePlanPanel}
                    plans={plans}
                    activePlanIndex={activePlanIndex}
                    onChangePlan={handleChangePlan}
                    taskLabels={taskLabels}
                    streamingMessages={displayedStreamingMessages}
                    onSendMessage={isPlaybackLive ? handleSendMessage : undefined}
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
                    initialRequestData={initialRequestData}
                    initialRequestSchema={initialRequestSchema}
                    initialRequestTitle={initialRequestTitle}
                    initialRequestTemplate={initialRequestTemplate}
                    showInitialRequest={initialHistoryStatus === 'empty' && messages.length === 0}
                    hiddenMessageTypes={hiddenMessageTypes}
                    disableAutoScroll={!isPlaybackLive}
                    renderRequestInputControls={!shouldShowRequestInputOverlay}
                    activeWorkstream={activeWorkstream}
                    onActiveWorkstreamChange={setActiveWorkstream}
                />
            )}

            {shouldShowRequestInputOverlay ? (
                <AgentRequestInputOverlay
                    message={pendingRequestInputMessage}
                    onSendMessage={isPlaybackLive ? handleSendMessage : undefined}
                    onMcpConnected={isPlaybackLive ? handleMcpConnected : undefined}
                    disabled={isUploading || !isPlaybackLive}
                    isLoading={isSending || isUploading}
                />
            ) : isViewingPlaybackHistory && playbackActiveWorkstreams.length > 0 ? (
                <div className="flex-shrink-0 pb-safe-area">
                    <ActiveWorkstreamsSummary activeWorkstreams={playbackActiveWorkstreams} />
                </div>
            ) : (
                shouldRenderLiveMessageInputArea && (
                    <div className="flex-shrink-0 pb-safe-area">
                        {isFailed ? (
                            // FAILED takes priority over every other branch so the composer can
                            // never render for a failed run. Use the caller's action when provided,
                            // otherwise fall back to the default failed message box.
                            (failedAction ?? (
                                <MessageBox status="error" icon={null} className="m-2">
                                    This Workflow is FAILED
                                </MessageBox>
                            ))
                        ) : effectiveWorkflowStatus &&
                          effectiveWorkflowStatus !== 'RUNNING' &&
                          !canContinueConversation ? (
                            viewMode === 'sliding' && effectiveWorkflowStatus === 'COMPLETED' ? (
                                <div className="mx-auto w-full max-w-3xl px-4 py-3 text-sm text-muted">
                                    <div className="flex items-center gap-2 border-t border-success/25 pt-3 text-success">
                                        <CheckCircle className="size-4" />
                                        <span className="font-medium">Workflow completed</span>
                                    </div>
                                </div>
                            ) : (
                                <MessageBox
                                    status={effectiveWorkflowStatus === 'COMPLETED' ? 'success' : 'done'}
                                    icon={null}
                                    className="m-2"
                                >
                                    This Workflow is {effectiveWorkflowStatus}
                                </MessageBox>
                            )
                        ) : (
                            (showInput || canContinueConversation) && (
                                <MessageInput
                                    onSend={handleSendMessage}
                                    onStop={allowWorkflowControl ? handleStopWorkflow : undefined}
                                    approvalModeSlot={
                                        interactive && toolApprovalMode ? (
                                            <AgentApprovalModeSelector
                                                mode={toolApprovalMode}
                                                onChange={handleToolApprovalModeChange}
                                                disabled={
                                                    !isPlaybackLive || effectiveIsCompleted || !allowWorkflowControl
                                                }
                                            />
                                        ) : undefined
                                    }
                                    mcpSlot={
                                        <McpConnectionsActionMenu
                                            disabledCollections={mcpDisabled}
                                            onChange={handleMcpDisabledChange}
                                            onConnectionChange={handleMcpConnectionChange}
                                        />
                                    }
                                    disabled={isUploading || !isPlaybackLive}
                                    isSending={isSending || isUploading}
                                    isStopping={isStopping}
                                    isStreaming={!effectiveIsCompleted}
                                    isCompleted={effectiveIsCompleted}
                                    contextWindowUsage={canCompactContext ? contextWindowUsage : undefined}
                                    onCompactContext={canCompactContext ? handleCompactContext : undefined}
                                    isCompactingContext={isCompactingContext}
                                    activeTaskCount={activeTaskCount}
                                    activeWorkstreams={composerActiveWorkstreams}
                                    placeholder={composerPlaceholder}
                                    onFilesSelected={canUploadFiles ? handleFileUpload : undefined}
                                    uploadedFiles={uploadedFiles}
                                    onRemoveFile={onRemoveFile}
                                    onRemoveProcessingFile={handleRemoveProcessingFile}
                                    acceptedFileTypes={acceptedFileTypes}
                                    maxFiles={maxFiles}
                                    processingFiles={processingFiles}
                                    artifactRunId={agentRunId}
                                    hasProcessingFiles={hasProcessingFiles}
                                    renderDocumentSearch={renderDocumentSearch}
                                    selectedDocuments={selectedDocuments}
                                    onRemoveDocument={onRemoveDocument}
                                    hideObjectLinking={hideObjectLinking}
                                    hideFileUpload={!canUploadFiles}
                                    disableDropZone={canUploadFiles}
                                    className={inputContainerClassName}
                                    inputClassName={inputClassName}
                                />
                            )
                        )}
                    </div>
                )
            )}
        </div>
    );

    // Main content - wrapped with FusionFragmentProvider when fusionData is provided
    const mainContent = (
        <ArtifactUrlCacheProvider>
            <ImageLightboxProvider>
                {/* biome-ignore lint/a11y/noStaticElementInteractions: drag/drop target only; file selection is also exposed via the upload button. */}
                <div
                    ref={conversationLayoutRef}
                    className={cn(
                        'flex flex-col lg:flex-row gap-2 w-full h-full relative overflow-hidden',
                        canUploadFiles && isDragOver && 'ring-2 ring-blue-400 ring-inset',
                        className,
                    )}
                    onDragEnter={canUploadFiles ? handleDragEnter : undefined}
                    onDragOver={canUploadFiles ? handleDragOver : undefined}
                    onDragLeave={canUploadFiles ? handleDragLeave : undefined}
                    onDrop={canUploadFiles ? handleDrop : undefined}
                >
                    {/* Drag overlay for full-panel file drop */}
                    {canUploadFiles && isDragOver && (
                        <div className="absolute inset-0 flex items-center justify-center bg-blue-100/80 dark:bg-blue-900/40 z-50 pointer-events-none rounded-lg">
                            <div className="text-blue-600 dark:text-blue-400 font-medium flex items-center gap-2 text-lg">
                                <UploadIcon className="size-6" />
                                Drop files to upload
                            </div>
                        </div>
                    )}
                    {/* Conversation Area — hidden when conversationTab moves it into the right panel */}
                    {!conversationTab && conversationAreaJsx}

                    {!conversationTab && headerVariant === 'compact' && !hideHeader && (
                        <div className="hidden h-full w-12 shrink-0 items-start justify-center px-1 pt-2 lg:flex">
                            {renderConversationHeader('compact')}
                        </div>
                    )}

                    {/* Unified Right Panel — Plan | Workstreams | Documents | Uploads */}
                    {isRightPanelVisible && (
                        <>
                            {!conversationTab && (
                                // biome-ignore lint/a11y/useSemanticElements: <hr> has no semantics for a draggable resize handle; ARIA separator is the spec-recommended pattern.
                                <div
                                    role="separator"
                                    aria-orientation="vertical"
                                    aria-label="Resize right panel"
                                    aria-valuenow={Math.round(rightPanelWidth)}
                                    aria-valuemin={300}
                                    aria-valuetext={`${Math.round(rightPanelWidth)} pixels`}
                                    tabIndex={0}
                                    className="hidden lg:block lg:w-1 lg:shrink-0 cursor-col-resize bg-border/70 hover:bg-border transition-colors"
                                    onMouseDown={() => setIsRightPanelResizing(true)}
                                    onKeyDown={(event) => {
                                        if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
                                        event.preventDefault();
                                        const step = event.shiftKey ? 32 : 16;
                                        // Right panel is anchored to the right edge — ArrowLeft grows it, ArrowRight shrinks.
                                        const delta = event.key === 'ArrowLeft' ? step : -step;
                                        const container = conversationLayoutRef.current;
                                        const minRightPanelWidth = 300;
                                        const minConversationWidth = 420;
                                        const maxRightPanelWidth = container
                                            ? Math.max(
                                                  minRightPanelWidth,
                                                  container.getBoundingClientRect().width - minConversationWidth,
                                              )
                                            : minRightPanelWidth + 600;
                                        setRightPanelWidth((w) =>
                                            Math.min(Math.max(w + delta, minRightPanelWidth), maxRightPanelWidth),
                                        );
                                    }}
                                />
                            )}
                            <div
                                className={
                                    conversationTab
                                        ? 'w-full h-full overflow-auto'
                                        : 'w-full lg:w-[var(--agent-right-panel-width)] lg:shrink-0 min-h-[50vh] lg:h-full border-t lg:border-t-0'
                                }
                                style={
                                    !conversationTab
                                        ? ({
                                              ['--agent-right-panel-width' as string]: `${rightPanelWidth}px`,
                                          } as React.CSSProperties)
                                        : undefined
                                }
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
                                    onUpdateDocumentTitle={updateDocumentTitle}
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
                                    activeTab={rightPanelTab}
                                    onTabChange={setRightPanelTab}
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
