import {
    type AgentMessage,
    AgentMessageType,
    type AskUserMessageDetails,
    type BatchProgressDetails,
    type JSONSchema,
    type Plan,
} from '@vertesia/common';
import { cn } from '@vertesia/ui/core';
import { i18nInstance, NAMESPACE, useUITranslation } from '@vertesia/ui/i18n';
import { MarkdownRenderer } from '@vertesia/ui/widgets';
import React, { Component, type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    AlertTriangle,
    Brain,
    ChevronDown,
    ChevronRight,
    FileText,
    Pencil,
    Search,
    Terminal,
    Wrench,
} from 'lucide-react';
import { AnimatedThinkingDots, PulsatingCircle } from '../AnimatedThinkingDots';
import { AskUserWidget } from '../AskUserWidget';
import { ThinkingMessages } from '../WaitingMessages';
import BatchProgressPanel, { type BatchProgressPanelClassNames } from './BatchProgressPanel';
import MessageItem, { type MessageItemClassNames, type MessageItemProps } from './MessageItem';
import StreamingMessage, { type StreamingMessageClassNames } from './StreamingMessage';
import {
    buildSummaryConversationItems,
    buildSummaryDisplayMessages,
    getSummaryActivityAnchorTimestamp,
    isInitialSummaryActivityFallback,
    isTransientThinkingMessage,
    shouldShowSummaryActivityFallback,
} from './SummaryConversation';
import ToolCallGroup, { type ToolCallGroupClassNames } from './ToolCallGroup';
import {
    DONE_STATES,
    getWorkstreamId,
    groupMessagesWithStreaming,
    isInProgress,
    mergeConsecutiveToolGroups,
    type RenderableGroup,
    type StreamingData,
    type ToolExecutionStatus,
    shouldCollapseAdjacentRenderedMessage,
} from './utils';
import WorkstreamTabs, { extractWorkstreams, filterMessagesByWorkstream } from './WorkstreamTabs';

export type AgentConversationViewMode = 'stacked' | 'sliding';

export interface AgentInitialRequestTemplateContext {
    data: unknown;
    schema?: JSONSchema | null;
    title?: string;
}

export type AgentInitialRequestTemplate = (context: AgentInitialRequestTemplateContext) => React.ReactNode;

/** Extended group that may carry preamble info (text from a preceding single/streaming message) */
type RenderableGroupWithPreamble = RenderableGroup & {
    preambleText?: string;
    preambleMessage?: AgentMessage;
    /** When true, this group was consumed as a preamble and should not render */
    _consumed?: boolean;
};

/** Message types that must never be consumed as preamble text */
const NON_PREAMBLE_TYPES = new Set([
    AgentMessageType.QUESTION,
    AgentMessageType.COMPLETE,
    AgentMessageType.IDLE,
    AgentMessageType.TERMINATED,
    AgentMessageType.ERROR,
    AgentMessageType.REQUEST_INPUT,
    AgentMessageType.BATCH_PROGRESS,
]);

/**
 * Scan grouped messages and attach preamble text to tool_groups.
 * When a single message (THOUGHT, UPDATE, ANSWER, etc.) immediately precedes
 * a tool_group, the text is attached as preamble and the single message is marked
 * as consumed so it doesn't render as a separate "Agent" box.
 */
function attachPreambles(groups: RenderableGroup[]): RenderableGroupWithPreamble[] {
    const result: RenderableGroupWithPreamble[] = groups.map((g) => ({ ...g }));

    for (let i = 1; i < result.length; i++) {
        const current = result[i];
        const prev = result[i - 1];

        // Only attach preamble to tool_groups
        if (current.type !== 'tool_group') continue;
        // Previous must be a single message with text content
        if (prev.type !== 'single' || prev._consumed) continue;

        const msg = prev.message;
        const text = typeof msg.message === 'string' ? msg.message.trim() : '';
        if (!text) continue;

        // Skip messages that are tool activity themselves (already part of tool groups)
        const isToolActivity = msg.details?.tool || msg.details?.tools;
        if (isToolActivity) continue;

        // Skip terminal/interactive message types that should always render independently
        if (NON_PREAMBLE_TYPES.has(msg.type)) continue;

        // Attach as preamble
        current.preambleText = text;
        current.preambleMessage = msg;
        prev._consumed = true;
    }

    // Filter out consumed groups
    return result.filter((g) => !g._consumed);
}

// Check if message is a batch progress message
const isBatchProgressMessage = (message: AgentMessage): message is AgentMessage & { details: BatchProgressDetails } => {
    return message.type === AgentMessageType.BATCH_PROGRESS && !!message.details?.batch_id;
};

function getTimestampMs(timestamp: number | string | undefined): number {
    if (timestamp === undefined || timestamp === null || timestamp === '') return Date.now();
    const value = typeof timestamp === 'number' ? timestamp : new Date(timestamp).getTime();
    return Number.isFinite(value) ? value : Date.now();
}

function getElapsedSeconds(timestamp: number | string | undefined): number {
    const elapsed = Date.now() - getTimestampMs(timestamp);
    return Math.max(0, Math.round(elapsed / 1000));
}

function getDurationSeconds(start: number | string | undefined, end: number | string | undefined): number {
    const elapsed = getTimestampMs(end) - getTimestampMs(start);
    return Math.max(0, Math.round(elapsed / 1000));
}

function formatDuration(seconds: number): string {
    if (seconds < 60) return `${seconds}s`;

    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
}

function getReadableToolLabel(message: AgentMessage): string {
    const details = message.details as
        | {
              display_role?: string;
              tool?: string;
              tools?: Array<string | { name?: string; tool?: string }>;
          }
        | undefined;
    const rawTool = details?.tool || '';
    const relatedTools = Array.isArray(details?.tools)
        ? details.tools.map((tool) => (typeof tool === 'string' ? tool : tool.name || tool.tool || '')).filter(Boolean)
        : [];
    const toolNames = [rawTool, ...relatedTools].join(' ').toLowerCase();
    const tool = rawTool.toLowerCase();
    const text = typeof message.message === 'string' ? message.message.trim() : '';

    if (details?.display_role === 'tool_preamble') {
        if (toolNames.includes('search') || toolNames.includes('web') || toolNames.includes('fetch')) {
            return 'Preparing search';
        }
        return relatedTools.length > 0 ? 'Preparing tools' : 'Thinking';
    }

    if (tool.includes('search')) return 'Searching';
    if (tool.includes('fetch') || tool.includes('web')) return 'Searching the web';
    if (tool.includes('read') || tool.includes('document')) return 'Reading';
    if (tool.includes('edit') || tool.includes('write') || tool.includes('create')) return 'Editing';
    if (tool.includes('bash') || tool.includes('shell') || tool.includes('command')) return 'Running command';
    if (text) return text;
    return 'Using tool';
}

function getSummaryWorkLabel(status: ToolExecutionStatus, isActive: boolean): string {
    if (status === 'error') return 'Work needs attention';
    if (status === 'warning') return 'Work had warnings';
    return isActive ? 'Working' : 'Worked';
}

function isTransientThinkingWork(messages: AgentMessage[]): boolean {
    return messages.length > 0 && messages.every(isTransientThinkingMessage);
}

function getSummaryActivityLabel(status: ToolExecutionStatus, isActive: boolean): string {
    return getSummaryWorkLabel(status, isActive);
}

function hasOpenUserTurn(messages: AgentMessage[]): boolean {
    const mainMessages = messages.filter((message) => getWorkstreamId(message) === 'main');
    const latestMessage = mainMessages[mainMessages.length - 1] ?? messages[messages.length - 1];
    return latestMessage?.type === AgentMessageType.QUESTION;
}

function getMessageText(message: AgentMessage): string {
    if (!message.message) return '';
    if (typeof message.message === 'object') return JSON.stringify(message.message, null, 2);
    return String(message.message).trim();
}

interface SummaryMessageProps {
    message: AgentMessage;
    onSendMessage?: (message: string) => void;
    StoreLinkComponent?: React.ComponentType<{ href: string; documentId: string; children: React.ReactNode }>;
    CollectionLinkComponent?: React.ComponentType<{ href: string; collectionId: string; children: React.ReactNode }>;
}

const SUMMARY_PROSE_CLASS = [
    'agent-markdown vprose prose max-w-none break-words text-sm leading-6 text-foreground/80',
    'prose-p:my-2 prose-p:leading-6 prose-li:my-0.5 prose-pre:my-3 prose-headings:tracking-normal',
    'prose-headings:text-foreground prose-strong:text-foreground prose-code:text-foreground',
    'prose-a:text-foreground prose-a:underline prose-a:decoration-muted prose-a:underline-offset-4',
    '[&_p]:text-foreground/80 [&_li]:text-foreground/80 [&_li::marker]:text-muted',
].join(' ');

const USER_BUBBLE_COLLAPSE_THRESHOLD = 520;

function getReactNodeTextLength(node: React.ReactNode): number {
    if (node === null || node === undefined || typeof node === 'boolean') return 0;
    if (typeof node === 'string' || typeof node === 'number') return String(node).length;
    if (Array.isArray(node)) {
        return node.reduce((total, child) => total + getReactNodeTextLength(child), 0);
    }
    if (React.isValidElement(node)) {
        const props = node.props as { children?: React.ReactNode };
        return getReactNodeTextLength(props.children);
    }
    return 0;
}

function useLiveElapsedSeconds(timestamp?: number | string, enabled?: boolean): number {
    const [elapsed, setElapsed] = useState(() => getElapsedSeconds(timestamp));

    useEffect(() => {
        if (!enabled) {
            setElapsed(getElapsedSeconds(timestamp));
            return;
        }

        const updateElapsed = () => setElapsed(getElapsedSeconds(timestamp));
        updateElapsed();
        const intervalId = window.setInterval(updateElapsed, 1000);
        return () => window.clearInterval(intervalId);
    }, [enabled, timestamp]);

    return elapsed;
}

function useRotatingThinkingMessageIndex(enabled = true): number {
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

function SummaryUserBubble({
    children,
    workstreamId,
    className,
}: {
    children: React.ReactNode;
    workstreamId?: string;
    className?: string;
}) {
    const { t } = useUITranslation();
    const [isExpanded, setIsExpanded] = useState(false);
    const contentLength = useMemo(() => getReactNodeTextLength(children), [children]);
    const shouldCollapse = contentLength > USER_BUBBLE_COLLAPSE_THRESHOLD;
    const isPlainText = typeof children === 'string' || typeof children === 'number';

    useEffect(() => {
        if (!shouldCollapse && isExpanded) {
            setIsExpanded(false);
        }
    }, [isExpanded, shouldCollapse]);

    return (
        <div className="mx-auto flex w-full max-w-3xl justify-end px-1">
            <div
                className={cn(
                    'max-w-[min(44rem,82%)] rounded-[1.35rem] bg-mixer-muted/35 px-4 py-2.5',
                    'text-sm font-normal leading-6 text-foreground/90 shadow-sm shadow-black/5 dark:bg-mixer-muted/15 dark:text-foreground/88 dark:shadow-none',
                    'break-words [overflow-wrap:anywhere]',
                    className,
                )}
                data-workstream-id={workstreamId}
            >
                <div
                    className={cn(
                        isPlainText && 'whitespace-pre-wrap',
                        shouldCollapse &&
                            !isExpanded &&
                            'max-h-72 overflow-hidden [mask-image:linear-gradient(to_bottom,black_76%,transparent_100%)]',
                    )}
                >
                    {children}
                </div>
                {shouldCollapse && (
                    <button
                        type="button"
                        aria-expanded={isExpanded}
                        className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-muted transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        onClick={() => setIsExpanded((current) => !current)}
                    >
                        {isExpanded ? t('agent.showLess') : t('agent.showMore')}
                        <ChevronDown
                            className={cn('size-4 transition-transform', isExpanded && 'rotate-180')}
                            aria-hidden="true"
                        />
                    </button>
                )}
            </div>
        </div>
    );
}

function SummaryMessage({ message, onSendMessage, StoreLinkComponent, CollectionLinkComponent }: SummaryMessageProps) {
    const content = getMessageText(message);
    const workstreamId = getWorkstreamId(message);
    const runId = (message as { workflow_run_id?: string }).workflow_run_id;

    const markdownComponents = useMemo(
        () => ({
            a: ({
                node: _node,
                ref: _ref,
                ...props
            }: {
                node?: unknown;
                ref?: unknown;
                href?: string;
                children?: React.ReactNode;
            }) => {
                const href = props.href || '';
                if (href.includes('/store/objects') && StoreLinkComponent) {
                    const documentId = href.split('/store/objects/')[1] || '';
                    return (
                        <StoreLinkComponent href={href} documentId={documentId}>
                            {props.children}
                        </StoreLinkComponent>
                    );
                }
                if (href.includes('/store/collections') && CollectionLinkComponent) {
                    const collectionId = href.split('/store/collections/')[1] || '';
                    return (
                        <CollectionLinkComponent href={href} collectionId={collectionId}>
                            {props.children}
                        </CollectionLinkComponent>
                    );
                }
                return <a {...props} target="_blank" rel="noopener noreferrer" />;
            },
        }),
        [StoreLinkComponent, CollectionLinkComponent],
    );

    if (message.type === AgentMessageType.QUESTION) {
        return <SummaryUserBubble workstreamId={workstreamId}>{content}</SummaryUserBubble>;
    }

    if (message.type === AgentMessageType.REQUEST_INPUT && (message.details as AskUserMessageDetails)?.ux) {
        const uxConfig = (message.details as AskUserMessageDetails).ux!;
        return (
            <div className="mx-auto w-full max-w-3xl px-1">
                <AskUserWidget
                    question={content}
                    options={uxConfig.options}
                    variant={uxConfig.variant}
                    multiSelect={uxConfig.multiSelect}
                    onSelect={(optionId) => onSendMessage?.(optionId)}
                    onMultiSelect={(optionIds) => onSendMessage?.(optionIds.join(', '))}
                    hideBorder
                />
            </div>
        );
    }

    const isError = message.type === AgentMessageType.ERROR || message.type === AgentMessageType.WARNING;

    return (
        <div className="mx-auto w-full max-w-3xl px-1" data-workstream-id={workstreamId}>
            {isError && (
                <div className="mb-2 text-xs font-medium text-destructive">
                    {message.type === AgentMessageType.WARNING ? 'Warning' : 'Error'}
                </div>
            )}
            {content && (
                <div
                    className={cn(
                        SUMMARY_PROSE_CLASS,
                        isError && 'rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2',
                    )}
                    style={{ overflowWrap: 'anywhere' }}
                >
                    <MarkdownRenderer
                        artifactRunId={runId}
                        onProposalSelect={(optionId) => onSendMessage?.(optionId)}
                        onProposalSubmit={(text) => onSendMessage?.(text)}
                        components={markdownComponents}
                    >
                        {content}
                    </MarkdownRenderer>
                </div>
            )}
        </div>
    );
}

function isRecordValue(value: unknown): value is Record<string, unknown> {
    return !!value && typeof value === 'object' && !Array.isArray(value);
}

function hasInitialRequestValue(value: unknown): boolean {
    if (value === null || value === undefined) return false;
    if (typeof value === 'string') return value.trim().length > 0;
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === 'object') return Object.keys(value as Record<string, unknown>).length > 0;
    return true;
}

function isRenderableNode(node: React.ReactNode): boolean {
    if (node === null || node === undefined || node === false) return false;
    if (typeof node === 'string') return node.trim().length > 0;
    return true;
}

function getSchemaProperties(schema: JSONSchema | null | undefined): Record<string, JSONSchema> {
    if (!schema || !isRecordValue(schema)) return {};
    const properties = (schema as Record<string, unknown>).properties;
    if (!isRecordValue(properties)) return {};
    return properties as Record<string, JSONSchema>;
}

function getSchemaLabel(schema: JSONSchema | undefined, fallback: string): string {
    const title = schema && isRecordValue(schema) ? schema.title : undefined;
    if (typeof title === 'string' && title.trim()) return title;

    return fallback
        .replace(/[_-]+/g, ' ')
        .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
        .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function stringifyRequestValue(value: unknown): string {
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    try {
        return JSON.stringify(value, null, 2);
    } catch {
        return String(value);
    }
}

function renderRequestValue(value: unknown): React.ReactNode {
    if (value === null || value === undefined || value === '') {
        return <span className="text-muted">Not provided</span>;
    }
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    if (typeof value === 'number') return String(value);
    if (typeof value === 'string') return <span className="whitespace-pre-wrap">{value}</span>;
    if (Array.isArray(value) && value.every((item) => typeof item !== 'object' || item === null)) {
        return value.map((item) => stringifyRequestValue(item)).join(', ');
    }

    return (
        <pre className="max-h-40 overflow-auto whitespace-pre-wrap rounded-md bg-background/55 px-2 py-1.5 font-mono text-[12px] leading-relaxed text-foreground/80">
            {stringifyRequestValue(value)}
        </pre>
    );
}

function renderDefaultInitialRequest(
    data: unknown,
    schema: JSONSchema | null | undefined,
    title: string | undefined,
): React.ReactNode {
    if (!hasInitialRequestValue(data)) return null;
    if (!isRecordValue(data)) return renderRequestValue(data);

    const properties = getSchemaProperties(schema);
    const fieldKeys = [...Object.keys(properties), ...Object.keys(data).filter((key) => !(key in properties))];
    const fields = fieldKeys
        .map((key) => ({
            key,
            label: getSchemaLabel(properties[key], key),
            value: data[key],
        }))
        .filter((field) => hasInitialRequestValue(field.value));

    if (fields.length === 0) return null;

    return (
        <div className="space-y-2 text-start">
            {title ? <div className="text-xs font-medium uppercase tracking-normal text-muted">{title}</div> : null}
            <dl className="space-y-2">
                {fields.map((field) => (
                    <div key={field.key} className="grid gap-1 sm:grid-cols-[minmax(7rem,32%)_1fr] sm:gap-3">
                        <dt className="text-xs font-medium text-muted">{field.label}</dt>
                        <dd className="min-w-0 break-words text-sm text-foreground">
                            {renderRequestValue(field.value)}
                        </dd>
                    </div>
                ))}
            </dl>
        </div>
    );
}

interface InitialRequestMessageProps {
    data?: unknown;
    schema?: JSONSchema | null;
    title?: string;
    template?: AgentInitialRequestTemplate;
    prependFriendlyMessage?: string;
    timestamp?: number | string;
    isSummaryView: boolean;
    messageItemClassNames?: MessageItemClassNames;
    messageStyleOverrides?: MessageItemProps['messageStyleOverrides'];
    StoreLinkComponent?: React.ComponentType<{ href: string; documentId: string; children: React.ReactNode }>;
    CollectionLinkComponent?: React.ComponentType<{ href: string; collectionId: string; children: React.ReactNode }>;
}

function InitialRequestMessage({
    data,
    schema,
    title,
    template,
    prependFriendlyMessage,
    timestamp,
    isSummaryView,
    messageItemClassNames,
    messageStyleOverrides,
    StoreLinkComponent,
    CollectionLinkComponent,
}: InitialRequestMessageProps) {
    const plainText = prependFriendlyMessage?.trim() || (typeof data === 'string' ? data.trim() : '');
    const templateContent = template?.({
        data: data ?? prependFriendlyMessage,
        schema,
        title,
    });

    if (!isRenderableNode(templateContent) && plainText) {
        const message = {
            type: AgentMessageType.QUESTION,
            message: plainText,
            timestamp: getTimestampMs(timestamp),
            workflow_run_id: '',
            workstream_id: 'main',
        };

        return isSummaryView ? (
            <SummaryMessage
                message={message}
                StoreLinkComponent={StoreLinkComponent}
                CollectionLinkComponent={CollectionLinkComponent}
            />
        ) : (
            <MessageItem {...messageItemClassNames} messageStyleOverrides={messageStyleOverrides} message={message} />
        );
    }

    const content = isRenderableNode(templateContent)
        ? templateContent
        : renderDefaultInitialRequest(data, schema, title);
    if (!isRenderableNode(content)) return null;

    return <SummaryUserBubble className="py-3">{content}</SummaryUserBubble>;
}

function InitialRequestWaitingCard({
    label,
    timestamp,
    className,
}: {
    label: string;
    timestamp?: number | string;
    className?: string;
}) {
    const thinkingMessageIndex = useRotatingThinkingMessageIndex();
    const elapsed = useLiveElapsedSeconds(timestamp, true);

    return (
        <div className={cn('mx-auto w-full max-w-3xl px-1', className)}>
            <div className="border-b border-border/70 pb-4 text-sm text-muted">
                <div className="flex items-center gap-3">
                    <PulsatingCircle size="sm" color="blue" />
                    <div className="min-w-0">
                        <div>
                            <span className="font-medium">{label}</span>
                            <span className="ms-2 text-muted/75">for {formatDuration(elapsed)}</span>
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

type SummaryToolDetailKind = 'search' | 'read' | 'edit' | 'command' | 'skill' | 'discover' | 'think' | 'tool';

interface SummaryToolDetailSection {
    label: string;
    value: unknown;
    tone?: 'default' | 'error';
}

interface SummaryToolDetailItem {
    key: string;
    kind: SummaryToolDetailKind;
    label: string;
    title: string;
    text?: string;
    status?: ToolExecutionStatus;
    sections: SummaryToolDetailSection[];
}

const TOOL_DETAIL_SYSTEM_KEYS = new Set([
    'account_id',
    'activity_group_id',
    'activity_id',
    'channel_id',
    'collection_id',
    'document_id',
    'display_role',
    'event_class',
    'id',
    'object_id',
    'project_id',
    'run_id',
    'streamed',
    'tenant_id',
    'thread_id',
    'tool',
    'tool_iteration',
    'tool_run_id',
    'tool_status',
    'tools',
    'workflow_run_id',
]);

function getDetailsRecord(message: AgentMessage): Record<string, unknown> {
    return isRecordValue(message.details) ? message.details : {};
}

function humanizeIdentifier(value: string): string {
    return value
        .replace(/[_-]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function getFirstStringValue(details: Record<string, unknown>, keys: string[]): string | undefined {
    for (const key of keys) {
        const value = details[key];
        if (typeof value === 'string' && value.trim()) return value.trim();
        if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    }
    return undefined;
}

function getToolNames(details: Record<string, unknown>): string[] {
    const names: string[] = [];
    if (typeof details.tool === 'string' && details.tool.trim()) names.push(details.tool.trim());
    if (Array.isArray(details.tools)) {
        for (const tool of details.tools) {
            if (typeof tool === 'string' && tool.trim()) {
                names.push(tool.trim());
            } else if (isRecordValue(tool)) {
                const name = typeof tool.name === 'string' ? tool.name : tool.tool;
                if (typeof name === 'string' && name.trim()) names.push(name.trim());
            }
        }
    }
    return names;
}

function getToolDetailKind(message: AgentMessage): SummaryToolDetailKind {
    const details = getDetailsRecord(message);
    const toolNames = getToolNames(details).join(' ').toLowerCase();
    const concreteTool = typeof details.tool === 'string' ? details.tool.toLowerCase() : '';
    const text = getMessageText(message).toLowerCase();
    const haystack = `${toolNames} ${text}`;

    if (details.display_role === 'tool_preamble') return 'think';
    if (concreteTool.startsWith('learn_') || haystack.includes('learn_') || /\bskill\b/.test(text)) return 'skill';
    if (concreteTool === 'discover_tools') return 'discover';
    if (message.type === AgentMessageType.THOUGHT && !concreteTool) return 'think';

    const classifierText = concreteTool || haystack;
    if (classifierText.includes('search') || classifierText.includes('web') || classifierText.includes('fetch'))
        return 'search';
    if (classifierText.includes('read') || classifierText.includes('document') || classifierText.includes('file'))
        return 'read';
    if (
        classifierText.includes('edit') ||
        classifierText.includes('write') ||
        classifierText.includes('patch') ||
        classifierText.includes('create')
    )
        return 'edit';
    if (
        classifierText.includes('bash') ||
        classifierText.includes('shell') ||
        classifierText.includes('command') ||
        classifierText.includes('terminal')
    )
        return 'command';
    if (message.type === AgentMessageType.THOUGHT && toolNames.length === 0) return 'think';
    return 'tool';
}

function getToolDetailLabel(kind: SummaryToolDetailKind): string {
    switch (kind) {
        case 'search':
            return 'Search';
        case 'read':
            return 'Read';
        case 'edit':
            return 'Edit';
        case 'command':
            return 'Bash';
        case 'skill':
            return 'Skill';
        case 'discover':
            return 'Tool';
        case 'think':
            return 'Thought';
        default:
            return 'Tool';
    }
}

function getToolTarget(details: Record<string, unknown>): string | undefined {
    const directTarget = getFirstStringValue(details, [
        'query',
        'path',
        'file',
        'file_name',
        'fileName',
        'filename',
        'name',
        'title',
        'artifact',
        'artifact_path',
        'url',
        'command',
    ]);
    if (directTarget) return directTarget;

    const files = details.files ?? details.outputFiles;
    if (Array.isArray(files) && files.length > 0) {
        return files.map((file) => stringifyRequestValue(file)).join(', ');
    }

    return undefined;
}

function compactInlineText(value: string, maxLength = 160): string {
    const normalized = value.replace(/\s+/g, ' ').trim();
    return normalized.length > maxLength ? `${normalized.slice(0, maxLength - 1)}...` : normalized;
}

function formatToolSectionValue(value: unknown): string {
    const text = stringifyRequestValue(value).trim();
    return text.length > 2400 ? `${text.slice(0, 2400)}\n...` : text;
}

function createToolSection(
    label: string,
    value: unknown,
    tone?: SummaryToolDetailSection['tone'],
): SummaryToolDetailSection | undefined {
    if (value === null || value === undefined || value === '') return undefined;
    if (Array.isArray(value) && value.length === 0) return undefined;
    if (isRecordValue(value) && Object.keys(value).length === 0) return undefined;
    return { label, value, tone };
}

function getRemainingDetailFields(
    details: Record<string, unknown>,
    consumedKeys: Set<string>,
): Record<string, unknown> | undefined {
    const remaining = Object.entries(details).reduce<Record<string, unknown>>((acc, [key, value]) => {
        if (TOOL_DETAIL_SYSTEM_KEYS.has(key) || consumedKeys.has(key)) return acc;
        if (value === null || value === undefined || value === '') return acc;
        acc[key] = value;
        return acc;
    }, {});

    return Object.keys(remaining).length > 0 ? remaining : undefined;
}

function getToolDetailSections(message: AgentMessage): SummaryToolDetailSection[] {
    const details = getDetailsRecord(message);
    const consumedKeys = new Set<string>();
    const sections: SummaryToolDetailSection[] = [];

    const addSection = (label: string, keys: string[], tone?: SummaryToolDetailSection['tone']) => {
        for (const key of keys) {
            const section = createToolSection(label, details[key], tone);
            if (section) {
                consumedKeys.add(key);
                sections.push(section);
                return;
            }
        }
    };

    addSection('Query', ['query']);
    addSection('Input', ['input', 'params', 'arguments', 'args']);
    addSection('Output', [
        'output',
        'stdout',
        'result',
        'results',
        'content',
        'result_summary',
        'observation',
        'display_message',
    ]);
    addSection('Files', ['files', 'outputFiles']);
    addSection('Error', ['error', 'stderr'], 'error');

    const remainingDetails = getRemainingDetailFields(details, consumedKeys);
    if (sections.length === 0 && remainingDetails) {
        sections.push({ label: 'Details', value: remainingDetails });
    }

    return sections;
}

function buildSummaryToolDetailItem(message: AgentMessage, index: number): SummaryToolDetailItem | undefined {
    const text = getMessageText(message);
    const details = getDetailsRecord(message);
    const kind = getToolDetailKind(message);
    const toolNames = getToolNames(details);
    const target = getToolTarget(details);
    const fallbackTitle = toolNames[0] ? humanizeIdentifier(toolNames[0]) : getReadableToolLabel(message);
    const title = compactInlineText(target || text || fallbackTitle);
    const normalizedText = text ? compactInlineText(text, 420) : undefined;
    const shouldShowText = normalizedText && normalizedText !== title;

    if (!title && !shouldShowText) return undefined;

    return {
        key: `${message.timestamp}-${details.activity_id || details.tool_run_id || index}`,
        kind,
        label: getToolDetailLabel(kind),
        title,
        text: shouldShowText ? normalizedText : undefined,
        status: details.tool_status as ToolExecutionStatus | undefined,
        sections: getToolDetailSections(message),
    };
}

function mergeSummaryToolMessages(messages: AgentMessage[]): AgentMessage[] {
    const byRunId = new Map<string, { index: number; messages: AgentMessage[] }>();
    const ungrouped: Array<{ index: number; message: AgentMessage }> = [];

    messages.forEach((message, index) => {
        const details = getDetailsRecord(message);
        const runId = typeof details.tool_run_id === 'string' ? details.tool_run_id : undefined;
        if (!runId) {
            ungrouped.push({ index, message });
            return;
        }

        const group = byRunId.get(runId);
        if (group) {
            group.messages.push(message);
        } else {
            byRunId.set(runId, { index, messages: [message] });
        }
    });

    const grouped = Array.from(byRunId.values()).map(({ index, messages: runMessages }) => {
        const sortedMessages = [...runMessages].sort(
            (a, b) => getTimestampMs(a.timestamp) - getTimestampMs(b.timestamp),
        );
        const baseMessage = sortedMessages[sortedMessages.length - 1];
        const firstTextMessage = sortedMessages.find((message) => getMessageText(message));
        const mergedDetails = sortedMessages.reduce<Record<string, unknown>>(
            (acc, message) => ({
                ...acc,
                ...getDetailsRecord(message),
            }),
            {},
        );

        return {
            index,
            message: {
                ...baseMessage,
                message: firstTextMessage ? firstTextMessage.message : baseMessage.message,
                details: mergedDetails,
            },
        };
    });

    return [...ungrouped, ...grouped].sort((a, b) => a.index - b.index).map(({ message }) => message);
}

function buildSummaryToolDetailItems(messages: AgentMessage[]): SummaryToolDetailItem[] {
    const seen = new Set<string>();
    const items: SummaryToolDetailItem[] = [];

    mergeSummaryToolMessages(messages).forEach((message, index) => {
        const item = buildSummaryToolDetailItem(message, index);
        if (!item) return;
        const signature = `${item.kind}:${item.label}:${item.title}:${item.text ?? ''}`;
        if (seen.has(signature)) return;
        seen.add(signature);
        items.push(item);
    });

    return items;
}

function ToolDetailIcon({ kind, status }: { kind: SummaryToolDetailKind; status?: ToolExecutionStatus }) {
    if (status === 'error' || status === 'warning') {
        return <AlertTriangle className="size-3.5" />;
    }

    switch (kind) {
        case 'search':
            return <Search className="size-3.5" />;
        case 'read':
            return <FileText className="size-3.5" />;
        case 'edit':
            return <Pencil className="size-3.5" />;
        case 'command':
            return <Terminal className="size-3.5" />;
        case 'skill':
            return <Brain className="size-3.5" />;
        case 'discover':
            return <Wrench className="size-3.5" />;
        case 'think':
            return <Brain className="size-3.5" />;
        default:
            return <Wrench className="size-3.5" />;
    }
}

function ToolDetailSection({ section }: { section: SummaryToolDetailSection }) {
    const value = section.value;
    const isPrimitive = typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean';
    const isFileList = section.label === 'Files' && Array.isArray(value);
    const hideLabel = section.label === 'Output';

    if (isFileList) {
        return (
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {value.map((file, index) => (
                    <span
                        key={`${stringifyRequestValue(file)}-${index}`}
                        className="rounded-md bg-mixer-muted/15 px-1.5 py-0.5 font-mono text-[11px] text-muted"
                    >
                        {compactInlineText(stringifyRequestValue(file), 64)}
                    </span>
                ))}
            </div>
        );
    }

    const labelClassName = cn('text-xs font-medium', section.tone === 'error' ? 'text-destructive' : 'text-muted');
    const content =
        isPrimitive && !String(value).includes('\n') && String(value).length < 180 ? (
            <div
                className={cn(
                    'break-words text-xs',
                    section.tone === 'error' ? 'text-destructive' : 'text-foreground/75',
                )}
            >
                {String(value)}
            </div>
        ) : (
            <pre
                className={cn(
                    'max-h-52 overflow-auto whitespace-pre-wrap rounded-lg px-3 py-2 font-mono text-[11px] leading-relaxed',
                    section.tone === 'error'
                        ? 'bg-destructive/5 text-destructive'
                        : 'bg-mixer-muted/10 text-foreground/75',
                )}
            >
                {formatToolSectionValue(value)}
            </pre>
        );

    return (
        <div className="mt-2">
            {!hideLabel ? <div className={cn('mb-1', labelClassName)}>{section.label}</div> : null}
            {content}
        </div>
    );
}

function SummaryToolTimelineItem({ item }: { item: SummaryToolDetailItem }) {
    const isAttention = item.status === 'error' || item.status === 'warning';
    const hasDetails = Boolean(item.text || item.sections.length);
    const [isExpanded, setIsExpanded] = useState(isAttention);

    return (
        <div className="min-w-0">
            <button
                type="button"
                className={cn(
                    'grid w-full grid-cols-[1.5rem_1fr_auto] gap-2 text-start outline-none transition-colors',
                    'focus-visible:text-foreground focus-visible:underline focus-visible:underline-offset-4',
                    hasDetails ? 'cursor-pointer hover:text-foreground' : 'cursor-default',
                )}
                onClick={() => hasDetails && setIsExpanded((current) => !current)}
                aria-expanded={hasDetails ? isExpanded : undefined}
                disabled={!hasDetails}
            >
                <span
                    className={cn(
                        'flex size-5 items-center justify-center pt-0.5',
                        isAttention ? 'text-attention' : 'text-muted',
                    )}
                >
                    <ToolDetailIcon kind={item.kind} status={item.status} />
                </span>
                <span className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
                    <span className="text-sm font-medium text-muted">{item.label}</span>
                    <span className="min-w-0 break-words text-sm text-muted">{item.title}</span>
                </span>
                {hasDetails ? (
                    <ChevronDown
                        className={cn(
                            'mt-0.5 size-4 shrink-0 text-muted opacity-50 transition-transform',
                            !isExpanded && '-rotate-90',
                        )}
                        aria-hidden="true"
                    />
                ) : null}
            </button>
            {hasDetails && isExpanded ? (
                <div className="ms-7 mt-1">
                    {item.text ? (
                        <div className="break-words text-sm leading-relaxed text-muted">{item.text}</div>
                    ) : null}
                    {item.sections.map((section, sectionIndex) => (
                        <ToolDetailSection key={`${section.label}-${sectionIndex}`} section={section} />
                    ))}
                </div>
            ) : null}
        </div>
    );
}

function SummaryToolTimeline({ items }: { items: SummaryToolDetailItem[] }) {
    return (
        <div className="mt-3 max-h-[30rem] overflow-y-auto">
            <div className="space-y-2">
                {items.map((item) => (
                    <SummaryToolTimelineItem key={item.key} item={item} />
                ))}
            </div>
        </div>
    );
}

function SummaryStreamingMessage({
    text,
    artifactRunId,
    workstreamId,
}: {
    text: string;
    artifactRunId?: string;
    workstreamId?: string;
}) {
    return (
        <div className="mx-auto w-full max-w-3xl px-1" data-workstream-id={workstreamId}>
            <div className={SUMMARY_PROSE_CLASS} style={{ overflowWrap: 'anywhere' }}>
                <MarkdownRenderer artifactRunId={artifactRunId}>{text}</MarkdownRenderer>
            </div>
        </div>
    );
}

function SummaryActivityRow({
    label,
    status,
    timestamp,
    durationSeconds,
    showElapsed,
    details,
    emptyDetailsLabel,
    defaultExpanded = false,
    className,
}: {
    label: string;
    status?: ToolExecutionStatus;
    timestamp?: number | string;
    durationSeconds?: number;
    showElapsed?: boolean;
    details?: AgentMessage[];
    emptyDetailsLabel?: string;
    defaultExpanded?: boolean;
    className?: string;
}) {
    const [isExpanded, setIsExpanded] = useState(defaultExpanded);
    const isLiveElapsed = showElapsed && durationSeconds === undefined;
    const liveElapsed = useLiveElapsedSeconds(timestamp, isLiveElapsed);
    const elapsed = durationSeconds ?? liveElapsed;
    const shouldShowElapsed = showElapsed && timestamp !== undefined;
    const isAttention = status === 'error' || status === 'warning';
    const detailItems = useMemo(() => buildSummaryToolDetailItems(details ?? []), [details]);
    const canExpand = detailItems.length > 0 || Boolean(emptyDetailsLabel);

    return (
        <div className={cn('mx-auto w-full max-w-3xl px-1', className)}>
            <div
                className={cn('border-b border-border/70 pb-3 text-sm', isAttention ? 'text-attention' : 'text-muted')}
            >
                <button
                    type="button"
                    className={cn(
                        'inline-flex max-w-full items-center gap-2 text-start outline-none',
                        'focus-visible:text-foreground focus-visible:underline focus-visible:underline-offset-4',
                        canExpand ? 'cursor-pointer hover:text-foreground' : 'cursor-default',
                    )}
                    onClick={() => canExpand && setIsExpanded((current) => !current)}
                    aria-expanded={canExpand ? isExpanded : undefined}
                    disabled={!canExpand}
                >
                    <span className="min-w-0 truncate font-medium">{label}</span>
                    {shouldShowElapsed ? (
                        <span className="shrink-0 text-muted/75">for {formatDuration(elapsed)}</span>
                    ) : null}
                    {canExpand ? (
                        isExpanded ? (
                            <ChevronDown className="size-4 shrink-0 opacity-50" />
                        ) : (
                            <ChevronRight className="size-4 shrink-0 opacity-50" />
                        )
                    ) : null}
                </button>
                {canExpand && isExpanded ? (
                    detailItems.length > 0 ? (
                        <SummaryToolTimeline items={detailItems} />
                    ) : (
                        <div className="mt-3 flex items-center gap-2 text-sm text-muted">
                            <Terminal className="size-4 opacity-70" aria-hidden="true" />
                            <span>{emptyDetailsLabel}</span>
                        </div>
                    )
                ) : null}
            </div>
        </div>
    );
}

function TimelineEntry({ children, status }: { children: React.ReactNode; status?: ToolExecutionStatus | 'message' }) {
    const dotClass =
        status === 'error'
            ? 'bg-destructive'
            : status === 'warning'
              ? 'bg-attention'
              : status === 'completed'
                ? 'bg-success'
                : 'bg-muted';

    return (
        <div className="relative ps-7">
            <div className="absolute start-2 top-0 bottom-0 w-px bg-border" />
            <div className={cn('absolute start-[5px] top-4 size-2.5 rounded-full ring-4 ring-background', dotClass)} />
            {children}
        </div>
    );
}

// Error boundary to catch and isolate errors in individual message components
// Note: Markdown parsing errors are handled internally by MarkdownRenderer,
// so this mainly catches other component errors (e.g., artifact loading, charts)
class MessageErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; error?: Error }> {
    constructor(props: { children: ReactNode }) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError(error: Error) {
        console.error('Message render error:', error);
        return { hasError: true, error };
    }

    componentDidUpdate(prevProps: { children: ReactNode }) {
        // Auto-reset error state when children change
        // This allows recovery from transient errors during streaming
        if (this.state.hasError && prevProps.children !== this.props.children) {
            this.setState({ hasError: false, error: undefined });
        }
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="border-s-4 border-s-destructive bg-destructive/10 px-4 py-2 my-2 rounded-e">
                    <p className="text-sm text-destructive font-medium">
                        {i18nInstance.getFixedT(null, NAMESPACE)('agent.failedToRenderMessage')}
                    </p>
                    <p className="text-xs text-muted mt-1 truncate">{this.state.error?.message || 'Unknown error'}</p>
                </div>
            );
        }
        return this.props.children;
    }
}

interface AllMessagesMixedProps {
    messages: AgentMessage[];
    bottomRef: React.RefObject<HTMLDivElement>;
    viewMode?: 'stacked' | 'sliding';
    isCompleted?: boolean;
    plan?: Plan;
    workstreamStatus?: Map<string, 'pending' | 'in_progress' | 'completed'>;
    showPlanPanel?: boolean;
    onTogglePlanPanel?: () => void;
    plans?: Array<{ plan: Plan; timestamp: number }>;
    activePlanIndex?: number;
    onChangePlan?: (index: number) => void;
    taskLabels?: Map<string, string>; // Maps task IDs to more descriptive labels
    streamingMessages?: Map<string, StreamingData>; // Real-time streaming chunks
    /** Callback when user sends a message (e.g., from proposal selection) */
    onSendMessage?: (message: string) => void;
    /** Stable index for thinking messages (changes on 4s interval) */
    thinkingMessageIndex?: number;
    /** className overrides passed to every MessageItem */
    messageItemClassNames?: MessageItemClassNames;
    /** Sparse MESSAGE_STYLES overrides passed to every MessageItem */
    messageStyleOverrides?: MessageItemProps['messageStyleOverrides'];
    toolCallGroupClassNames?: ToolCallGroupClassNames;
    /** Hide ToolCallGroup in this view mode */
    hideToolCallsInViewMode?: AgentConversationViewMode[];
    streamingMessageClassNames?: StreamingMessageClassNames;
    batchProgressPanelClassNames?: BatchProgressPanelClassNames;
    /** Run ID used to resolve artifact references in streaming chart specs */
    artifactRunId?: string;
    /** Hide the workstream tabs entirely */
    hideWorkstreamTabs?: boolean;
    /** className override for the working indicator container */
    workingIndicatorClassName?: string;
    /** className override for the message list container (spacing/layout) */
    messageListClassName?: string;
    /** Custom component to render store/document links instead of default NavLink navigation */
    StoreLinkComponent?: React.ComponentType<{ href: string; documentId: string; children: React.ReactNode }>;
    /** Custom component to render store/collection links instead of default NavLink navigation */
    CollectionLinkComponent?: React.ComponentType<{ href: string; collectionId: string; children: React.ReactNode }>;
    /** Optional message to display as the first user message in the conversation.
     *  Purely visual/UI — not sent to temporal. Renders as a QUESTION MessageItem before real messages. */
    prependFriendlyMessage?: string;
    /** Optional structured request data to render as the first user entry in Summary/Details. */
    initialRequestData?: unknown;
    /** Optional schema used to turn structured request data into a readable first entry. */
    initialRequestSchema?: JSONSchema | null;
    /** Optional title for the structured request renderer. */
    initialRequestTitle?: string;
    /** Optional caller-provided renderer for agent-specific request shapes. */
    initialRequestTemplate?: AgentInitialRequestTemplate;
    /** Message types to exclude from the conversation view */
    hiddenMessageTypes?: AgentMessageType[];
}

// PERFORMANCE: Throttle interval for auto-scroll (ms)
const SCROLL_THROTTLE_MS = 100; // Max 10 scrolls per second

function AllMessagesMixedComponent({
    messages,
    bottomRef,
    viewMode = 'stacked',
    isCompleted = false,
    streamingMessages = new Map(),
    onSendMessage,
    messageItemClassNames,
    messageStyleOverrides,
    toolCallGroupClassNames,
    hideToolCallsInViewMode,
    streamingMessageClassNames,
    batchProgressPanelClassNames,
    artifactRunId,
    hideWorkstreamTabs,
    workingIndicatorClassName,
    messageListClassName,
    StoreLinkComponent,
    CollectionLinkComponent,
    prependFriendlyMessage,
    initialRequestData,
    initialRequestSchema,
    initialRequestTitle,
    initialRequestTemplate,
    hiddenMessageTypes,
}: AllMessagesMixedProps) {
    if (!artifactRunId) {
        console.warn('[AllMessagesMixed] artifactRunId prop is missing!');
    }

    const { t } = useUITranslation();
    const containerRef = useRef<HTMLDivElement | null>(null);
    const [activeWorkstream, setActiveWorkstream] = useState<string>('all');

    // PERFORMANCE: Throttle auto-scroll to prevent layout thrashing
    // During streaming, scrollIntoView was being called 30+ times/sec
    const lastScrollTimeRef = useRef<number>(0);
    const scrollScheduledRef = useRef<number | null>(null);
    // Track whether the user has manually scrolled away from the bottom.
    // When true, auto-scroll is suppressed so the user can read earlier content.
    const userScrolledUpRef = useRef<boolean>(false);
    // Guard to distinguish programmatic scrolls from user-initiated ones
    const programmaticScrollRef = useRef<boolean>(false);

    const isStreaming = streamingMessages.size > 0;
    const isSummaryView = viewMode === 'sliding';

    // Detect user scroll: if they scroll away from the bottom, stop auto-scrolling.
    // Re-enable auto-scroll when they scroll back near the bottom.
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const NEAR_BOTTOM_THRESHOLD = 80; // px from bottom to consider "at bottom"

        const handleScroll = () => {
            // Ignore scrolls triggered by our own performScroll
            if (programmaticScrollRef.current) return;

            const { scrollTop, scrollHeight, clientHeight } = container;
            const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
            userScrolledUpRef.current = distanceFromBottom > NEAR_BOTTOM_THRESHOLD;
        };

        container.addEventListener('scroll', handleScroll, { passive: true });
        return () => container.removeEventListener('scroll', handleScroll);
    }, []);

    // Compute bucketed streaming content length for scroll dependency
    // Changes every ~200 chars to trigger scroll without excessive updates
    const streamingContentBucket = useMemo(() => {
        let total = 0;
        streamingMessages.forEach((data) => {
            total += data.text?.length || 0;
        });
        return Math.floor(total / 200); // Bucket by 200 chars
    }, [streamingMessages]);

    // Throttled scroll function
    const performScroll = useCallback(() => {
        if (bottomRef.current) {
            programmaticScrollRef.current = true;
            bottomRef.current.scrollIntoView({ behavior: isStreaming ? 'instant' : 'smooth' });
            lastScrollTimeRef.current = Date.now();
            // Reset the programmatic flag after the browser processes the scroll
            requestAnimationFrame(() => {
                programmaticScrollRef.current = false;
            });
        }
        scrollScheduledRef.current = null;
    }, [bottomRef, isStreaming]);

    // Auto-scroll to bottom when messages or streaming messages change
    // Throttled to max 10 scrolls/sec to prevent layout thrashing
    // Skipped when the user has manually scrolled up to read earlier content
    useEffect(() => {
        void messages.length;
        void streamingMessages.size;
        void streamingContentBucket;
        // Respect user's scroll position — don't yank them back to the bottom
        if (userScrolledUpRef.current) return;

        const now = Date.now();
        const timeSinceLastScroll = now - lastScrollTimeRef.current;

        // If we haven't scrolled recently, scroll immediately
        if (timeSinceLastScroll >= SCROLL_THROTTLE_MS) {
            performScroll();
        } else if (scrollScheduledRef.current === null) {
            // Schedule a scroll for later if not already scheduled
            const delay = SCROLL_THROTTLE_MS - timeSinceLastScroll;
            scrollScheduledRef.current = window.setTimeout(performScroll, delay);
        }

        // Cleanup scheduled scroll on unmount or before next effect
        return () => {
            if (scrollScheduledRef.current !== null) {
                clearTimeout(scrollScheduledRef.current);
                scrollScheduledRef.current = null;
            }
        };
    }, [messages.length, streamingMessages.size, streamingContentBucket, performScroll]);

    // Sort all messages chronologically and dedupe adjacent identical messages
    // Low-signal messages are suppressed at the source (server-side) via shouldSuppressLowSignalMessage
    const sortedMessages = React.useMemo(() => {
        const filtered = hiddenMessageTypes?.length
            ? messages.filter((m) => !hiddenMessageTypes.includes(m.type))
            : messages;

        const sorted = [...filtered].sort((a, b) => {
            const timeA = typeof a.timestamp === 'number' ? a.timestamp : new Date(a.timestamp).getTime();
            const timeB = typeof b.timestamp === 'number' ? b.timestamp : new Date(b.timestamp).getTime();
            return timeA - timeB;
        });

        const deduped: AgentMessage[] = [];
        for (const msg of sorted) {
            const previous = deduped[deduped.length - 1];
            if (previous && shouldCollapseAdjacentRenderedMessage(previous, msg)) {
                continue;
            }

            if (previous && shouldDedupeAdjacentCompletedToolMessage(previous, msg)) {
                continue;
            }
            deduped.push(msg);
        }
        return deduped;
    }, [messages, hiddenMessageTypes]);

    // Get workstreams from messages - only from message.workstream_id
    const workstreams = React.useMemo(() => {
        // Just get the basic workstreams from the messages
        const extractedWorkstreams = extractWorkstreams(sortedMessages);

        // We'll keep taskLabels - they might be used for display purposes elsewhere
        // but we won't use them to create new workstream tabs

        return extractedWorkstreams;
    }, [sortedMessages]);

    // Count messages per workstream
    const workstreamCounts = React.useMemo(() => {
        const counts = new Map<string, number>();
        counts.set('all', sortedMessages.length);

        // Count main messages
        const mainMessages = filterMessagesByWorkstream(sortedMessages, 'main');
        counts.set('main', mainMessages.length);

        // Count other workstreams
        sortedMessages.forEach((msg) => {
            const workstreamId = getWorkstreamId(msg);
            if (workstreamId !== 'main') {
                counts.set(workstreamId, (counts.get(workstreamId) || 0) + 1);
            }
        });

        return counts;
    }, [sortedMessages]);

    // Filter messages based on active workstream
    const displayMessages = React.useMemo(() => {
        if (activeWorkstream === 'all') {
            return sortedMessages;
        }
        return filterMessagesByWorkstream(sortedMessages, activeWorkstream);
    }, [sortedMessages, activeWorkstream]);

    const fallbackWorkingStartedAtRef = useRef(Date.now());
    const hasInitialRequest =
        Boolean(prependFriendlyMessage?.trim()) ||
        hasInitialRequestValue(initialRequestData) ||
        initialRequestTemplate !== undefined;

    const latestDisplayMessageTimestamp = useMemo(() => {
        if (displayMessages.length === 0) return -Infinity;
        return Math.max(...displayMessages.map((msg) => getTimestampMs(msg.timestamp)));
    }, [displayMessages]);

    const latestNonTransientDisplayMessageTimestamp = useMemo(() => {
        const persistentMessages = displayMessages.filter((msg) => !isTransientThinkingMessage(msg));
        if (persistentMessages.length === 0) return -Infinity;
        return Math.max(...persistentMessages.map((msg) => getTimestampMs(msg.timestamp)));
    }, [displayMessages]);

    const isDisplayCompleted = useMemo(() => {
        if (hasOpenUserTurn(displayMessages)) return false;
        return isCompleted || !isInProgress(displayMessages);
    }, [displayMessages, isCompleted]);

    // Split streaming messages:
    // - complete (or stale incomplete) ones are interleaved chronologically
    // - actively incomplete ones render at the end
    // This keeps live streaming performant while preventing old incomplete streams
    // from being pinned forever at the bottom.
    const { completeStreaming, incompleteStreaming } = React.useMemo(() => {
        const complete = new Map<string, StreamingData>();
        const incomplete: Array<{ id: string; data: StreamingData }> = [];
        streamingMessages.forEach((data, id) => {
            // Filter by workstream if specified
            if (activeWorkstream && activeWorkstream !== 'all') {
                const streamWorkstream = data.workstreamId || 'main';
                if (activeWorkstream !== streamWorkstream) return;
            }

            // If a newer persisted message exists, this stream is stale and should be
            // treated as complete for ordering purposes.
            const isStale = data.startTimestamp <= latestNonTransientDisplayMessageTimestamp;
            if (isStale) {
                // Only interleave chronologically when a newer persisted message
                // already exists — the streaming message is truly historical.
                complete.set(id, data);
            } else if (data.text) {
                // Keep at the bottom (including isComplete streams) until
                // the persisted ANSWER/THOUGHT arrives and replaces it.
                incomplete.push({ id, data });
            }
        });

        return { completeStreaming: complete, incompleteStreaming: incomplete };
    }, [streamingMessages, activeWorkstream, latestNonTransientDisplayMessageTimestamp]);

    const summaryDisplayMessages = React.useMemo(
        () => buildSummaryDisplayMessages(displayMessages, completeStreaming),
        [displayMessages, completeStreaming],
    );

    const latestSummaryObservedTimestamp = useMemo(() => {
        const hasVisibleLiveStream = incompleteStreaming.some(({ data }) => data.text.trim().length > 0);
        if (hasVisibleLiveStream) return Number.POSITIVE_INFINITY;

        const latestStreamingTimestamp = incompleteStreaming.reduce(
            (latest, { data }) => Math.max(latest, data.startTimestamp),
            -Infinity,
        );
        return Math.max(latestDisplayMessageTimestamp, latestStreamingTimestamp);
    }, [incompleteStreaming, latestDisplayMessageTimestamp]);

    const summaryConversationItems = React.useMemo(
        () => buildSummaryConversationItems(summaryDisplayMessages, isDisplayCompleted, latestSummaryObservedTimestamp),
        [summaryDisplayMessages, isDisplayCompleted, latestSummaryObservedTimestamp],
    );

    // Group messages with ONLY complete streaming interleaved for stacked view
    // Incomplete streaming is rendered separately at the end (avoids re-grouping on every chunk)
    // Then attach preamble text from preceding reasoning messages to tool_groups
    const groupedMessages = React.useMemo(
        () =>
            attachPreambles(
                mergeConsecutiveToolGroups(
                    groupMessagesWithStreaming(displayMessages, completeStreaming, activeWorkstream),
                ),
            ),
        [displayMessages, completeStreaming, activeWorkstream],
    );

    // Show an activity indicator when the latest visible conversation state is not terminal.
    // Older idle/complete messages from previous turns must not suppress the new turn.
    const isAgentWorking = useMemo(() => {
        return !isDisplayCompleted;
    }, [isDisplayCompleted]);

    const showActivityFallback = shouldShowSummaryActivityFallback(
        summaryConversationItems,
        isAgentWorking,
        incompleteStreaming.length > 0,
    );
    const summaryActivityFallbackLabel = isInitialSummaryActivityFallback(summaryConversationItems)
        ? t('agent.preparing')
        : t('agent.working');
    const showInitialRequestWaitingCard =
        displayMessages.length === 0 && hasInitialRequest && isAgentWorking && incompleteStreaming.length === 0;
    const activityAnchorCandidate = useMemo(
        () =>
            getSummaryActivityAnchorTimestamp(
                summaryConversationItems,
                summaryDisplayMessages,
                fallbackWorkingStartedAtRef.current,
            ),
        [summaryConversationItems, summaryDisplayMessages],
    );
    const activityStartedTimestampRef = useRef<number | string>(activityAnchorCandidate);
    const wasActivityFallbackVisibleRef = useRef(false);

    if (showActivityFallback) {
        const candidateMs = getTimestampMs(activityAnchorCandidate);
        const currentMs = getTimestampMs(activityStartedTimestampRef.current);
        if (!wasActivityFallbackVisibleRef.current || candidateMs < currentMs) {
            activityStartedTimestampRef.current = activityAnchorCandidate;
        }
        wasActivityFallbackVisibleRef.current = true;
    } else {
        activityStartedTimestampRef.current = activityAnchorCandidate;
        wasActivityFallbackVisibleRef.current = false;
    }

    // Determine completion status for each workstream
    const workstreamCompletionStatus = useMemo(() => {
        const statusMap = new Map<string, boolean>();

        // Group messages by workstream
        const workstreamMessages = new Map<string, AgentMessage[]>();

        sortedMessages.forEach((message) => {
            const workstreamId = getWorkstreamId(message);
            if (!workstreamMessages.has(workstreamId)) {
                workstreamMessages.set(workstreamId, []);
            }
            workstreamMessages.get(workstreamId)?.push(message);
        });

        // Check if each workstream is completed
        for (const [workstreamId, msgs] of workstreamMessages.entries()) {
            if (msgs.length > 0) {
                const isCompleted = msgs.some((m) => {
                    if (
                        [
                            AgentMessageType.COMPLETE,
                            AgentMessageType.IDLE,
                            AgentMessageType.REQUEST_INPUT,
                            AgentMessageType.TERMINATED,
                        ].includes(m.type)
                    ) {
                        return true;
                    }
                    // Workstream completion is sent as UPDATE with workstream_event: 'completed' or status: 'completed'/'canceled'
                    if (m.type === AgentMessageType.UPDATE && m.details) {
                        const d = m.details as Record<string, unknown>;
                        return (
                            d.workstream_event === 'completed' || d.status === 'completed' || d.status === 'canceled'
                        );
                    }
                    return false;
                });
                statusMap.set(workstreamId, isCompleted);
            }
        }

        return statusMap;
    }, [sortedMessages]);

    return (
        <div
            ref={containerRef}
            // biome-ignore lint/a11y/noNoninteractiveTabindex: scrollable message log needs to accept keyboard focus for arrow-key navigation
            tabIndex={0}
            className="flex-1 min-h-0 h-full w-full max-w-full overflow-y-auto overflow-x-hidden px-1.5 sm:px-2.5 lg:px-3 flex flex-col relative focus:outline-none"
            data-testid="all-messages-mixed"
        >
            {/* Global styles for vprose markdown content */}
            <style>{`
                /* Better vertical rhythm for markdown */
                .vprose > * + * {
                    margin-top: 0.625rem;
                }
                .vprose > h1 + *,
                .vprose > h2 + *,
                .vprose > h3 + * {
                    margin-top: 0.375rem;
                }
                /* Tables need more separation and better styling */
                .vprose table {
                    margin-top: 0.875rem;
                    margin-bottom: 0.875rem;
                    border-collapse: collapse;
                    width: 100%;
                }
                .vprose th,
                .vprose td {
                    padding: 0.5rem 0.625rem;
                    border: 1px solid var(--gray-6, #e5e7eb);
                    text-align: left;
                }
                .vprose thead th {
                    background-color: var(--gray-3, #f3f4f6);
                    font-weight: 600;
                    color: var(--gray-11, #6b7280);
                    font-size: 0.75rem;
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                }
                .vprose tbody tr:hover {
                    background-color: var(--gray-2, #f9fafb);
                }
                /* Dark mode table styles */
                .dark .vprose th,
                .dark .vprose td {
                    border-color: var(--gray-7, #374151);
                }
                .dark .vprose thead th {
                    background-color: var(--gray-4, #1f2937);
                    color: var(--gray-11, #9ca3af);
                }
                .dark .vprose tbody tr:hover {
                    background-color: var(--gray-3, #111827);
                }
                /* Horizontal rules as section dividers */
                .vprose hr {
                    margin-top: 1rem;
                    margin-bottom: 1rem;
                    border-color: var(--gray-5, #d1d5db);
                }
                /* Better blockquote styling */
                .vprose blockquote {
                    margin-top: 0.875rem;
                    margin-bottom: 0.875rem;
                    padding-left: 1rem;
                    border-left-width: 3px;
                    border-left-color: var(--gray-6, #d1d5db);
                    color: var(--gray-11, #6b7280);
                }
                /* Code blocks */
                .vprose pre {
                    margin-top: 0.75rem;
                    margin-bottom: 0.75rem;
                    padding: 0.75rem;
                    border-radius: 0.5rem;
                    overflow-x: auto;
                    background-color: var(--color-muted-background, #f3f4f6);
                    color: var(--color-foreground, #1f2937);
                }
                .vprose pre code {
                    color: inherit;
                }
                .dark .vprose pre {
                    color: var(--color-foreground, #f9fafb);
                }

                /* Summary chat markdown: keep structure, but match the app's quieter conversation surface. */
                .agent-markdown {
                    color: color-mix(in oklch, var(--foreground) 78%, transparent);
                    font-size: 0.875rem;
                    line-height: 1.625;
                    overflow-x: auto;
                }
                .agent-markdown > * + * {
                    margin-top: 0.65rem;
                }
                .agent-markdown p {
                    margin-top: 0.5rem;
                    margin-bottom: 0.5rem;
                }
                .agent-markdown h1,
                .agent-markdown h2,
                .agent-markdown h3,
                .agent-markdown h4 {
                    margin-top: 1.2rem;
                    margin-bottom: 0.45rem;
                    color: var(--foreground);
                    font-weight: 650;
                    letter-spacing: 0;
                    line-height: 1.3;
                }
                .agent-markdown h1 {
                    font-size: 1.2rem;
                }
                .agent-markdown h2 {
                    font-size: 1.05rem;
                }
                .agent-markdown h3,
                .agent-markdown h4 {
                    font-size: 0.95rem;
                }
                .agent-markdown h1:first-child,
                .agent-markdown h2:first-child,
                .agent-markdown h3:first-child,
                .agent-markdown h4:first-child {
                    margin-top: 0;
                }
                .agent-markdown hr {
                    margin: 1.15rem 0;
                    border: 0;
                    border-top: 1px solid var(--border);
                    opacity: 0.65;
                }
                .agent-markdown ul,
                .agent-markdown ol {
                    margin-top: 0.55rem;
                    margin-bottom: 0.55rem;
                    padding-left: 1.25rem;
                }
                .agent-markdown li {
                    margin-top: 0.2rem;
                    margin-bottom: 0.2rem;
                    padding-left: 0.1rem;
                    color: inherit;
                }
                .agent-markdown li::marker {
                    color: var(--muted);
                }
                .agent-markdown strong {
                    color: var(--foreground);
                    font-weight: 600;
                }
                .agent-markdown em {
                    color: color-mix(in oklch, var(--foreground) 72%, transparent);
                }
                .agent-markdown a {
                    color: var(--foreground);
                    text-decoration-color: var(--muted);
                    text-underline-offset: 3px;
                }
                .agent-markdown blockquote {
                    margin-top: 0.85rem;
                    margin-bottom: 0.85rem;
                    padding-left: 0.875rem;
                    border-left: 2px solid var(--border);
                    color: var(--muted);
                    font-style: normal;
                }
                .agent-markdown :not(pre) > code {
                    border: 1px solid var(--border);
                    border-radius: 0.375rem;
                    background: var(--muted-background);
                    color: var(--foreground);
                    padding: 0.1rem 0.35rem;
                    font-size: 0.8125em;
                    font-weight: 500;
                }
                .agent-markdown pre {
                    margin-top: 0.85rem;
                    margin-bottom: 0.85rem;
                    max-height: 32rem;
                    overflow: auto;
                    border: 1px solid var(--border);
                    border-radius: 0.75rem;
                    background: var(--muted-background);
                    color: var(--foreground);
                    padding: 0.875rem;
                    font-size: 0.8125rem;
                    line-height: 1.55;
                }
                .agent-markdown pre code {
                    border: 0;
                    background: transparent;
                    color: inherit;
                    padding: 0;
                    font-size: inherit;
                }
                .agent-markdown table {
                    display: table;
                    width: 100%;
                    max-width: 100%;
                    margin: 0.9rem 0 1rem;
                    border: 1px solid var(--border);
                    border-radius: 0.75rem;
                    border-collapse: separate;
                    border-spacing: 0;
                    font-size: 0.8125rem;
                    table-layout: auto;
                }
                .agent-markdown thead {
                    background: var(--muted-background);
                }
                .agent-markdown th,
                .agent-markdown td {
                    border: 0;
                    border-bottom: 1px solid var(--border);
                    padding: 0.55rem 0.7rem;
                    text-align: left;
                    vertical-align: top;
                    overflow-wrap: break-word;
                    word-break: normal;
                }
                .agent-markdown th {
                    color: var(--muted);
                    font-size: 0.6875rem;
                    font-weight: 600;
                    letter-spacing: 0;
                    text-transform: none;
                    white-space: nowrap;
                }
                .agent-markdown td {
                    color: inherit;
                }
                .agent-markdown th:first-child,
                .agent-markdown td:first-child {
                    min-width: 8.5rem;
                    width: 1%;
                    white-space: nowrap;
                }
                .agent-markdown th + th,
                .agent-markdown td + td {
                    border-left: 1px solid var(--border);
                }
                .agent-markdown tr:last-child td {
                    border-bottom: 0;
                }
                .agent-markdown tbody tr:nth-child(even) {
                    background: color-mix(in oklch, var(--muted-background) 55%, transparent);
                }
                .agent-markdown tbody tr:hover {
                    background: var(--muted-background);
                }
            `}</style>

            {/* Workstream tabs are a debug affordance; Summary keeps the conversation surface quiet. */}
            {viewMode === 'stacked' && (
                <div className={cn('sticky top-0 z-10', hideWorkstreamTabs && 'hidden')}>
                    <WorkstreamTabs
                        workstreams={workstreams}
                        activeWorkstream={activeWorkstream}
                        onSelectWorkstream={setActiveWorkstream}
                        count={workstreamCounts}
                        completionStatus={workstreamCompletionStatus}
                    />
                </div>
            )}

            {displayMessages.length === 0 && !hasInitialRequest && !(isSummaryView && showActivityFallback) ? (
                activeWorkstream === 'all' && isAgentWorking && incompleteStreaming.length === 0 ? (
                    <div className="flex-1 px-2 py-6 sm:px-4">
                        <InitialRequestWaitingCard
                            label={t('agent.preparing')}
                            timestamp={fallbackWorkingStartedAtRef.current}
                            className={workingIndicatorClassName}
                        />
                    </div>
                ) : (
                    <div className="flex items-center justify-center h-full text-center py-8">
                        <div className="flex items-center px-3 py-2 text-sm text-muted">
                            {activeWorkstream === 'all'
                                ? t('agent.waitingForAgentResponse')
                                : t('agent.noMessagesInWorkstream')}
                        </div>
                    </div>
                )
            ) : (
                <div
                    className={cn(
                        'flex-1 flex flex-col justify-start w-full max-w-full',
                        isSummaryView ? 'gap-6 px-2 py-6 sm:px-4' : 'gap-3 pb-4',
                        messageListClassName,
                    )}
                >
                    {/* Friendly message — rendered outside the messages array to avoid memo issues/triggering autoscroll */}
                    {hasInitialRequest && (
                        <InitialRequestMessage
                            key="initial-request"
                            data={initialRequestData}
                            schema={initialRequestSchema}
                            title={initialRequestTitle}
                            template={initialRequestTemplate}
                            prependFriendlyMessage={prependFriendlyMessage}
                            timestamp={displayMessages[0]?.timestamp ?? Date.now()}
                            isSummaryView={isSummaryView}
                            messageItemClassNames={messageItemClassNames}
                            messageStyleOverrides={messageStyleOverrides}
                            StoreLinkComponent={StoreLinkComponent}
                            CollectionLinkComponent={CollectionLinkComponent}
                        />
                    )}
                    {showInitialRequestWaitingCard && (
                        <InitialRequestWaitingCard
                            label={summaryActivityFallbackLabel}
                            timestamp={activityStartedTimestampRef.current}
                            className={workingIndicatorClassName}
                        />
                    )}
                    {/* Show either all messages or just sliding view depending on viewMode */}
                    {viewMode === 'stacked' ? (
                        // Details view - show ALL messages with streaming interleaved
                        <>
                            {groupedMessages.map((group, groupIndex) => {
                                const isLastGroup = groupIndex === groupedMessages.length - 1;

                                if (group.type === 'tool_group') {
                                    // Render grouped tool calls
                                    const lastMessage = group.messages[group.messages.length - 1];
                                    const isTerminalToolStatus =
                                        group.toolStatus === 'completed' ||
                                        group.toolStatus === 'error' ||
                                        group.toolStatus === 'warning';
                                    const isLatest =
                                        !isCompleted &&
                                        isLastGroup &&
                                        !DONE_STATES.includes(lastMessage.type) &&
                                        !isTerminalToolStatus;

                                    if (hideToolCallsInViewMode?.includes(viewMode)) return null;
                                    return (
                                        <TimelineEntry
                                            key={`group-${group.toolRunId || group.firstTimestamp}-${groupIndex}`}
                                            status={group.toolStatus}
                                        >
                                            <MessageErrorBoundary>
                                                <ToolCallGroup
                                                    {...toolCallGroupClassNames}
                                                    messages={group.messages}
                                                    showPulsatingCircle={isLatest}
                                                    toolRunId={group.toolRunId}
                                                    toolStatus={group.toolStatus}
                                                    preambleText={group.preambleText}
                                                    preambleMessage={group.preambleMessage}
                                                    rootClassName={cn(
                                                        'rounded-lg border border-border bg-background/60 shadow-none',
                                                        toolCallGroupClassNames?.rootClassName,
                                                    )}
                                                    headerClassName={cn(
                                                        'px-3 py-2',
                                                        toolCallGroupClassNames?.headerClassName,
                                                    )}
                                                    itemHeaderClassName={cn(
                                                        'hover:bg-mixer-muted/20',
                                                        toolCallGroupClassNames?.itemHeaderClassName,
                                                    )}
                                                />
                                            </MessageErrorBoundary>
                                        </TimelineEntry>
                                    );
                                } else if (group.type === 'streaming') {
                                    // Render streaming message - no error boundary to avoid interrupting streaming
                                    return (
                                        <TimelineEntry key={`streaming-${group.streamingId}-${groupIndex}`}>
                                            <StreamingMessage
                                                {...streamingMessageClassNames}
                                                text={group.text}
                                                workstreamId={group.workstreamId}
                                                isComplete={group.isComplete}
                                                timestamp={group.startTimestamp}
                                                artifactRunId={artifactRunId}
                                                cardClassName={cn(
                                                    'rounded-lg border border-border bg-background/60 shadow-none',
                                                    streamingMessageClassNames?.cardClassName,
                                                )}
                                            />
                                        </TimelineEntry>
                                    );
                                } else {
                                    // Render single message
                                    const message = group.message;
                                    const isLatestMessage =
                                        !isCompleted && isLastGroup && !DONE_STATES.includes(message.type);

                                    // Special handling for batch progress messages
                                    if (isBatchProgressMessage(message)) {
                                        return (
                                            <MessageErrorBoundary
                                                key={`batch-${message.details.batch_id}-${message.timestamp}-${groupIndex}`}
                                            >
                                                <BatchProgressPanel
                                                    message={message}
                                                    batchData={message.details}
                                                    isRunning={!message.details.completed_at}
                                                    {...batchProgressPanelClassNames}
                                                />
                                            </MessageErrorBoundary>
                                        );
                                    }

                                    return (
                                        <TimelineEntry key={`${message.timestamp}-${groupIndex}`} status="message">
                                            <MessageErrorBoundary>
                                                <MessageItem
                                                    {...messageItemClassNames}
                                                    message={message}
                                                    showPulsatingCircle={isLatestMessage}
                                                    onSendMessage={onSendMessage}
                                                    cardClassName={cn(
                                                        'rounded-lg border border-border bg-background/60 shadow-none',
                                                        messageItemClassNames?.cardClassName,
                                                    )}
                                                    headerClassName={cn(
                                                        'px-3 py-2',
                                                        messageItemClassNames?.headerClassName,
                                                    )}
                                                    contentClassName={cn(
                                                        'bg-transparent',
                                                        messageItemClassNames?.contentClassName,
                                                    )}
                                                    messageStyleOverrides={messageStyleOverrides}
                                                    StoreLinkComponent={StoreLinkComponent}
                                                    CollectionLinkComponent={CollectionLinkComponent}
                                                />
                                            </MessageErrorBoundary>
                                        </TimelineEntry>
                                    );
                                }
                            })}
                            {/* Incomplete streaming - no error boundary to avoid interrupting streaming */}
                            {incompleteStreaming.map(({ id, data }) => (
                                <TimelineEntry key={`streaming-incomplete-${id}`}>
                                    <StreamingMessage
                                        {...streamingMessageClassNames}
                                        text={data.text}
                                        workstreamId={data.workstreamId}
                                        isComplete={data.isComplete}
                                        timestamp={data.startTimestamp}
                                        artifactRunId={artifactRunId}
                                        cardClassName={cn(
                                            'rounded-lg border border-border bg-background/60 shadow-none',
                                            streamingMessageClassNames?.cardClassName,
                                        )}
                                    />
                                </TimelineEntry>
                            ))}
                            {/* Working indicator - shows agent is actively processing */}
                            {isAgentWorking && incompleteStreaming.length === 0 && !showInitialRequestWaitingCard && (
                                <TimelineEntry>
                                    <div
                                        className={cn(
                                            'flex items-center gap-2 py-2 text-sm text-muted',
                                            workingIndicatorClassName,
                                        )}
                                    >
                                        <PulsatingCircle size="sm" color="blue" />
                                        <span>{t('agent.working')}</span>
                                    </div>
                                </TimelineEntry>
                            )}
                        </>
                    ) : (
                        // Summary view - conversation turns with per-turn work disclosure
                        <>
                            {summaryConversationItems.map((item, itemIndex) => {
                                if (item.type === 'work') {
                                    if (hideToolCallsInViewMode?.includes(viewMode)) return null;
                                    const isThinkingOnlyWork = isTransientThinkingWork(item.messages);

                                    return (
                                        <SummaryActivityRow
                                            key={`work-${item.id}-${item.isActive ? 'active' : 'done'}-${itemIndex}`}
                                            label={getSummaryActivityLabel(item.status, item.isActive)}
                                            status={item.status}
                                            timestamp={item.startTimestamp}
                                            durationSeconds={
                                                item.isActive
                                                    ? undefined
                                                    : getDurationSeconds(item.startTimestamp, item.endTimestamp)
                                            }
                                            showElapsed
                                            details={isThinkingOnlyWork ? undefined : item.messages}
                                            defaultExpanded={item.isActive && !isThinkingOnlyWork}
                                            className={workingIndicatorClassName}
                                        />
                                    );
                                }

                                const message = item.message;
                                if (isBatchProgressMessage(message)) {
                                    return (
                                        <MessageErrorBoundary
                                            key={`batch-${message.details.batch_id}-${message.timestamp}-${itemIndex}`}
                                        >
                                            <BatchProgressPanel
                                                message={message}
                                                batchData={message.details}
                                                isRunning={!message.details.completed_at}
                                                {...batchProgressPanelClassNames}
                                            />
                                        </MessageErrorBoundary>
                                    );
                                }

                                return (
                                    <MessageErrorBoundary key={`${message.timestamp}-${itemIndex}`}>
                                        <SummaryMessage
                                            message={message}
                                            onSendMessage={onSendMessage}
                                            StoreLinkComponent={StoreLinkComponent}
                                            CollectionLinkComponent={CollectionLinkComponent}
                                        />
                                    </MessageErrorBoundary>
                                );
                            })}
                            {/* Incomplete streaming - no error boundary to avoid interrupting streaming */}
                            {incompleteStreaming.map(({ id, data }) => (
                                <SummaryStreamingMessage
                                    key={`streaming-incomplete-${id}`}
                                    text={data.text}
                                    workstreamId={data.workstreamId}
                                    artifactRunId={artifactRunId}
                                />
                            ))}
                            {/* Activity fallback - shown before any tool/thought message has arrived */}
                            {showActivityFallback && !showInitialRequestWaitingCard && (
                                <SummaryActivityRow
                                    label={summaryActivityFallbackLabel}
                                    status="running"
                                    timestamp={activityStartedTimestampRef.current}
                                    showElapsed
                                    className={workingIndicatorClassName}
                                />
                            )}
                        </>
                    )}
                    <div ref={bottomRef} className="h-2" />
                </div>
            )}
        </div>
    );
}

const shouldDedupeAdjacentCompletedToolMessage = (previous: AgentMessage, current: AgentMessage): boolean => {
    if (previous.type !== current.type) return false;
    if (previous.message !== current.message) return false;

    const prevDetails = previous.details as { tool_status?: string } | undefined;
    const currDetails = current.details as { tool_status?: string } | undefined;
    if (prevDetails?.tool_status !== 'completed' || currDetails?.tool_status !== 'completed') return false;

    const prevTs = typeof previous.timestamp === 'number' ? previous.timestamp : new Date(previous.timestamp).getTime();
    const currTs = typeof current.timestamp === 'number' ? current.timestamp : new Date(current.timestamp).getTime();
    return currTs - prevTs < 2000;
};

const AllMessagesMixed = React.memo(AllMessagesMixedComponent);

export default AllMessagesMixed;
