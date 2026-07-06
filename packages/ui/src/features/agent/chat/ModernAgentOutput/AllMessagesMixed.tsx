import {
    type AgentMessage,
    AgentMessageType,
    type AskUserMessageDetails,
    type BatchProgressDetails,
    type JSONSchema,
    type Plan,
} from '@vertesia/common';
import { Badge, Button, cn, VTooltip } from '@vertesia/ui/core';
import { i18nInstance, NAMESPACE, useUITranslation } from '@vertesia/ui/i18n';
import { NavLink } from '@vertesia/ui/router';
import { MarkdownRenderer, type MarkdownRendererProps } from '@vertesia/ui/widgets';
import type { Element } from 'hast';
import {
    AlertTriangle,
    ArrowLeft,
    Bot,
    Brain,
    CheckCircle,
    ChevronDown,
    ChevronRight,
    CopyIcon,
    FileText,
    Pencil,
    Search,
    Terminal,
    Wrench,
} from 'lucide-react';
import React, { Component, type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatedThinkingDots, PulsatingCircle } from '../AnimatedThinkingDots';
import { AskUserWidget } from '../AskUserWidget';
import { ThinkingMessages } from '../WaitingMessages';
import {
    formatWorkstreamName,
    getWorkstreamActivityDetails,
    getWorkstreamDisplayName,
    getWorkstreamLaunchDetails,
    type WorkstreamLaunchDetails,
} from '../workstreams.js';
import { AttachmentPreviewList, parseUserMessageAttachments } from './AttachmentPreview';
import BatchProgressPanel, { type BatchProgressPanelClassNames } from './BatchProgressPanel';
import { getMessageDeliveryStatus, MessageDeliveryStatus } from './MessageDeliveryStatus';
import MessageItem, { type MessageItemClassNames, type MessageItemProps } from './MessageItem';
import {
    getAnsweredRequestInputKeys,
    getAnsweredToolApprovalRequestInputKeys,
    getHiddenToolApprovalAnswerKeys,
    getPendingRequestInputMessage,
    getRequestInputDisplayText,
    getRequestInputMessageKey,
    getResolvedToolApprovalKeys,
    hasRequestInputUx,
    isRequestInputAnswered,
    isToolApprovalAnswerHidden,
    isToolApprovalRequestInput,
    isToolApprovalRequestInputHidden,
    type RequestInputMessageWithUx,
} from './requestInputMessages';
import StreamingMessage, { type StreamingMessageClassNames } from './StreamingMessage';
import {
    buildSummaryConversationItems,
    buildSummaryDisplayMessages,
    getSummaryActivityAnchorTimestamp,
    isInitialSummaryActivityFallback,
    isTransientThinkingMessage,
    isTransientWorkStatusMessage,
    shouldShowSummaryActivityFallback,
} from './SummaryConversation';
import ToolCallGroup, { type ToolCallGroupClassNames } from './ToolCallGroup';
import {
    DONE_STATES,
    filterMessagesForActiveWorkstream,
    getWorkstreamId,
    groupMessagesWithStreaming,
    isInProgress,
    isToolPreambleMessage,
    isUserStoppedMessage,
    mergeConsecutiveToolGroups,
    type RenderableGroup,
    type StreamingData,
    shouldCollapseAdjacentRenderedMessage,
    type ToolExecutionStatus,
} from './utils';
import WorkstreamTabs, { extractWorkstreams, filterMessagesByWorkstream } from './WorkstreamTabs';

export type AgentConversationViewMode = 'stacked' | 'sliding';

export interface AgentInitialRequestTemplateContext {
    data: unknown;
    schema?: JSONSchema | null;
    title?: string;
}

export type AgentInitialRequestTemplate = (context: AgentInitialRequestTemplateContext) => React.ReactNode;

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

function parseTimestampMs(timestamp: number | string | undefined): number | undefined {
    if (timestamp === undefined || timestamp === null || timestamp === '') return undefined;
    const value = typeof timestamp === 'number' ? timestamp : new Date(timestamp).getTime();
    return Number.isFinite(value) ? value : undefined;
}

function formatToolDetailTimestamp(timestamp: number | string | undefined): string | undefined {
    const value = parseTimestampMs(timestamp);
    if (value === undefined) return undefined;

    return new Intl.DateTimeFormat(undefined, {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
    }).format(new Date(value));
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

function getSummaryWorkLabel(isActive: boolean): string {
    return isActive ? 'Working' : 'Worked';
}

function isTransientThinkingWork(messages: AgentMessage[]): boolean {
    return messages.length > 0 && messages.every(isTransientWorkStatusMessage);
}

function getSummaryActivityLabel(isActive: boolean): string {
    return getSummaryWorkLabel(isActive);
}

function hasOpenUserTurn(messages: AgentMessage[]): boolean {
    const mainMessages = messages.filter((message) => getWorkstreamId(message) === 'main');
    const latestMessage = mainMessages[mainMessages.length - 1] ?? messages[messages.length - 1];
    return latestMessage?.type === AgentMessageType.QUESTION;
}

function hasLatestToolApprovalAllowTurn(messages: AgentMessage[], hiddenToolApprovalAnswerKeys: Set<string>): boolean {
    const mainMessages = messages.filter((message) => getWorkstreamId(message) === 'main');
    const latestMessage = mainMessages[mainMessages.length - 1] ?? messages[messages.length - 1];
    if (!latestMessage || !isToolApprovalAnswerHidden(latestMessage, hiddenToolApprovalAnswerKeys)) return false;

    const response = getToolApprovalResponse(latestMessage);
    return response === 'allow_once' || response === 'allow_for_run';
}

function getWriteArtifactCompletionPath(message: AgentMessage): string | undefined {
    if (message.type !== AgentMessageType.UPDATE) return undefined;
    const details = getDetailsRecord(message);
    if (details.tool !== undefined || details.activity_group_id !== undefined) return undefined;
    const path = typeof details.path === 'string' && details.path.trim() ? details.path.trim() : undefined;
    if (!path) return undefined;

    return getMessageText(message) === `Prepared and saved artifact to ${path}` ? path : undefined;
}

function findPreviousWriteArtifactToolMessage(messages: AgentMessage[], index: number): AgentMessage | undefined {
    const workstreamId = getWorkstreamId(messages[index]);

    for (let prevIndex = index - 1; prevIndex >= 0; prevIndex -= 1) {
        const previous = messages[prevIndex];
        if (getWorkstreamId(previous) !== workstreamId) continue;

        const details = getDetailsRecord(previous);
        if (details.tool === 'write_artifact' && typeof details.activity_group_id === 'string') return previous;

        if (previous.type === AgentMessageType.REQUEST_INPUT) continue;
        if (getToolApprovalResponse(previous)) continue;
        if (details.display_role === 'thinking') continue;

        if (typeof details.tool === 'string' && details.tool !== 'write_artifact') return undefined;
        if (
            previous.type === AgentMessageType.ANSWER ||
            previous.type === AgentMessageType.COMPLETE ||
            previous.type === AgentMessageType.IDLE ||
            previous.type === AgentMessageType.TERMINATED
        ) {
            return undefined;
        }
    }

    return undefined;
}

function attachWriteArtifactCompletionMessages(messages: AgentMessage[]): AgentMessage[] {
    return messages.map((message, index) => {
        const path = getWriteArtifactCompletionPath(message);
        if (!path) return message;

        const previousToolMessage = findPreviousWriteArtifactToolMessage(messages, index);
        const previousDetails = previousToolMessage ? getDetailsRecord(previousToolMessage) : undefined;
        if (!previousDetails) return message;

        const activityGroupId =
            typeof previousDetails.activity_group_id === 'string' ? previousDetails.activity_group_id : undefined;
        const toolRunId = typeof previousDetails.tool_run_id === 'string' ? previousDetails.tool_run_id : undefined;
        const toolUseId = typeof previousDetails.tool_use_id === 'string' ? previousDetails.tool_use_id : undefined;
        const toolIteration =
            typeof previousDetails.tool_iteration === 'number' ? previousDetails.tool_iteration : undefined;

        if (!activityGroupId) return message;

        return {
            ...message,
            details: {
                ...message.details,
                event_class: 'activity',
                tool: 'write_artifact',
                tool_run_id: toolRunId ?? 'write_artifact',
                tool_use_id: toolUseId ?? toolRunId ?? 'write_artifact',
                tool_iteration: toolIteration,
                tool_status: 'completed',
                tool_event: 'progress',
                activity_group_id: activityGroupId,
                output: getMessageText(message),
                path,
            },
        };
    });
}

function getMessageText(message: AgentMessage): string {
    if (!message.message) return '';
    if (typeof message.message === 'object') return JSON.stringify(message.message, null, 2);
    return String(message.message).trim();
}

interface SummaryMessageProps {
    message: AgentMessage;
    onSendMessage?: (message: string, metadata?: Record<string, unknown>) => void;
    onSelectWorkstream?: (workstreamId: string) => void;
    requestInputAnswered?: boolean;
    StoreLinkComponent?: React.ComponentType<{ href: string; documentId: string; children: React.ReactNode }>;
    CollectionLinkComponent?: React.ComponentType<{ href: string; collectionId: string; children: React.ReactNode }>;
}

function SummaryWorkstreamLaunchMessage({
    message,
    details,
    onSelectWorkstream,
}: {
    message: AgentMessage;
    details: WorkstreamLaunchDetails;
    onSelectWorkstream?: (workstreamId: string) => void;
}) {
    const { t } = useUITranslation();
    const workstreamName = getWorkstreamDisplayName(details.workstreamId, details.interaction);
    const interactionName = details.interaction ? formatWorkstreamName(details.interaction) : '';
    const secondaryName = interactionName && interactionName !== workstreamName ? interactionName : undefined;

    return (
        <div className="mx-auto w-full max-w-3xl px-1" data-workstream-id={details.workstreamId}>
            <button
                type="button"
                className={cn(
                    'group flex w-full items-start gap-3 border-b border-border/70 py-2 text-start text-sm text-muted',
                    'transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2',
                    'focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                )}
                onClick={() => onSelectWorkstream?.(details.workstreamId)}
            >
                <Bot className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="font-medium text-muted">{t('agent.workstreams')}</span>
                        <span className="min-w-0 truncate text-foreground/85">{workstreamName}</span>
                    </div>
                    {secondaryName && <div className="mt-0.5 truncate text-xs text-muted/75">{secondaryName}</div>}
                    <span className="sr-only">{getMessageText(message)}</span>
                </div>
                {/* rtl-ok: chevron points and nudges toward inline-end in both directions. */}
                <ChevronRight className="mt-0.5 size-4 shrink-0 text-muted transition-transform group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5" />
            </button>
        </div>
    );
}

const SUMMARY_PROSE_CLASS = [
    'agent-markdown vprose prose max-w-none break-words text-sm leading-6 text-foreground/80',
    'prose-p:my-2 prose-p:leading-6 prose-li:my-0.5 prose-pre:my-3 prose-headings:tracking-normal',
    'prose-headings:text-foreground prose-strong:text-foreground prose-code:text-foreground',
    'prose-a:text-foreground prose-a:underline prose-a:decoration-muted prose-a:underline-offset-4',
    '[&_p]:text-foreground/80 [&_li]:text-foreground/80 [&_li::marker]:text-muted',
].join(' ');

const USER_BUBBLE_COLLAPSE_THRESHOLD = 520;
const SUMMARY_THOUGHT_COLLAPSE_LINES = 6;
const SUMMARY_THOUGHT_COLLAPSE_THRESHOLD = 520;
const STORE_LINK_MARKDOWN_RE =
    /\[[^\]]+\]\((?:\/store\/(?:objects|collections)\/|store:|document:|document:\/\/|collection:)[^)]+\)/;
const DEFAULT_AGENT_MARKDOWN_COMPONENTS: MarkdownRendererProps['components'] = {
    table: AgentMarkdownTable,
};

type HastTextNode = {
    value?: unknown;
    children?: unknown[];
};

function getHastText(node: unknown): string {
    if (!node || typeof node !== 'object') return '';
    const typedNode = node as HastTextNode;
    if (typeof typedNode.value === 'string') return typedNode.value;
    if (!Array.isArray(typedNode.children)) return '';
    return typedNode.children.map(getHastText).join('');
}

function getElementChildren(node: unknown, tagName?: string): Element[] {
    if (!node || typeof node !== 'object') return [];
    const children = (node as { children?: unknown[] }).children;
    if (!Array.isArray(children)) return [];
    return children.filter((child): child is Element => {
        if (!child || typeof child !== 'object') return false;
        const childElement = child as Element;
        return tagName ? childElement.tagName === tagName : typeof childElement.tagName === 'string';
    });
}

function getTableRows(node?: Element): string[][] {
    const sections = getElementChildren(node).filter((child) => child.tagName === 'thead' || child.tagName === 'tbody');
    return sections.flatMap((section) =>
        getElementChildren(section, 'tr').map((row) =>
            getElementChildren(row)
                .filter((cell) => cell.tagName === 'th' || cell.tagName === 'td')
                .map((cell) => getHastText(cell).replace(/\s+/g, ' ').trim()),
        ),
    );
}

function getTableBodyRows(node?: Element): string[][] {
    return getElementChildren(node, 'tbody').flatMap((section) =>
        getElementChildren(section, 'tr').map((row) =>
            getElementChildren(row, 'td').map((cell) => getHastText(cell).replace(/\s+/g, ' ').trim()),
        ),
    );
}

function getCompactTableColumns(node?: Element): Set<number> {
    const rows = getTableRows(node);
    const bodyRows = getTableBodyRows(node);
    const columnCount = Math.max(0, ...rows.map((row) => row.length));
    if (columnCount <= 1) return new Set();

    const compactColumns = new Set<number>();
    for (let columnIndex = 0; columnIndex < columnCount; columnIndex += 1) {
        const bodyValues = bodyRows
            .map((row) => row[columnIndex] || '')
            .map((value) => value.trim())
            .filter(Boolean);
        if (bodyValues.length === 0) continue;

        const lengths = bodyValues.map((value) => value.length);
        const maxLength = Math.max(...lengths);
        const avgLength = lengths.reduce((sum, length) => sum + length, 0) / lengths.length;
        const hasLongToken = bodyValues.some((value) => /\S{12,}/.test(value));

        if (maxLength <= 16 && avgLength <= 10 && !hasLongToken) {
            compactColumns.add(columnIndex);
        }
    }

    if (compactColumns.size >= columnCount) {
        return new Set();
    }

    return compactColumns;
}

function clampNumber(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
}

function getLongestTokenLength(values: string[]): number {
    return values.reduce((longest, value) => {
        const tokens = value.match(/\S+/g) || [];
        return Math.max(longest, ...tokens.map((token) => token.length));
    }, 0);
}

interface AgentMarkdownTableColumnLayout {
    key: string;
    compact: boolean;
    width: string;
}

function getTableColumnLayouts(node?: Element): AgentMarkdownTableColumnLayout[] {
    const rows = getTableRows(node);
    const columnCount = Math.max(0, ...rows.map((row) => row.length));
    if (columnCount <= 1) return [];

    const compactColumns = getCompactTableColumns(node);
    const weights = Array.from({ length: columnCount }, (_value, columnIndex) => {
        if (compactColumns.has(columnIndex)) {
            return 8;
        }

        const values = rows
            .map((row) => row[columnIndex] || '')
            .map((value) => value.trim())
            .filter(Boolean);
        if (values.length === 0) return 18;

        const lengths = values.map((value) => value.length);
        const maxLength = Math.max(...lengths);
        const avgLength = lengths.reduce((sum, length) => sum + length, 0) / lengths.length;
        const longestTokenLength = getLongestTokenLength(values);

        return clampNumber(avgLength * 0.7 + maxLength * 0.25 + longestTokenLength * 0.45, 18, 90);
    });

    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
    if (totalWeight <= 0) return [];

    return weights.map((weight, columnIndex) => {
        const width = `${((weight / totalWeight) * 100).toFixed(3)}%`;
        return {
            key: `agent-markdown-table-column-${columnIndex}`,
            compact: compactColumns.has(columnIndex),
            width,
        };
    });
}

function AgentMarkdownTable({
    node,
    className,
    children,
    ...props
}: React.TableHTMLAttributes<HTMLTableElement> & {
    node?: Element;
    children?: React.ReactNode;
}) {
    const columnLayouts = getTableColumnLayouts(node);

    return (
        <table {...props} className={className}>
            {columnLayouts.length > 0 ? (
                <colgroup>
                    {columnLayouts.map((columnLayout) => (
                        <col
                            key={columnLayout.key}
                            className={columnLayout.compact ? 'agent-markdown-table-compact-col' : undefined}
                            style={
                                {
                                    '--agent-markdown-table-column-width': columnLayout.width,
                                } as React.CSSProperties
                            }
                        />
                    ))}
                </colgroup>
            ) : null}
            {children}
        </table>
    );
}

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
    message,
    workstreamId,
    className,
    artifactRunId,
    markdownComponents,
}: {
    children: React.ReactNode;
    message?: AgentMessage;
    workstreamId?: string;
    className?: string;
    artifactRunId?: string;
    markdownComponents?: MarkdownRendererProps['components'];
}) {
    const { t } = useUITranslation();
    const [isExpanded, setIsExpanded] = useState(false);
    const contentLength = useMemo(() => getReactNodeTextLength(children), [children]);
    const shouldCollapse = contentLength > USER_BUBBLE_COLLAPSE_THRESHOLD;
    const isPlainText = typeof children === 'string' || typeof children === 'number';
    const textContent = isPlainText ? String(children) : '';
    const shouldRenderMarkdown = typeof children === 'string' && STORE_LINK_MARKDOWN_RE.test(children);
    const deliveryStatus = message ? getMessageDeliveryStatus(message) : undefined;

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
                        isPlainText && !shouldRenderMarkdown && 'whitespace-pre-wrap',
                        shouldCollapse &&
                            !isExpanded &&
                            'max-h-72 overflow-hidden [mask-image:linear-gradient(to_bottom,black_76%,transparent_100%)]',
                    )}
                >
                    {shouldRenderMarkdown ? (
                        <MarkdownRenderer
                            artifactRunId={artifactRunId}
                            components={markdownComponents}
                            className={cn(
                                'agent-markdown vprose prose max-w-none break-words text-sm leading-6 text-foreground/90',
                                'prose-p:my-0 prose-p:leading-6 prose-a:text-foreground prose-a:underline prose-a:decoration-muted prose-a:underline-offset-4',
                                '[&_p+_p]:mt-2',
                            )}
                        >
                            {textContent}
                        </MarkdownRenderer>
                    ) : (
                        children
                    )}
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
                {message && deliveryStatus ? (
                    <div className="mt-1.5 flex justify-end">
                        <MessageDeliveryStatus message={message} className="h-4 w-4" />
                    </div>
                ) : null}
            </div>
        </div>
    );
}

function SummaryMessage({
    message,
    onSendMessage,
    onSelectWorkstream,
    requestInputAnswered = false,
    StoreLinkComponent,
    CollectionLinkComponent,
}: SummaryMessageProps) {
    const content =
        message.type === AgentMessageType.REQUEST_INPUT ? getRequestInputDisplayText(message) : getMessageText(message);
    const workstreamLaunchDetails = getWorkstreamLaunchDetails(message) ?? getWorkstreamActivityDetails(message);
    const workstreamId = getWorkstreamId(message);
    const runId = (message as { workflow_run_id?: string }).workflow_run_id;
    const parsedQuestion = useMemo(
        () => (message.type === AgentMessageType.QUESTION ? parseUserMessageAttachments(content) : null),
        [content, message.type],
    );

    const markdownComponents = useMemo(
        () => ({
            ...DEFAULT_AGENT_MARKDOWN_COMPONENTS,
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
                if (href.includes('/store/objects')) {
                    const documentId = href.split('/store/objects/')[1] || '';
                    if (StoreLinkComponent) {
                        return (
                            <StoreLinkComponent href={href} documentId={documentId}>
                                {props.children}
                            </StoreLinkComponent>
                        );
                    }
                    return (
                        <NavLink href={href} topLevelNav>
                            {props.children}
                        </NavLink>
                    );
                }
                if (href.includes('/store/collections')) {
                    const collectionId = href.split('/store/collections/')[1] || '';
                    if (CollectionLinkComponent) {
                        return (
                            <CollectionLinkComponent href={href} collectionId={collectionId}>
                                {props.children}
                            </CollectionLinkComponent>
                        );
                    }
                    return (
                        <NavLink href={href} topLevelNav>
                            {props.children}
                        </NavLink>
                    );
                }
                return <a {...props} target="_blank" rel="noopener noreferrer" />;
            },
        }),
        [StoreLinkComponent, CollectionLinkComponent],
    );

    if (workstreamLaunchDetails) {
        return (
            <SummaryWorkstreamLaunchMessage
                message={message}
                details={workstreamLaunchDetails}
                onSelectWorkstream={onSelectWorkstream}
            />
        );
    }

    if (message.type === AgentMessageType.QUESTION) {
        const questionBody = parsedQuestion?.body ?? content;
        const attachments = parsedQuestion?.attachments ?? [];

        return (
            <>
                {attachments.length > 0 && (
                    <div className="mx-auto flex w-full max-w-3xl justify-end px-1">
                        <AttachmentPreviewList
                            items={attachments}
                            artifactRunId={runId}
                            align="end"
                            variant="message"
                            StoreLinkComponent={StoreLinkComponent}
                            CollectionLinkComponent={CollectionLinkComponent}
                        />
                    </div>
                )}
                {questionBody && (
                    <SummaryUserBubble
                        message={message}
                        workstreamId={workstreamId}
                        artifactRunId={runId}
                        markdownComponents={markdownComponents}
                    >
                        {questionBody}
                    </SummaryUserBubble>
                )}
            </>
        );
    }

    const requestInputDetails = message.details as AskUserMessageDetails | undefined;
    if (message.type === AgentMessageType.REQUEST_INPUT && requestInputDetails?.ux) {
        const uxConfig = requestInputDetails.ux;
        return (
            <div className="mx-auto w-full max-w-3xl px-1">
                <AskUserWidget
                    question={content}
                    options={uxConfig.options}
                    variant={uxConfig.variant}
                    multiSelect={uxConfig.multiSelect}
                    onSelect={(optionId) => onSendMessage?.(optionId)}
                    onMultiSelect={(optionIds) => onSendMessage?.(optionIds.join(', '))}
                    allowFreeResponse={!uxConfig.options?.length || !!uxConfig.free_response}
                    placeholder={uxConfig.free_response?.placeholder}
                    submitLabel={uxConfig.free_response?.submit_label}
                    onSubmit={(value) => onSendMessage?.(value, uxConfig.free_response?.metadata)}
                    hideBorder
                    compact
                    answered={requestInputAnswered}
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
    key: string;
    label: string;
    value: unknown;
    tone?: 'default' | 'error';
}

interface SummaryToolDetailItem {
    key: string;
    kind: SummaryToolDetailKind;
    label: string;
    title: string;
    isPreamble?: boolean;
    command?: string;
    text?: string;
    toolName?: string;
    startedAt?: number | string;
    finishedAt?: number | string;
    status?: ToolExecutionStatus;
    decisionText?: string;
    sections: SummaryToolDetailSection[];
}

const SUMMARY_TOOL_STARTED_AT_DETAIL_KEY = '_summary_started_at';
const SUMMARY_TOOL_FINISHED_AT_DETAIL_KEY = '_summary_finished_at';
const SYNTHETIC_TOOL_APPROVAL_EVENT_SOURCE = 'synthetic_tool_approval_decision';

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
    'tool_event',
    'tool_iteration',
    'tool_run_id',
    'tool_use_id',
    'tool_status',
    'tools',
    'message_to_human',
    'progress_messages',
    'source',
    'token_usage',
    'checkpoint_at',
    'checkpoint_threshold',
    'approval_decision',
    'approval_request',
    'cancellation_reason',
    SUMMARY_TOOL_STARTED_AT_DETAIL_KEY,
    SUMMARY_TOOL_FINISHED_AT_DETAIL_KEY,
    'workflow_run_id',
]);

function getDetailsRecord(message: AgentMessage): Record<string, unknown> {
    return isRecordValue(message.details) ? message.details : {};
}

function isDocumentPanelEventMessage(message: AgentMessage): boolean {
    if (message.type !== AgentMessageType.UPDATE) return false;
    const eventClass = getDetailsRecord(message).event_class;
    return eventClass === 'document_created' || eventClass === 'document_updated';
}

function humanizeIdentifier(value: string): string {
    return value
        .replace(/[_-]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/\b\w/g, (letter) => letter.toUpperCase());
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

function getUniqueToolName(details: Record<string, unknown>): string | undefined {
    const names = Array.from(new Set(getToolNames(details)));
    return names.length > 0 ? names.join(', ') : undefined;
}

function getTimestampDetail(value: unknown): number | string | undefined {
    return typeof value === 'number' || typeof value === 'string' ? value : undefined;
}

const TOOL_TARGET_KEYS = [
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
];

function getToolTargetEntry(details: Record<string, unknown>): { key: string; value: string } | undefined {
    for (const key of TOOL_TARGET_KEYS) {
        const value = details[key];
        if (typeof value === 'string' && value.trim()) return { key, value: value.trim() };
        if (typeof value === 'number' || typeof value === 'boolean') return { key, value: String(value) };
    }
    return undefined;
}

function getToolDetailKind(message: AgentMessage): SummaryToolDetailKind {
    const details = getDetailsRecord(message);
    const toolNames = getToolNames(details).join(' ').toLowerCase();
    const concreteTool = typeof details.tool === 'string' ? details.tool.toLowerCase() : '';
    const classifierText = concreteTool || toolNames;

    if (isToolPreambleMessage(message)) return 'think';
    if (concreteTool.startsWith('learn_') || toolNames.includes('learn_')) return 'skill';
    if (concreteTool === 'discover_tools') return 'discover';
    if (message.type === AgentMessageType.THOUGHT && !concreteTool) return 'think';

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
    const directTarget = getToolTargetEntry(details);
    if (directTarget) return directTarget.value;

    const files = details.files ?? details.outputFiles;
    if (Array.isArray(files) && files.length > 0) {
        return files.map((file) => stringifyRequestValue(file)).join(', ');
    }

    return undefined;
}

function getApprovalDecisionLabel(decision: unknown, toolLabel: string): string | undefined {
    switch (decision) {
        case 'denied':
        case 'denied_with_feedback':
            return `User declined to use ${toolLabel}.`;
        case 'timeout':
            return `Approval timed out for ${toolLabel}.`;
        case 'reviewer_denied':
            return `Approval reviewer denied ${toolLabel}.`;
        case 'cancelled_after_denial':
            return `Cancelled ${toolLabel} after another tool was denied.`;
        default:
            return undefined;
    }
}

function getApprovalDecisionStatusText(decision: unknown): string | undefined {
    switch (decision) {
        case 'denied':
        case 'denied_with_feedback':
            return 'Declined by user';
        case 'timeout':
            return 'Approval timed out';
        case 'reviewer_denied':
            return 'Denied by reviewer';
        case 'cancelled_after_denial':
            return 'Cancelled after denial';
        default:
            return undefined;
    }
}

function getToolApprovalRecord(message: AgentMessage): Record<string, unknown> | undefined {
    const details = getDetailsRecord(message);
    const toolApproval = details.tool_approval;
    return isRecordValue(toolApproval) ? toolApproval : undefined;
}

function getApprovalKeyFromToolApproval(toolApproval: Record<string, unknown> | undefined): string | undefined {
    const approvalKey = toolApproval?.approval_key;
    return typeof approvalKey === 'string' && approvalKey.trim() ? approvalKey.trim() : undefined;
}

function getToolApprovalResponse(message: AgentMessage): 'allow_once' | 'allow_for_run' | 'deny' | undefined {
    if (message.type !== AgentMessageType.QUESTION) return undefined;
    const normalized = getMessageText(message).trim().toLowerCase();
    if (normalized === 'allow_once' || normalized === 'allow_for_run' || normalized === 'deny') return normalized;
    return undefined;
}

function getToolApprovalDisplayName(toolApproval: Record<string, unknown>): string {
    const title = toolApproval.tool_title;
    if (typeof title === 'string' && title.trim()) return title.trim();
    const name = toolApproval.tool_name;
    if (typeof name === 'string' && name.trim()) return humanizeIdentifier(name.trim());
    return 'tool action';
}

function buildSyntheticToolApprovalDecisionMessages(
    messages: AgentMessage[],
    resolvedToolApprovalKeys: Set<string>,
): AgentMessage[] {
    const syntheticMessages: AgentMessage[] = [];

    messages.forEach((message, index) => {
        if (message.type !== AgentMessageType.REQUEST_INPUT) return;

        const toolApproval = getToolApprovalRecord(message);
        const approvalKey = getApprovalKeyFromToolApproval(toolApproval);
        if (!toolApproval || !approvalKey || resolvedToolApprovalKeys.has(approvalKey)) return;

        const workstreamId = getWorkstreamId(message);
        let responseMessage: AgentMessage | undefined;
        for (let nextIndex = index + 1; nextIndex < messages.length; nextIndex += 1) {
            const nextMessage = messages[nextIndex];
            if (getWorkstreamId(nextMessage) !== workstreamId) continue;
            if (nextMessage.type === AgentMessageType.REQUEST_INPUT) break;
            if (nextMessage.type === AgentMessageType.QUESTION) {
                responseMessage = nextMessage;
                break;
            }
        }

        if (!responseMessage || getToolApprovalResponse(responseMessage) !== 'deny') return;

        const toolName =
            typeof toolApproval.tool_name === 'string' && toolApproval.tool_name.trim()
                ? toolApproval.tool_name.trim()
                : 'tool_action';
        const toolLabel = getToolApprovalDisplayName(toolApproval);
        const target = typeof toolApproval.target === 'string' && toolApproval.target.trim() ? toolApproval.target : '';
        const approvalRequest = {
            tool_name: toolName,
            tool_title: toolApproval.tool_title,
            action_summary: toolApproval.action_summary,
            target: toolApproval.target,
            approval_key: approvalKey,
        };

        syntheticMessages.push({
            timestamp: responseMessage.timestamp ?? message.timestamp,
            workflow_run_id: responseMessage.workflow_run_id || message.workflow_run_id,
            type: AgentMessageType.THOUGHT,
            message: getApprovalDecisionLabel('denied', toolLabel) ?? `User declined to use ${toolLabel}.`,
            workstream_id: workstreamId,
            details: {
                event_class: 'activity',
                tool: toolName,
                tool_run_id: `approval:${approvalKey}`,
                tool_use_id: `approval:${approvalKey}`,
                tool_status: 'error',
                tool_event: 'failed',
                activity_group_id: `approval:${approvalKey}`,
                approval_decision: 'denied',
                approval_request: approvalRequest,
                input: toolApproval.input,
                target,
                observation: 'The user declined this tool action.',
                source: SYNTHETIC_TOOL_APPROVAL_EVENT_SOURCE,
            },
        });
    });

    if (syntheticMessages.length === 0) return messages;
    return [...messages, ...syntheticMessages].sort(
        (a, b) => getTimestampMs(a.timestamp) - getTimestampMs(b.timestamp),
    );
}

function compactInlineText(value: string, maxLength = 160): string {
    const normalized = value.replace(/\s+/g, ' ').trim();
    return normalized.length > maxLength ? `${normalized.slice(0, maxLength - 1)}...` : normalized;
}

const MESSAGE_RENDER_ID_DETAIL_KEYS = [
    'batch_id',
    'activity_group_id',
    'activity_id',
    'tool_run_id',
    'tool_use_id',
    'streaming_id',
    'chunk_index',
    'tool_iteration',
    'tool_event',
];

function getStableDetailIdentity(details: Record<string, unknown>): string | undefined {
    for (const key of MESSAGE_RENDER_ID_DETAIL_KEYS) {
        const value = details[key];
        if (typeof value === 'string' && value.trim()) return `${key}:${value.trim()}`;
        if (typeof value === 'number' || typeof value === 'boolean') return `${key}:${value}`;
    }
    return undefined;
}

function getAgentMessageRenderKey(message: AgentMessage, prefix = 'message'): string {
    const details = getDetailsRecord(message);
    const detailIdentity = getStableDetailIdentity(details);
    const contentIdentity = compactInlineText(getMessageText(message), 96);

    return [
        prefix,
        message.workstream_id || 'main',
        message.workflow_run_id,
        message.timestamp,
        message.type,
        detailIdentity ?? contentIdentity,
    ]
        .filter(Boolean)
        .join(':');
}

function getRenderableGroupKey(group: RenderableGroup): string {
    if (group.type === 'single') {
        return getAgentMessageRenderKey(group.message);
    }

    if (group.type === 'streaming') {
        return `streaming:${group.streamingId}:${group.startTimestamp}:${group.workstreamId || 'main'}`;
    }

    const firstMessage = group.messages[0];
    const lastMessage = group.messages[group.messages.length - 1];
    const firstKey = firstMessage ? getAgentMessageRenderKey(firstMessage, 'first') : group.firstTimestamp;
    const lastKey = lastMessage ? getAgentMessageRenderKey(lastMessage, 'last') : group.firstTimestamp;

    return ['group', group.toolRunId, group.firstTimestamp, firstKey, lastKey].filter(Boolean).join(':');
}

function getPreviousRenderableGroupTimestamp(groups: RenderableGroup[], index: number): number | string | undefined {
    for (let previousIndex = index - 1; previousIndex >= 0; previousIndex--) {
        const group = groups[previousIndex];
        if (group.type === 'single') return group.message.timestamp;
        if (group.type === 'tool_group') return group.firstTimestamp;
        if (group.type === 'streaming') return group.startTimestamp;
    }
    return undefined;
}

function formatToolSectionValue(value: unknown): string {
    const text = stringifyRequestValue(value).trim();
    return text.length > 2400 ? `${text.slice(0, 2400)}\n...` : text;
}

function createToolSection(
    key: string,
    label: string,
    value: unknown,
    tone?: SummaryToolDetailSection['tone'],
): SummaryToolDetailSection | undefined {
    if (value === null || value === undefined || value === '') return undefined;
    if (Array.isArray(value) && value.length === 0) return undefined;
    if (isRecordValue(value) && Object.keys(value).length === 0) return undefined;
    return { key, label, value, tone };
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
    const targetEntry = getToolTargetEntry(details);

    const addSection = (label: string, keys: string[], tone?: SummaryToolDetailSection['tone']) => {
        for (const key of keys) {
            const section = createToolSection(key, label, details[key], tone);
            if (section) {
                consumedKeys.add(key);
                sections.push(section);
                return;
            }
        }
    };

    addSection('Query', ['query']);
    addSection('Input', ['input', 'params', 'arguments', 'args']);
    addSection(
        'Output',
        ['output', 'stdout', 'result', 'results', 'content', 'result_summary', 'observation', 'display_message'],
        typeof details.approval_decision === 'string' ? 'error' : undefined,
    );
    addSection('Files', ['files', 'outputFiles']);
    addSection('Error', ['error', 'stderr'], 'error');
    if (targetEntry) consumedKeys.add(targetEntry.key);

    const remainingDetails = getRemainingDetailFields(details, consumedKeys);
    if (sections.length === 0 && remainingDetails) {
        sections.push({ key: 'details', label: 'Details', value: remainingDetails });
    }

    return sections;
}

function buildSummaryToolDetailItem(message: AgentMessage, index: number): SummaryToolDetailItem | undefined {
    if (message.type === AgentMessageType.REQUEST_INPUT) return undefined;

    const text = getMessageText(message);
    const details = getDetailsRecord(message);
    const isPreamble = isToolPreambleMessage(message);
    const kind = getToolDetailKind(message);
    const toolNames = getToolNames(details);
    const target = getToolTarget(details);
    const command = typeof details.command === 'string' && details.command.trim() ? details.command.trim() : undefined;
    const fallbackTitle = toolNames[0] ? humanizeIdentifier(toolNames[0]) : getReadableToolLabel(message);
    const approvalDecisionTitle = getApprovalDecisionLabel(details.approval_decision, fallbackTitle);
    const decisionText = getApprovalDecisionStatusText(details.approval_decision);
    const messageToHuman =
        typeof details.message_to_human === 'string' && details.message_to_human.trim()
            ? details.message_to_human.trim()
            : undefined;
    const title =
        kind === 'think'
            ? text || fallbackTitle
            : kind === 'command'
              ? compactInlineText(messageToHuman || (!approvalDecisionTitle ? text : '') || command || fallbackTitle)
              : compactInlineText(messageToHuman || target || (!approvalDecisionTitle ? text : '') || fallbackTitle);
    const normalizedText = text ? (kind === 'think' ? text : compactInlineText(text, 420)) : undefined;
    const shouldShowText = normalizedText && normalizedText !== title && !approvalDecisionTitle;

    if (!title && !shouldShowText) return undefined;

    return {
        key: `${message.timestamp}-${details.activity_id || details.tool_run_id || index}`,
        kind,
        label: getToolDetailLabel(kind),
        title,
        isPreamble,
        command,
        text: shouldShowText ? normalizedText : undefined,
        toolName: getUniqueToolName(details),
        startedAt: getTimestampDetail(details[SUMMARY_TOOL_STARTED_AT_DETAIL_KEY]) ?? message.timestamp,
        finishedAt: getTimestampDetail(details[SUMMARY_TOOL_FINISHED_AT_DETAIL_KEY]) ?? message.timestamp,
        status: approvalDecisionTitle ? 'error' : (details.tool_status as ToolExecutionStatus | undefined),
        decisionText,
        sections: getToolDetailSections(message),
    };
}

function isPlanToolMessage(message: AgentMessage): boolean {
    const details = getDetailsRecord(message);
    return details.tool === 'plan' || details.tool === 'update_plan';
}

function isPlanLifecycleMessage(message: AgentMessage): boolean {
    const details = getDetailsRecord(message);
    if (message.type === AgentMessageType.UPDATE && Array.isArray(details.updates)) return true;
    return message.type === AgentMessageType.PLAN && Array.isArray(details.plan);
}

function getActivityGroupIdentity(details: Record<string, unknown>): string | undefined {
    return typeof details.activity_group_id === 'string' && details.activity_group_id.trim()
        ? details.activity_group_id.trim()
        : undefined;
}

function getToolIdentity(details: Record<string, unknown>): string | undefined {
    if (typeof details.tool_use_id === 'string' && details.tool_use_id.trim()) return details.tool_use_id.trim();
    if (typeof details.tool_run_id === 'string' && details.tool_run_id.trim()) return details.tool_run_id.trim();
    if (typeof details.tool === 'string' && details.tool.trim()) return details.tool.trim();
    return undefined;
}

function getSplitActivityGroups(messages: AgentMessage[]): Set<string> {
    const startedToolIdentities = new Map<string, Set<string>>();
    const approvalDecisionToolIdentities = new Map<string, Set<string>>();

    const addIdentity = (
        groups: Map<string, Set<string>>,
        activityGroupId: string | undefined,
        toolIdentity: string | undefined,
    ) => {
        if (!activityGroupId || !toolIdentity) return;
        const identities = groups.get(activityGroupId) ?? new Set<string>();
        identities.add(toolIdentity);
        groups.set(activityGroupId, identities);
    };

    for (const message of messages) {
        const details = getDetailsRecord(message);
        const activityGroupId = getActivityGroupIdentity(details);
        const toolIdentity = getToolIdentity(details);

        if (details.tool_event === 'started') {
            addIdentity(startedToolIdentities, activityGroupId, toolIdentity);
        }
        if (typeof details.approval_decision === 'string') {
            addIdentity(approvalDecisionToolIdentities, activityGroupId, toolIdentity);
        }
    }

    return new Set(
        [...startedToolIdentities.entries(), ...approvalDecisionToolIdentities.entries()]
            .filter(([, identities]) => identities.size > 1)
            .map(([activityGroupId]) => activityGroupId),
    );
}

function getSummaryToolGroupId(details: Record<string, unknown>, splitActivityGroups: Set<string>): string | undefined {
    const activityGroupId = getActivityGroupIdentity(details);
    const toolIdentity = getToolIdentity(details);

    if (activityGroupId) {
        if (toolIdentity && splitActivityGroups.has(activityGroupId)) {
            return `activity:${activityGroupId}:tool:${toolIdentity}`;
        }
        return `activity:${activityGroupId}`;
    }

    if (typeof details.tool_use_id === 'string' && details.tool_use_id.trim()) {
        return `tool-use:${details.tool_use_id.trim()}`;
    }
    if (typeof details.tool_run_id === 'string' && details.tool_run_id.trim())
        return `run:${details.tool_run_id.trim()}`;
    return undefined;
}

function mergeSummaryToolMessages(messages: AgentMessage[]): AgentMessage[] {
    const byGroupId = new Map<string, { index: number; messages: AgentMessage[] }>();
    const ungrouped: Array<{ index: number; message: AgentMessage }> = [];
    let currentPlanGroupId: string | undefined;
    const splitActivityGroups = getSplitActivityGroups(messages);

    messages.forEach((message, index) => {
        const details = getDetailsRecord(message);
        if (isToolPreambleMessage(message)) {
            ungrouped.push({ index, message });
            currentPlanGroupId = undefined;
            return;
        }

        const groupId = getSummaryToolGroupId(details, splitActivityGroups);
        const legacyPlanGroupId = !groupId && isPlanLifecycleMessage(message) ? currentPlanGroupId : undefined;
        const effectiveGroupId = groupId ?? legacyPlanGroupId;

        if (!effectiveGroupId) {
            ungrouped.push({ index, message });
            return;
        }

        const group = byGroupId.get(effectiveGroupId);
        if (group) {
            group.messages.push(message);
        } else {
            byGroupId.set(effectiveGroupId, { index, messages: [message] });
        }

        if (isPlanToolMessage(message)) {
            currentPlanGroupId = effectiveGroupId;
        } else if (message.type === AgentMessageType.PLAN) {
            currentPlanGroupId = undefined;
        }
    });

    const grouped = Array.from(byGroupId.values()).map(({ index, messages: runMessages }) => {
        const sortedMessages = [...runMessages].sort(
            (a, b) => getTimestampMs(a.timestamp) - getTimestampMs(b.timestamp),
        );
        const baseMessage = sortedMessages[sortedMessages.length - 1];
        const startMessage = sortedMessages.find((message) => getDetailsRecord(message).tool_event === 'started');
        const firstTextMessage = sortedMessages.find((message) => getMessageText(message));
        const latestApprovalDecisionMessage = sortedMessages.findLast((message) => {
            const details = getDetailsRecord(message);
            return typeof details.approval_decision === 'string' && Boolean(getMessageText(message));
        });
        const commandTextMessage = sortedMessages.findLast((message) => getMessageText(message).startsWith('$ '));
        const latestStatusMessage = sortedMessages.findLast(
            (message) =>
                (message.type === AgentMessageType.ERROR || message.type === AgentMessageType.WARNING) &&
                getMessageText(message),
        );
        const mergedDetails: Record<string, unknown> = {};
        for (const message of sortedMessages) {
            Object.assign(mergedDetails, getDetailsRecord(message));
        }
        if (latestStatusMessage && mergedDetails.error === undefined && mergedDetails.stderr === undefined) {
            mergedDetails.error = getMessageText(latestStatusMessage);
        }
        if (
            !latestStatusMessage &&
            sortedMessages.some(
                (message) => message.type === AgentMessageType.PLAN && Array.isArray(message.details?.plan),
            )
        ) {
            mergedDetails.tool_status = 'completed';
        }
        if (commandTextMessage && mergedDetails.command === undefined) {
            mergedDetails.command = getMessageText(commandTextMessage);
        }
        mergedDetails[SUMMARY_TOOL_STARTED_AT_DETAIL_KEY] = sortedMessages[0]?.timestamp;
        mergedDetails[SUMMARY_TOOL_FINISHED_AT_DETAIL_KEY] = sortedMessages[sortedMessages.length - 1]?.timestamp;
        const messageToHuman =
            typeof startMessage?.details?.message_to_human === 'string' ? startMessage.details.message_to_human : '';

        return {
            index,
            message: {
                ...baseMessage,
                message:
                    latestApprovalDecisionMessage?.message ||
                    messageToHuman ||
                    (firstTextMessage ? firstTextMessage.message : baseMessage.message),
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

interface ToolDetailMetadataEntry {
    label: string;
    value: string;
}

function getToolDetailMetadata(item: SummaryToolDetailItem): ToolDetailMetadataEntry[] {
    const entries: ToolDetailMetadataEntry[] = [];
    const startedMs = parseTimestampMs(item.startedAt);
    const finishedMs = parseTimestampMs(item.finishedAt);
    const startedAt = formatToolDetailTimestamp(item.startedAt);
    const finishedAt = formatToolDetailTimestamp(item.finishedAt);

    if (item.toolName) {
        entries.push({ label: 'Tool', value: item.toolName });
    }

    if (startedAt && finishedAt && startedMs !== undefined && finishedMs !== undefined && startedMs !== finishedMs) {
        entries.push({ label: 'Started', value: startedAt });
        entries.push({ label: 'Ended', value: finishedAt });
        entries.push({ label: 'Duration', value: formatDuration(getDurationSeconds(item.startedAt, item.finishedAt)) });
    } else if (startedAt || finishedAt) {
        entries.push({ label: 'Time', value: startedAt ?? finishedAt ?? '' });
    }

    return entries;
}

function ToolDetailMetadata({ hasDetailContent, item }: { hasDetailContent: boolean; item: SummaryToolDetailItem }) {
    const entries = getToolDetailMetadata(item);
    if (entries.length === 0) return null;

    return (
        <dl
            className={cn(
                'flex flex-wrap gap-x-4 gap-y-1 text-xs',
                hasDetailContent && 'mb-3 border-b border-border/60 pb-2',
            )}
        >
            {entries.map((entry) => (
                <div key={entry.label} className="flex min-w-0 items-baseline gap-1.5">
                    <dt className="shrink-0 text-muted">{entry.label}</dt>
                    <dd className="min-w-0 wrap-break-word font-medium text-foreground/80">{entry.value}</dd>
                </div>
            ))}
        </dl>
    );
}

function ToolDetailSection({ section }: { section: SummaryToolDetailSection }) {
    const value = section.value;
    const isPrimitive = typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean';
    const isFileList = section.label === 'Files' && Array.isArray(value);
    const hideLabel = section.label === 'Output';

    if (isFileList) {
        const fileLabels = Array.from(new Set(value.map((file) => stringifyRequestValue(file))));

        return (
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {fileLabels.map((fileLabel) => (
                    <span
                        key={fileLabel}
                        className="rounded-md bg-mixer-muted/15 px-1.5 py-0.5 font-mono text-[11px] text-muted"
                    >
                        {compactInlineText(fileLabel, 64)}
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

function getToolPanelTitle(item: SummaryToolDetailItem): string {
    return item.kind === 'command' ? 'Shell' : item.label;
}

function formatToolPrimaryText(item: SummaryToolDetailItem): string {
    if (item.kind !== 'command') return item.title;
    const command = item.command || item.title;
    return command.trim().startsWith('$') ? command : `$ ${command}`;
}

function formatToolDetailCopyText(item: SummaryToolDetailItem): string {
    const parts = [getToolPanelTitle(item), formatToolPrimaryText(item)];
    const metadata = getToolDetailMetadata(item).map((entry) => `${entry.label}: ${entry.value}`);
    if (metadata.length > 0) parts.push(metadata.join('\n'));
    if (item.text) parts.push(item.text);

    for (const section of item.sections) {
        parts.push(`${section.label}\n${formatToolSectionValue(section.value)}`);
    }

    return parts.filter(Boolean).join('\n\n');
}

async function copyTextToClipboard(text: string): Promise<boolean> {
    try {
        if (navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(text);
            return true;
        }
    } catch {
        // Fall back to the older textarea path below.
    }

    if (typeof document === 'undefined') return false;

    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.insetInlineStart = '-9999px';
    textarea.style.top = '0';
    document.body.appendChild(textarea);

    try {
        textarea.focus();
        textarea.select();
        return document.execCommand('copy');
    } catch {
        return false;
    } finally {
        textarea.remove();
    }
}

function SummaryToolDetailPanel({ item }: { item: SummaryToolDetailItem }) {
    const commandText = item.kind === 'command' && item.command ? formatToolPrimaryText(item) : undefined;
    const fallbackText = !commandText && item.sections.length === 0 ? item.text : undefined;
    const hasDetailContent = Boolean(commandText || fallbackText || item.sections.length);
    const copyText = formatToolDetailCopyText(item);
    const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');
    const copyResetRef = useRef<number | undefined>(undefined);

    useEffect(() => {
        return () => {
            if (copyResetRef.current !== undefined) window.clearTimeout(copyResetRef.current);
        };
    }, []);

    const copyDetails = () => {
        void copyTextToClipboard(copyText).then((success) => {
            setCopyState(success ? 'copied' : 'failed');
            if (copyResetRef.current !== undefined) window.clearTimeout(copyResetRef.current);
            copyResetRef.current = window.setTimeout(() => setCopyState('idle'), 2000);
        });
    };

    return (
        <div className="relative mt-2 rounded-lg border border-border/70 bg-mixer-muted/10 p-3 shadow-sm">
            {hasDetailContent ? (
                <div className="absolute end-2 top-2">
                    <button
                        type="button"
                        className={cn(
                            'inline-flex size-7 shrink-0 items-center justify-center rounded-md text-muted opacity-70 transition',
                            'hover:bg-mixer-muted/20 hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                            copyState === 'copied' && 'text-success opacity-100',
                            copyState === 'failed' && 'text-destructive opacity-100',
                        )}
                        onClick={copyDetails}
                        aria-label="Copy tool details"
                        title="Copy tool details"
                    >
                        {copyState === 'copied' ? <CheckCircle className="size-4" /> : <CopyIcon className="size-4" />}
                    </button>
                </div>
            ) : null}
            <div className={cn(hasDetailContent && 'pe-7')}>
                <ToolDetailMetadata item={item} hasDetailContent={hasDetailContent} />
                {commandText ? (
                    <pre className="mb-3 whitespace-pre-wrap break-words font-mono text-sm leading-6 text-foreground/85">
                        {commandText}
                    </pre>
                ) : null}
                {fallbackText ? (
                    <div className="mb-3 break-words text-sm leading-6 text-foreground/75">{fallbackText}</div>
                ) : null}
                {item.sections.length > 0 ? (
                    <div className="space-y-3">
                        {item.sections.map((section) => (
                            <ToolDetailSection key={section.key} section={section} />
                        ))}
                    </div>
                ) : null}
            </div>
            {copyState === 'failed' && hasDetailContent ? (
                <div className="mt-3 text-xs text-destructive">Copy failed</div>
            ) : null}
        </div>
    );
}

function SummaryToolTimelineItem({ item }: { item: SummaryToolDetailItem }) {
    const isDecision = Boolean(item.decisionText);
    const isAttention = !isDecision && (item.status === 'error' || item.status === 'warning');
    const hasMetadata = getToolDetailMetadata(item).length > 0;
    const hasDetails = Boolean(item.command || item.text || item.sections.length || hasMetadata);
    const [isExpanded, setIsExpanded] = useState(false);
    const iconStatus = isDecision ? undefined : item.status;

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
                    <ToolDetailIcon kind={item.kind} status={iconStatus} />
                </span>
                <span className="min-w-0 text-sm text-muted">
                    <span className="break-words">{item.title}</span>
                    {item.decisionText ? (
                        <Badge variant="destructive" className="ms-2 rounded-full shadow-sm shadow-destructive/10">
                            {item.decisionText}
                        </Badge>
                    ) : null}
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
                <div className="mt-1">
                    <SummaryToolDetailPanel item={item} />
                </div>
            ) : null}
        </div>
    );
}

function SummaryThoughtProseItem({
    item,
    artifactRunId,
    disableCollapse,
}: {
    item: SummaryToolDetailItem;
    artifactRunId?: string;
    disableCollapse?: boolean;
}) {
    const { t } = useUITranslation();
    const text = item.text ?? item.title;
    const normalizedText = text.trim();
    const [isExpanded, setIsExpanded] = useState(false);
    const explicitLineCount = normalizedText ? normalizedText.split(/\r?\n/).length : 0;
    const isLong =
        normalizedText.length > SUMMARY_THOUGHT_COLLAPSE_THRESHOLD ||
        explicitLineCount > SUMMARY_THOUGHT_COLLAPSE_LINES;
    const toggleLabel = isExpanded ? t('agent.showLess') : t('agent.showMore');

    return (
        <div className="min-w-0 py-1">
            <div
                data-testid="summary-thought-prose"
                className={cn(
                    SUMMARY_PROSE_CLASS,
                    isLong &&
                        !disableCollapse &&
                        !isExpanded &&
                        '[display:-webkit-box] overflow-hidden [-webkit-box-orient:vertical] [-webkit-line-clamp:6]',
                )}
                style={{ overflowWrap: 'anywhere' }}
            >
                <MarkdownRenderer artifactRunId={artifactRunId} components={DEFAULT_AGENT_MARKDOWN_COMPONENTS}>
                    {text}
                </MarkdownRenderer>
            </div>
            {isLong && !disableCollapse ? (
                <div className="mt-1.5 flex justify-end">
                    <button
                        type="button"
                        aria-expanded={isExpanded}
                        className={cn(
                            'inline-flex items-center gap-1 text-sm font-medium text-muted transition-colors',
                            '[text-decoration:none] hover:text-foreground hover:[text-decoration:none]',
                            'focus-visible:text-foreground focus-visible:[text-decoration:none]',
                            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                        )}
                        onClick={() => setIsExpanded((current) => !current)}
                    >
                        {toggleLabel}
                        <ChevronDown
                            className={cn('size-4 transition-transform', isExpanded && 'rotate-180')}
                            aria-hidden="true"
                        />
                    </button>
                </div>
            ) : null}
        </div>
    );
}

function SummaryToolTimeline({
    items,
    artifactRunId,
    disablePreambleCollapse,
}: {
    items: SummaryToolDetailItem[];
    artifactRunId?: string;
    disablePreambleCollapse?: boolean;
}) {
    return (
        <div className="mt-3">
            <div className="space-y-3">
                {items.map((item) =>
                    item.isPreamble || item.kind === 'think' ? (
                        <SummaryThoughtProseItem
                            key={item.key}
                            item={item}
                            artifactRunId={artifactRunId}
                            disableCollapse={disablePreambleCollapse}
                        />
                    ) : (
                        <SummaryToolTimelineItem key={item.key} item={item} />
                    ),
                )}
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
                <MarkdownRenderer artifactRunId={artifactRunId} components={DEFAULT_AGENT_MARKDOWN_COMPONENTS}>
                    {text}
                </MarkdownRenderer>
            </div>
        </div>
    );
}

function SummaryStoppedMessage({
    message,
    startTimestamp,
    endTimestamp,
    className,
}: {
    message: AgentMessage;
    startTimestamp?: number | string;
    endTimestamp?: number | string;
    className?: string;
}) {
    const { t } = useUITranslation();
    const duration = formatDuration(
        getDurationSeconds(startTimestamp ?? message.timestamp, endTimestamp ?? message.timestamp),
    );

    return (
        <div className={cn('mx-auto w-full max-w-3xl px-1', className)} data-testid="summary-stopped-message">
            <div className="flex items-center justify-end gap-2 text-lg font-medium text-muted sm:text-xl">
                <span>{t('agent.youStoppedAfter', { duration })}</span>
                <MessageDeliveryStatus message={message} className="h-5 w-5" />
            </div>
            <div className="mt-5 border-b border-border/70" />
        </div>
    );
}

function SummaryActivityRow({
    label,
    timestamp,
    durationSeconds,
    showElapsed,
    details,
    emptyDetailsLabel,
    defaultExpanded = false,
    disablePreambleCollapse = false,
    className,
    artifactRunId,
    onSendMessage,
    answeredToolApprovalRequestInputKeys,
    resolvedToolApprovalKeys,
}: {
    label: string;
    status?: ToolExecutionStatus;
    timestamp?: number | string;
    durationSeconds?: number;
    showElapsed?: boolean;
    details?: AgentMessage[];
    emptyDetailsLabel?: string;
    defaultExpanded?: boolean;
    disablePreambleCollapse?: boolean;
    className?: string;
    artifactRunId?: string;
    onSendMessage?: (message: string, metadata?: Record<string, unknown>) => void;
    answeredToolApprovalRequestInputKeys?: Set<string>;
    resolvedToolApprovalKeys?: Set<string>;
}) {
    const [isExpanded, setIsExpanded] = useState(defaultExpanded);
    const isLiveElapsed = showElapsed && durationSeconds === undefined;
    const liveElapsed = useLiveElapsedSeconds(timestamp, isLiveElapsed);
    const elapsed = durationSeconds ?? liveElapsed;
    const shouldShowElapsed = showElapsed && timestamp !== undefined;
    const detailItems = useMemo(() => buildSummaryToolDetailItems(details ?? []), [details]);
    const requestInputMessages = useMemo(
        () =>
            (details ?? []).filter(
                (message): message is RequestInputMessageWithUx =>
                    hasRequestInputUx(message) &&
                    !isToolApprovalRequestInputHidden(
                        message,
                        answeredToolApprovalRequestInputKeys ?? new Set<string>(),
                        resolvedToolApprovalKeys ?? new Set<string>(),
                    ),
            ),
        [answeredToolApprovalRequestInputKeys, details, resolvedToolApprovalKeys],
    );
    const canExpand = detailItems.length > 0 || requestInputMessages.length > 0 || Boolean(emptyDetailsLabel);

    return (
        <div className={cn('mx-auto w-full max-w-3xl px-1', className)}>
            <div className="border-b border-border/70 pb-3 text-sm text-muted">
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
                    detailItems.length > 0 || requestInputMessages.length > 0 ? (
                        <>
                            {detailItems.length > 0 ? (
                                <SummaryToolTimeline
                                    items={detailItems}
                                    artifactRunId={artifactRunId}
                                    disablePreambleCollapse={disablePreambleCollapse}
                                />
                            ) : null}
                            {requestInputMessages.length > 0 ? (
                                <div className="mt-3 space-y-3">
                                    {requestInputMessages.map((message) => {
                                        const uxConfig = message.details.ux;
                                        return (
                                            <AskUserWidget
                                                key={getAgentMessageRenderKey(message, 'work-request-input')}
                                                question={getRequestInputDisplayText(message)}
                                                options={uxConfig.options}
                                                variant={uxConfig.variant}
                                                multiSelect={uxConfig.multiSelect}
                                                onSelect={(optionId) => onSendMessage?.(optionId)}
                                                onMultiSelect={(optionIds) => onSendMessage?.(optionIds.join(', '))}
                                                allowFreeResponse={
                                                    !uxConfig.options?.length || !!uxConfig.free_response
                                                }
                                                placeholder={uxConfig.free_response?.placeholder}
                                                submitLabel={uxConfig.free_response?.submit_label}
                                                onSubmit={(value) =>
                                                    onSendMessage?.(value, uxConfig.free_response?.metadata)
                                                }
                                                hideBorder
                                                compact
                                                className="my-0"
                                                cardClassName="bg-background/60 shadow-none"
                                            />
                                        );
                                    })}
                                </div>
                            ) : null}
                        </>
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
    onSendMessage?: (message: string, metadata?: Record<string, unknown>) => void;
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
    /** Whether the synthetic initial request fallback should render when no persisted question is present. */
    showInitialRequest?: boolean;
    /** Message types to exclude from the conversation view */
    hiddenMessageTypes?: AgentMessageType[];
    /** Test/playback mode: keep the current scroll position while the rendered message slice changes. */
    disableAutoScroll?: boolean;
    /** Whether REQUEST_INPUT messages render their active controls in the transcript. */
    renderRequestInputControls?: boolean;
    /** Active workstream selected by the parent conversation shell. */
    activeWorkstream?: string;
    /** Called when the user selects a different workstream from the conversation. */
    onActiveWorkstreamChange?: (workstreamId: string) => void;
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
    showInitialRequest,
    hiddenMessageTypes,
    disableAutoScroll = false,
    renderRequestInputControls = true,
    activeWorkstream: controlledActiveWorkstream,
    onActiveWorkstreamChange,
}: AllMessagesMixedProps) {
    if (!artifactRunId) {
        console.warn('[AllMessagesMixed] artifactRunId prop is missing!');
    }

    const { t } = useUITranslation();
    const containerRef = useRef<HTMLDivElement | null>(null);
    const [internalActiveWorkstream, setInternalActiveWorkstream] = useState<string>('all');
    const activeWorkstream = controlledActiveWorkstream ?? internalActiveWorkstream;
    const setActiveWorkstream = useCallback(
        (workstreamId: string) => {
            if (controlledActiveWorkstream === undefined) {
                setInternalActiveWorkstream(workstreamId);
            }
            onActiveWorkstreamChange?.(workstreamId);
        },
        [controlledActiveWorkstream, onActiveWorkstreamChange],
    );

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
        if (disableAutoScroll) return;
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
    }, [messages.length, streamingMessages.size, streamingContentBucket, performScroll, disableAutoScroll]);

    // Sort all messages chronologically and dedupe adjacent identical messages
    // Low-signal messages are suppressed at the source (server-side) via shouldSuppressLowSignalMessage
    const sortedMessages = React.useMemo(() => {
        const filtered = messages.filter(
            (message) => !isDocumentPanelEventMessage(message) && !hiddenMessageTypes?.includes(message.type),
        );

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

    const workstreams = React.useMemo(() => {
        const extractedWorkstreams = extractWorkstreams(sortedMessages);

        sortedMessages.forEach((message) => {
            const details = getWorkstreamLaunchDetails(message) ?? getWorkstreamActivityDetails(message);
            if (!details) return;
            extractedWorkstreams.set(
                details.workstreamId,
                getWorkstreamDisplayName(details.workstreamId, details.interaction),
            );
        });

        return extractedWorkstreams;
    }, [sortedMessages]);

    const activeWorkstreamName = React.useMemo(() => {
        if (activeWorkstream === 'all') return undefined;
        return workstreams.get(activeWorkstream) ?? formatWorkstreamName(activeWorkstream);
    }, [activeWorkstream, workstreams]);

    const scrollToTop = useCallback(() => {
        const container = containerRef.current;
        if (!container) return;

        programmaticScrollRef.current = true;
        if (typeof container.scrollTo === 'function') {
            container.scrollTo({ top: 0, behavior: 'smooth' });
        } else {
            container.scrollTop = 0;
        }
        requestAnimationFrame(() => {
            programmaticScrollRef.current = false;
        });
    }, []);

    const handleSelectWorkstream = useCallback(
        (workstreamId: string) => {
            setActiveWorkstream(workstreamId);
            requestAnimationFrame(scrollToTop);
        },
        [scrollToTop, setActiveWorkstream],
    );

    const handleShowMainAgentChat = useCallback(() => {
        setActiveWorkstream('all');
        requestAnimationFrame(scrollToTop);
    }, [scrollToTop, setActiveWorkstream]);

    useEffect(() => {
        if (activeWorkstream !== 'all' && !workstreams.has(activeWorkstream)) {
            setActiveWorkstream('all');
        }
    }, [activeWorkstream, workstreams, setActiveWorkstream]);

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
        return attachWriteArtifactCompletionMessages(
            filterMessagesForActiveWorkstream(sortedMessages, activeWorkstream),
        );
    }, [sortedMessages, activeWorkstream]);

    const answeredRequestInputKeys = React.useMemo(
        () => getAnsweredRequestInputKeys(displayMessages),
        [displayMessages],
    );
    const resolvedToolApprovalKeys = React.useMemo(
        () => getResolvedToolApprovalKeys(displayMessages),
        [displayMessages],
    );
    const answeredToolApprovalRequestInputKeys = React.useMemo(
        () => getAnsweredToolApprovalRequestInputKeys(displayMessages),
        [displayMessages],
    );
    const hiddenToolApprovalAnswerKeys = React.useMemo(
        () => getHiddenToolApprovalAnswerKeys(displayMessages),
        [displayMessages],
    );
    const externallyRenderedRequestInputKey = React.useMemo(() => {
        if (renderRequestInputControls) return undefined;
        const pendingRequestInput = getPendingRequestInputMessage(displayMessages);
        return pendingRequestInput ? getRequestInputMessageKey(pendingRequestInput) : undefined;
    }, [displayMessages, renderRequestInputControls]);
    const shouldHideRequestInputMessage = React.useCallback(
        (message: AgentMessage) =>
            message.type === AgentMessageType.REQUEST_INPUT &&
            (externallyRenderedRequestInputKey === getRequestInputMessageKey(message) ||
                isToolApprovalRequestInputHidden(
                    message,
                    answeredToolApprovalRequestInputKeys,
                    resolvedToolApprovalKeys,
                )),
        [answeredToolApprovalRequestInputKeys, externallyRenderedRequestInputKey, resolvedToolApprovalKeys],
    );
    const shouldHideToolApprovalAnswerMessage = React.useCallback(
        (message: AgentMessage) => isToolApprovalAnswerHidden(message, hiddenToolApprovalAnswerKeys),
        [hiddenToolApprovalAnswerKeys],
    );
    const completionDisplayMessages = React.useMemo(
        () => displayMessages.filter((message) => !shouldHideToolApprovalAnswerMessage(message)),
        [displayMessages, shouldHideToolApprovalAnswerMessage],
    );

    const fallbackWorkingStartedAtRef = useRef(Date.now());
    const hasInitialRequest =
        Boolean(prependFriendlyMessage?.trim()) ||
        hasInitialRequestValue(initialRequestData) ||
        initialRequestTemplate !== undefined;
    const canRenderInitialRequest = showInitialRequest ?? true;
    const hasRenderableInitialRequest = hasInitialRequest && canRenderInitialRequest;
    const hasPersistedUserQuestion = useMemo(
        () => displayMessages.some((message) => message.type === AgentMessageType.QUESTION),
        [displayMessages],
    );
    const shouldRenderInitialRequest =
        activeWorkstream === 'all' && hasRenderableInitialRequest && !hasPersistedUserQuestion;

    const latestDisplayMessageTimestamp = useMemo(() => {
        return displayMessages.reduce((latest, msg) => Math.max(latest, getTimestampMs(msg.timestamp)), -Infinity);
    }, [displayMessages]);

    const latestNonTransientDisplayMessageTimestamp = useMemo(() => {
        return displayMessages.reduce((latest, msg) => {
            if (isTransientThinkingMessage(msg)) return latest;
            return Math.max(latest, getTimestampMs(msg.timestamp));
        }, -Infinity);
    }, [displayMessages]);
    const hasPendingToolApprovalRequest = useMemo(
        () =>
            displayMessages.some(
                (message) =>
                    isToolApprovalRequestInput(message) &&
                    !isToolApprovalRequestInputHidden(
                        message,
                        answeredToolApprovalRequestInputKeys,
                        resolvedToolApprovalKeys,
                    ),
            ),
        [answeredToolApprovalRequestInputKeys, displayMessages, resolvedToolApprovalKeys],
    );
    const hasLatestToolApprovalAllow = useMemo(
        () => hasLatestToolApprovalAllowTurn(displayMessages, hiddenToolApprovalAnswerKeys),
        [displayMessages, hiddenToolApprovalAnswerKeys],
    );

    const isDisplayCompleted = useMemo(() => {
        if (hasPendingToolApprovalRequest) return false;
        if (hasLatestToolApprovalAllow) return false;
        if (hasOpenUserTurn(completionDisplayMessages)) return false;
        return isCompleted || !isInProgress(completionDisplayMessages);
    }, [completionDisplayMessages, hasLatestToolApprovalAllow, hasPendingToolApprovalRequest, isCompleted]);

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
        () =>
            buildSyntheticToolApprovalDecisionMessages(
                buildSummaryDisplayMessages(displayMessages, completeStreaming),
                resolvedToolApprovalKeys,
            ),
        [displayMessages, completeStreaming, resolvedToolApprovalKeys],
    );
    const visibleSummaryDisplayMessages = React.useMemo(
        () =>
            summaryDisplayMessages.filter(
                (message) => !shouldHideRequestInputMessage(message) && !shouldHideToolApprovalAnswerMessage(message),
            ),
        [summaryDisplayMessages, shouldHideRequestInputMessage, shouldHideToolApprovalAnswerMessage],
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
        () =>
            buildSummaryConversationItems(
                visibleSummaryDisplayMessages,
                isDisplayCompleted,
                latestSummaryObservedTimestamp,
            ),
        [visibleSummaryDisplayMessages, isDisplayCompleted, latestSummaryObservedTimestamp],
    );

    // Group messages with ONLY complete streaming interleaved for stacked view.
    // Incomplete streaming is rendered separately at the end (avoids re-grouping on every chunk).
    // Assistant prose stays as its own timeline item so thoughts remain visible between tool calls.
    const groupedMessages = React.useMemo(
        () =>
            mergeConsecutiveToolGroups(
                groupMessagesWithStreaming(displayMessages, completeStreaming, activeWorkstream),
            ),
        [displayMessages, completeStreaming, activeWorkstream],
    );

    // Show an activity indicator when the latest visible conversation state is not terminal.
    // Older idle/complete messages from previous turns must not suppress the new turn.
    const isAgentWorking = useMemo(() => {
        // Also treat an open user turn (the latest message is the user's, awaiting the agent's
        // first output) as "working" — otherwise nothing animates in the gap between sending a
        // message and the first streamed token, especially after a stop where the run reads as
        // completed until the agent posts its next message.
        return !isDisplayCompleted || hasOpenUserTurn(completionDisplayMessages);
    }, [completionDisplayMessages, isDisplayCompleted]);

    const showActivityFallback = shouldShowSummaryActivityFallback(
        summaryConversationItems,
        isAgentWorking,
        incompleteStreaming.length > 0,
    );
    const summaryActivityFallbackLabel = isInitialSummaryActivityFallback(summaryConversationItems)
        ? t('agent.preparing')
        : t('agent.working');
    const showInitialRequestWaitingCard =
        displayMessages.length === 0 &&
        hasRenderableInitialRequest &&
        isAgentWorking &&
        incompleteStreaming.length === 0;
    const activityAnchorCandidate = useMemo(
        () =>
            getSummaryActivityAnchorTimestamp(
                summaryConversationItems,
                visibleSummaryDisplayMessages,
                fallbackWorkingStartedAtRef.current,
            ),
        [summaryConversationItems, visibleSummaryDisplayMessages],
    );
    const activityStartedTimestampRef = useRef<number | string>(activityAnchorCandidate);
    const wasActivityFallbackVisibleRef = useRef(false);
    const activityStartedTimestamp = useMemo(() => {
        if (!showActivityFallback) return activityAnchorCandidate;
        const candidateMs = getTimestampMs(activityAnchorCandidate);
        const currentMs = getTimestampMs(activityStartedTimestampRef.current);
        if (!wasActivityFallbackVisibleRef.current || candidateMs < currentMs) {
            return activityAnchorCandidate;
        }
        return activityStartedTimestampRef.current;
    }, [activityAnchorCandidate, showActivityFallback]);

    useEffect(() => {
        activityStartedTimestampRef.current = activityStartedTimestamp;
        wasActivityFallbackVisibleRef.current = showActivityFallback;
    }, [activityStartedTimestamp, showActivityFallback]);

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
            data-message-count={messages.length}
            data-streaming-count={streamingMessages.size}
            data-view-mode={viewMode}
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
                /* Tables should read like part of the conversation, not a separate app grid. */
                .vprose table {
                    margin-top: 0.875rem;
                    margin-bottom: 0.875rem;
                    border-collapse: collapse;
                    width: 100%;
                    background: transparent;
                }
                .vprose th,
                .vprose td {
                    padding: 0.5rem 0.625rem;
                    border: 0;
                    border-bottom: 1px solid color-mix(in oklch, var(--border) 70%, transparent);
                    background: transparent;
                    text-align: left;
                }
                .vprose thead th {
                    background: transparent;
                    font-weight: 600;
                    color: var(--muted);
                    font-size: 0.75rem;
                    text-transform: none;
                    letter-spacing: 0;
                }
                .vprose tbody tr:hover {
                    background: transparent;
                }
                /* Dark mode table styles */
                .dark .vprose th,
                .dark .vprose td {
                    border-color: color-mix(in oklch, var(--border) 70%, transparent);
                }
                .dark .vprose thead th {
                    background: transparent;
                    color: var(--muted);
                }
                .dark .vprose tbody tr:hover {
                    background: transparent;
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
                    border: 0;
                    border-collapse: collapse;
                    border-spacing: 0;
                    font-size: 0.8125rem;
                    table-layout: fixed;
                    background: transparent;
                }
                .agent-markdown thead {
                    background: transparent;
                }
                .agent-markdown th,
                .agent-markdown td {
                    border: 0;
                    border-bottom: 1px solid color-mix(in oklch, var(--border) 70%, transparent);
                    background: transparent;
                    padding: 0.55rem 0.75rem;
                    text-align: left;
                    vertical-align: top;
                    overflow-wrap: anywhere;
                    word-break: normal;
                    white-space: normal;
                }
                .agent-markdown th {
                    color: var(--muted);
                    font-size: 0.75rem;
                    font-weight: 600;
                    letter-spacing: 0;
                    text-transform: none;
                    white-space: nowrap;
                }
                .agent-markdown td {
                    color: inherit;
                }
                .agent-markdown th + th,
                .agent-markdown td + td {
                    padding-inline-start: 1.75rem;
                }
                .agent-markdown th:first-child,
                .agent-markdown td:first-child {
                    min-width: 0;
                    width: auto;
                    white-space: normal;
                }
                .agent-markdown col {
                    width: var(--agent-markdown-table-column-width);
                }
                .agent-markdown .agent-markdown-table-compact-col {
                    width: clamp(4.75rem, var(--agent-markdown-table-column-width), 7rem);
                }
                .agent-markdown tr:last-child td {
                    border-bottom: 0;
                }
                .agent-markdown tbody tr:nth-child(even) {
                    background: transparent;
                }
                .agent-markdown tbody tr:hover {
                    background: transparent;
                }
            `}</style>

            {/* Workstream tabs are a debug affordance; Summary keeps the conversation surface quiet. */}
            {viewMode === 'stacked' && (
                <div className={cn('sticky top-0 z-10', hideWorkstreamTabs && 'hidden')}>
                    <WorkstreamTabs
                        workstreams={workstreams}
                        activeWorkstream={activeWorkstream}
                        onSelectWorkstream={handleSelectWorkstream}
                        count={workstreamCounts}
                        completionStatus={workstreamCompletionStatus}
                    />
                </div>
            )}

            {displayMessages.length === 0 &&
            !hasRenderableInitialRequest &&
            !(isSummaryView && showActivityFallback) ? (
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
                    {isSummaryView && activeWorkstream !== 'all' && activeWorkstreamName && (
                        <div className="sticky top-0 z-20 -mx-2 bg-background/95 px-2 pb-2 pt-1 backdrop-blur sm:-mx-4 sm:px-4">
                            <div className="mx-auto flex w-full max-w-3xl items-center gap-2 border-b border-border/70 pb-3">
                                <VTooltip description={t('agent.backToMainAgent')} asChild>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="size-8 shrink-0 text-muted hover:text-foreground"
                                        aria-label={t('agent.backToMainAgent')}
                                        onClick={handleShowMainAgentChat}
                                    >
                                        <ArrowLeft className="size-4" aria-hidden="true" />
                                    </Button>
                                </VTooltip>
                                <div className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                                    {activeWorkstreamName}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Friendly message — rendered outside the messages array to avoid memo issues/triggering autoscroll */}
                    {shouldRenderInitialRequest && (
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
                            timestamp={activityStartedTimestamp}
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
                                        <TimelineEntry key={getRenderableGroupKey(group)} status={group.toolStatus}>
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
                                        <TimelineEntry key={getRenderableGroupKey(group)}>
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
                                    if (shouldHideRequestInputMessage(message)) return null;
                                    if (shouldHideToolApprovalAnswerMessage(message)) return null;
                                    if (isUserStoppedMessage(message)) {
                                        return (
                                            <TimelineEntry key={getAgentMessageRenderKey(message, 'stopped')}>
                                                <SummaryStoppedMessage
                                                    message={message}
                                                    startTimestamp={
                                                        getPreviousRenderableGroupTimestamp(
                                                            groupedMessages,
                                                            groupIndex,
                                                        ) ?? message.timestamp
                                                    }
                                                    endTimestamp={message.timestamp}
                                                />
                                            </TimelineEntry>
                                        );
                                    }
                                    const isLatestMessage =
                                        !isCompleted && isLastGroup && !DONE_STATES.includes(message.type);

                                    // Special handling for batch progress messages
                                    if (isBatchProgressMessage(message)) {
                                        return (
                                            <MessageErrorBoundary
                                                key={`batch-${message.details.batch_id}-${message.timestamp}`}
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
                                        <TimelineEntry key={getAgentMessageRenderKey(message)} status="message">
                                            <MessageErrorBoundary>
                                                <MessageItem
                                                    {...messageItemClassNames}
                                                    message={message}
                                                    showPulsatingCircle={isLatestMessage}
                                                    onSendMessage={onSendMessage}
                                                    requestInputAnswered={isRequestInputAnswered(
                                                        message,
                                                        answeredRequestInputKeys,
                                                    )}
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
                            {summaryConversationItems.map((item) => {
                                if (item.type === 'work') {
                                    if (hideToolCallsInViewMode?.includes(viewMode)) return null;
                                    const isThinkingOnlyWork = isTransientThinkingWork(item.messages);

                                    return (
                                        <SummaryActivityRow
                                            key={`work-${item.id}-${item.isActive ? 'active' : 'done'}-${item.status}`}
                                            label={getSummaryActivityLabel(item.isActive)}
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
                                            disablePreambleCollapse={item.isActive}
                                            className={workingIndicatorClassName}
                                            onSendMessage={onSendMessage}
                                            answeredToolApprovalRequestInputKeys={answeredToolApprovalRequestInputKeys}
                                            resolvedToolApprovalKeys={resolvedToolApprovalKeys}
                                        />
                                    );
                                }

                                if (item.type === 'stopped') {
                                    return (
                                        <SummaryStoppedMessage
                                            key={getAgentMessageRenderKey(item.message, 'stopped-summary')}
                                            message={item.message}
                                            startTimestamp={item.startTimestamp}
                                            endTimestamp={item.endTimestamp}
                                        />
                                    );
                                }

                                const message = item.message;
                                if (shouldHideRequestInputMessage(message)) return null;
                                if (shouldHideToolApprovalAnswerMessage(message)) return null;
                                if (isBatchProgressMessage(message)) {
                                    return (
                                        <MessageErrorBoundary key={getAgentMessageRenderKey(message, 'batch')}>
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
                                    <MessageErrorBoundary key={getAgentMessageRenderKey(message, 'summary')}>
                                        <SummaryMessage
                                            message={message}
                                            onSendMessage={onSendMessage}
                                            onSelectWorkstream={handleSelectWorkstream}
                                            requestInputAnswered={isRequestInputAnswered(
                                                message,
                                                answeredRequestInputKeys,
                                            )}
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
                                    timestamp={activityStartedTimestamp}
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
