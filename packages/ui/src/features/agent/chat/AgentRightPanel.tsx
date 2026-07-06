import type { AgentMessage, ConversationFile, Plan } from '@vertesia/common';
import { FileProcessingStatus } from '@vertesia/common';
import {
    Badge,
    Button,
    Center,
    cn,
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    type Tab as TabDefinition,
    Tabs,
    TabsPanel,
    useToast,
} from '@vertesia/ui/core';
import { useUITranslation } from '@vertesia/ui/i18n';
import { useUserSession } from '@vertesia/ui/session';
import {
    CheckCircleIcon,
    ChevronDownIcon,
    ClipboardCopyIcon,
    DownloadCloudIcon,
    FileTextIcon,
    LayoutListIcon,
    Loader2Icon,
    XCircleIcon,
    XIcon,
} from 'lucide-react';
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ArtifactsTab } from './ArtifactsTab.js';
import { BrowserUseWidget, getLatestBrowserUseByWorkstream } from './BrowserUseWidget.js';
import { DocumentPanel } from './DocumentPanel.js';
import InlineSlidingPlanPanel from './ModernAgentOutput/InlineSlidingPlanPanel';
import { getConversationUrl } from './ModernAgentOutput/utils.js';
import type { OpenDocument } from './types/document.js';
import { formatWorkstreamName, getWorkstreamStatusClass, type WorkstreamInfo } from './workstreams.js';

export type { WorkstreamInfo } from './workstreams.js';

// ---------------------------------------------------------------------------
// UploadedDocuments (moved from WorkflowPayloadForm)
// ---------------------------------------------------------------------------

interface UploadedDocumentsProps {
    files?: Map<string, ConversationFile>;
}

function RightPanelEmptyState({ icon, children }: { icon?: React.ReactNode; children: React.ReactNode }) {
    return (
        <Center className="h-full min-h-[240px] flex-col text-center text-muted">
            {icon}
            <span className="text-sm">{children}</span>
        </Center>
    );
}

function UploadedDocumentsTab({ files }: UploadedDocumentsProps) {
    const { t } = useUITranslation();
    const filesArray = useMemo(() => {
        return files ? Array.from(files.values()) : [];
    }, [files]);

    const getStatusIcon = (status: FileProcessingStatus) => {
        switch (status) {
            case FileProcessingStatus.UPLOADING:
            case FileProcessingStatus.PROCESSING:
                return <Loader2Icon className="size-4 animate-spin text-info" />;
            case FileProcessingStatus.READY:
                return <CheckCircleIcon className="size-4 text-success" />;
            case FileProcessingStatus.ERROR:
                return <XCircleIcon className="size-4 text-destructive" />;
            default:
                return <FileTextIcon className="size-4 text-muted" />;
        }
    };

    const getStatusBadge = (status: FileProcessingStatus) => {
        switch (status) {
            case FileProcessingStatus.UPLOADING:
                return <Badge variant="info">{t('agent.uploading')}</Badge>;
            case FileProcessingStatus.PROCESSING:
                return <Badge variant="info">{t('agent.processing')}</Badge>;
            case FileProcessingStatus.READY:
                return <Badge variant="success">{t('agent.ready')}</Badge>;
            case FileProcessingStatus.ERROR:
                return <Badge variant="destructive">{t('agent.error')}</Badge>;
            default:
                return null;
        }
    };

    return (
        <div className="h-full min-h-0">
            {filesArray.length === 0 ? (
                <RightPanelEmptyState icon={<FileTextIcon className="mb-2 size-8" />}>
                    {t('agent.noFilesUploadedYet')}
                </RightPanelEmptyState>
            ) : (
                <div className="space-y-2 p-2">
                    {filesArray.map((file) => (
                        <div key={file.id} className="flex items-start gap-2 p-2 border border-muted rounded-md">
                            <div className="mt-0.5">{getStatusIcon(file.status)}</div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-2">
                                    <span className="text-sm font-medium truncate">{file.name}</span>
                                    {getStatusBadge(file.status)}
                                </div>
                                {file.error && <div className="text-xs text-destructive mt-1">{file.error}</div>}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

// ---------------------------------------------------------------------------
// Local error boundaries
// ---------------------------------------------------------------------------

interface RightPanelErrorBoundaryProps {
    children: React.ReactNode;
    title: string;
    description: string;
    compact?: boolean;
}

interface RightPanelErrorBoundaryState {
    hasError: boolean;
    message?: string;
}

class RightPanelErrorBoundary extends React.Component<RightPanelErrorBoundaryProps, RightPanelErrorBoundaryState> {
    state: RightPanelErrorBoundaryState = { hasError: false };

    static getDerivedStateFromError(error: unknown): RightPanelErrorBoundaryState {
        return {
            hasError: true,
            message: error instanceof Error ? error.message : String(error),
        };
    }

    componentDidCatch(error: unknown, errorInfo: React.ErrorInfo) {
        console.error('Agent right panel section failed to render', {
            error,
            componentStack: errorInfo.componentStack,
        });
    }

    render() {
        if (!this.state.hasError) return this.props.children;

        return (
            <div
                className={cn(
                    'rounded-md border border-destructive bg-mixer-destructive/10 text-destructive',
                    this.props.compact ? 'p-2 text-xs' : 'm-3 p-3 text-sm',
                )}
            >
                <div className="font-medium">{this.props.title}</div>
                <div className="mt-1 text-xs text-muted">{this.props.description}</div>
                {this.state.message && (
                    <div className="mt-1 break-all text-[11px] text-muted">{this.state.message}</div>
                )}
            </div>
        );
    }
}

// ---------------------------------------------------------------------------
// Workstreams tab
// ---------------------------------------------------------------------------

interface WorkstreamsTabProps {
    workstreams: WorkstreamInfo[];
    messages: AgentMessage[];
    runId?: string;
}

function WorkstreamsTab({ workstreams, messages, runId }: WorkstreamsTabProps) {
    const { t } = useUITranslation();
    const { client } = useUserSession();
    const toast = useToast();
    const browserUseByWorkstream = useMemo(() => getLatestBrowserUseByWorkstream(messages), [messages]);
    const renderErrorDescription = t('agent.panelRenderErrorDescription');

    const copyRunId = useCallback(
        (runId: string) => {
            navigator.clipboard.writeText(runId);
            toast({ status: 'success', title: t('agent.runIdCopied'), duration: 2000 });
        },
        [t, toast],
    );

    const downloadConversation = useCallback(
        async (runId: string) => {
            try {
                const url = await getConversationUrl(client, runId);
                if (url) window.open(url, '_blank');
            } catch {
                toast({ status: 'error', title: t('agent.failedToDownload') });
            }
        },
        [client, t, toast],
    );

    if (workstreams.length === 0) {
        return (
            <RightPanelEmptyState icon={<LayoutListIcon className="mb-2 size-8" />}>
                {t('agent.noActiveParallelTasks')}
            </RightPanelEmptyState>
        );
    }

    return (
        <div className="h-full min-h-0 overflow-y-auto px-2 py-2">
            <div className="px-1 pb-2 text-xs text-muted">{t('agent.parallelWorkDescription')}</div>
            <div className="divide-y divide-border/60">
                {workstreams.map((ws) => {
                    const isActive = ws.status === 'running' || ws.status === 'canceling';
                    const elapsed = Math.round(ws.elapsed_ms / 1000);
                    const remaining = Math.max(0, Math.round(ws.remaining_ms / 1000));
                    const progress =
                        ws.deadline_ms > 0 ? Math.min(100, Math.round((ws.elapsed_ms / ws.deadline_ms) * 100)) : 0;
                    const browserUse = browserUseByWorkstream.get(ws.workstream_id);
                    const hasDeadline = ws.deadline_ms > 0;
                    const childRunId = ws.child_workflow_run_id;
                    const meta = [
                        ws.phase ? formatWorkstreamName(ws.phase) : undefined,
                        elapsed > 0 ? t('agent.elapsed', { seconds: elapsed }) : undefined,
                        hasDeadline && remaining > 0 ? t('agent.remaining', { seconds: remaining }) : undefined,
                    ].filter(Boolean);

                    const statusBadge = (() => {
                        switch (ws.status) {
                            case 'running':
                                return <Badge variant="info">{t('agent.running')}</Badge>;
                            case 'canceling':
                                return <Badge variant="attention">{t('agent.canceling')}</Badge>;
                            case 'completed':
                                return <Badge variant="done">{t('agent.completed')}</Badge>;
                            case 'failed':
                                return <Badge variant="destructive">{t('agent.failed')}</Badge>;
                            case 'timeout':
                                return <Badge variant="destructive">{t('agent.timeout')}</Badge>;
                            case 'canceled':
                                return <Badge variant="destructive">{t('agent.canceled')}</Badge>;
                        }
                    })();

                    return (
                        <RightPanelErrorBoundary
                            key={ws.launch_id}
                            title={t('agent.workstreamRenderError')}
                            description={renderErrorDescription}
                            compact
                        >
                            <div className="py-3">
                                <div className="flex items-start gap-2">
                                    <span
                                        className={cn(
                                            'mt-2 size-2 shrink-0 rounded-full',
                                            getWorkstreamStatusClass(ws.status),
                                        )}
                                        aria-hidden="true"
                                    />
                                    <div className="min-w-0 flex-1">
                                        <div className="flex min-w-0 items-center justify-between gap-2">
                                            <span
                                                className="min-w-0 truncate text-sm font-medium text-foreground"
                                                title={ws.workstream_id}
                                            >
                                                {formatWorkstreamName(ws.workstream_id)}
                                            </span>
                                            {statusBadge}
                                        </div>

                                        {meta.length > 0 && (
                                            <div className="mt-0.5 truncate text-xs text-muted">{meta.join(' · ')}</div>
                                        )}

                                        {isActive && hasDeadline && (
                                            <div
                                                className="mt-2 h-1 rounded-full bg-muted"
                                                role="progressbar"
                                                aria-valuemin={0}
                                                aria-valuemax={100}
                                                aria-valuenow={progress}
                                                aria-valuetext={t('agent.workstreamProgress', {
                                                    percent: progress,
                                                })}
                                            >
                                                <div
                                                    className="h-full rounded-full bg-info transition-all duration-500"
                                                    style={{ width: `${progress}%` }}
                                                />
                                            </div>
                                        )}

                                        {browserUse && (
                                            <RightPanelErrorBoundary
                                                title={t('agent.browserWidgetRenderError')}
                                                description={renderErrorDescription}
                                                compact
                                            >
                                                <BrowserUseWidget
                                                    state={browserUse}
                                                    runId={runId}
                                                    compact
                                                    className="mt-2"
                                                />
                                            </RightPanelErrorBoundary>
                                        )}

                                        {childRunId && (
                                            <div className="mt-2 flex flex-wrap gap-1">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-7 px-2 text-xs text-muted hover:text-foreground"
                                                    onClick={() => copyRunId(childRunId)}
                                                >
                                                    <ClipboardCopyIcon className="size-3 me-1" />
                                                    {t('agent.copyRunId')}
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-7 px-2 text-xs text-muted hover:text-foreground"
                                                    onClick={() => downloadConversation(childRunId)}
                                                >
                                                    <DownloadCloudIcon className="size-3 me-1" />
                                                    {t('agent.download')}
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </RightPanelErrorBoundary>
                    );
                })}
            </div>
        </div>
    );
}

// ---------------------------------------------------------------------------
// Overflow tab bar
// ---------------------------------------------------------------------------

// Tab-item styling, matching core's TabsTrigger underline tabs.
const TAB_ITEM_BASE =
    'flex items-center border-b-2 px-2 py-1.5 text-sm font-medium whitespace-nowrap cursor-pointer shrink-0';
const TAB_ITEM_INACTIVE = 'border-transparent text-muted-foreground hover:border-border hover:text-foreground';
const TAB_ITEM_ACTIVE = 'border-primary text-primary';
const TAB_GAP_PX = 4; // matches the `gap-1` between tab items

interface OverflowMoreMenuProps {
    /** The overflowed tabs to list inside the menu. */
    tabs: TabDefinition[];
    current: string;
    onTabChange: (name: string) => void;
    label: string;
    /** Whether the active tab is one of the overflowed tabs. */
    active: boolean;
}

/** Trailing "More" dropdown of overflowed tabs; opens on hover, click, or keyboard. */
function OverflowMoreMenu({ tabs, current, onTabChange, label, active }: OverflowMoreMenuProps) {
    const [open, setOpen] = useState(false);
    const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const openedByHover = useRef(false);

    const cancelClose = () => {
        if (closeTimer.current) {
            clearTimeout(closeTimer.current);
            closeTimer.current = null;
        }
    };
    const openOnHover = () => {
        cancelClose();
        openedByHover.current = true;
        setOpen(true);
    };
    // Delay the close so the pointer can travel across the gap onto the menu.
    const closeAfterDelay = () => {
        cancelClose();
        closeTimer.current = setTimeout(() => setOpen(false), 150);
    };

    // Clear any pending close timer on unmount.
    useEffect(() => () => clearTimeout(closeTimer.current ?? undefined), []);

    return (
        // Non-modal: a modal menu sets body `pointer-events: none` while open, which makes
        // the hover open/close flap. It still closes on outside-click / Escape.
        <DropdownMenu
            modal={false}
            open={open}
            onOpenChange={(next) => {
                // Fired by click / keyboard / dismiss (not by hover); keep our state in sync.
                cancelClose();
                if (next) openedByHover.current = false;
                setOpen(next);
            }}
        >
            <DropdownMenuTrigger asChild>
                {/* Tab-bar primitive: raw button is the menu trigger (asChild). */}
                <button
                    type="button"
                    onMouseEnter={openOnHover}
                    onMouseLeave={closeAfterDelay}
                    className={cn(TAB_ITEM_BASE, active ? TAB_ITEM_ACTIVE : TAB_ITEM_INACTIVE)}
                >
                    {label}
                    <ChevronDownIcon className="ms-1 size-4" />
                </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
                align="end"
                className="w-max"
                onMouseEnter={cancelClose}
                onMouseLeave={closeAfterDelay}
                onCloseAutoFocus={(e) => {
                    // Keep hover-opens from returning the focus ring to the trigger.
                    if (openedByHover.current) e.preventDefault();
                }}
            >
                {tabs.map((tab) => (
                    <DropdownMenuItem
                        key={tab.name}
                        disabled={tab.disabled}
                        onClick={() => onTabChange(tab.name)}
                        className={cn(tab.name === current && 'text-primary')}
                    >
                        {tab.label}
                    </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

interface OverflowTabsBarProps {
    tabs: TabDefinition[];
    current: string;
    onTabChange: (name: string) => void;
    className?: string;
}

/**
 * Tabs as a horizontal row; any that don't fit collapse into a trailing "More"
 * dropdown. The visible/overflow split is measured from a hidden full-width row.
 */
function OverflowTabsBar({ tabs, current, onTabChange, className }: OverflowTabsBarProps) {
    const { t } = useUITranslation();
    const containerRef = useRef<HTMLDivElement | null>(null);
    const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);
    const moreRef = useRef<HTMLButtonElement | null>(null);
    // `count` leading tabs are shown. When `promote` is set, the active tab is pulled
    // into the last slot (before More) and `count` counts the tabs shown before it.
    const [layout, setLayout] = useState<{ count: number; promote: boolean }>({ count: tabs.length, promote: false });

    const recompute = () => {
        const container = containerRef.current;
        if (!container) return;
        const containerWidth = container.clientWidth;
        const widths = tabs.map((_, i) => itemRefs.current[i]?.offsetWidth ?? 0);
        const totalAll = widths.reduce((sum, w) => sum + w, 0) + TAB_GAP_PX * Math.max(0, tabs.length - 1);

        // How many tabs (in order, optionally skipping one) fit within `available`.
        const fitCount = (available: number, skipIndex: number) => {
            let used = 0;
            let count = 0;
            for (let i = 0; i < tabs.length; i++) {
                if (i === skipIndex) continue;
                const cand = used + (count > 0 ? TAB_GAP_PX : 0) + widths[i];
                if (cand > available) break;
                used = cand;
                count += 1;
            }
            return count;
        };

        let next: { count: number; promote: boolean };
        if (totalAll <= containerWidth) {
            next = { count: tabs.length, promote: false };
        } else {
            const moreWidth = moreRef.current?.offsetWidth ?? 0;
            const naturalCount = Math.max(1, fitCount(containerWidth - moreWidth - TAB_GAP_PX, -1));
            const activeIndex = tabs.findIndex((tab) => tab.name === current);
            if (activeIndex < 0 || activeIndex < naturalCount) {
                next = { count: naturalCount, promote: false };
            } else {
                // Active tab overflowed: reserve its slot at the end, fit leading tabs before it.
                const leadAvailable = containerWidth - moreWidth - widths[activeIndex] - TAB_GAP_PX * 2;
                next = { count: fitCount(leadAvailable, activeIndex), promote: true };
            }
        }
        setLayout((prev) => (prev.count === next.count && prev.promote === next.promote ? prev : next));
    };

    // Re-measure after every render (tab/label changes) and on container resize.
    const recomputeRef = useRef(recompute);
    recomputeRef.current = recompute;
    useLayoutEffect(() => {
        recomputeRef.current();
    });
    useEffect(() => {
        const container = containerRef.current;
        if (!container || typeof ResizeObserver === 'undefined') return;
        const observer = new ResizeObserver(() => recomputeRef.current());
        observer.observe(container);
        return () => observer.disconnect();
    }, []);

    const activeIndex = tabs.findIndex((tab) => tab.name === current);
    let visible: TabDefinition[];
    let overflow: TabDefinition[];
    if (layout.promote && activeIndex >= 0) {
        // Pull the active tab into the last visible slot; the tab it displaces overflows.
        const others = tabs.filter((_, i) => i !== activeIndex);
        visible = [...others.slice(0, layout.count), tabs[activeIndex]];
        overflow = others.slice(layout.count);
    } else {
        visible = tabs.slice(0, layout.count);
        overflow = tabs.slice(layout.count);
    }
    const activeInOverflow = overflow.some((tab) => tab.name === current);
    const moreLabel = t('agent.moreTabs');

    return (
        <div ref={containerRef} className={cn('relative', className)}>
            {/* Hidden measurement row: all tabs + More at natural width, kept separate
                from the visible row so measuring can't feed back into the layout. */}
            <div aria-hidden className="pointer-events-none invisible absolute start-0 top-0 flex w-max gap-1">
                {tabs.map((tab, i) => (
                    <button
                        type="button"
                        key={tab.name}
                        tabIndex={-1}
                        ref={(el) => {
                            itemRefs.current[i] = el;
                        }}
                        className={cn(TAB_ITEM_BASE, TAB_ITEM_INACTIVE)}
                    >
                        {tab.label}
                    </button>
                ))}
                <button type="button" tabIndex={-1} ref={moreRef} className={cn(TAB_ITEM_BASE, TAB_ITEM_INACTIVE)}>
                    {moreLabel}
                    <ChevronDownIcon className="ms-1 size-4" />
                </button>
            </div>

            {/* Visible row */}
            <div className="-mb-px flex gap-1 overflow-hidden border-b">
                {visible.map((tab) => {
                    const isActive = tab.name === current;
                    return (
                        // Tab-bar primitive: raw button mirrors core TabsTrigger underline styling.
                        <button
                            type="button"
                            key={tab.name}
                            aria-current={isActive ? 'page' : undefined}
                            disabled={tab.disabled}
                            onClick={() => onTabChange(tab.name)}
                            className={cn(
                                TAB_ITEM_BASE,
                                isActive ? TAB_ITEM_ACTIVE : TAB_ITEM_INACTIVE,
                                'disabled:pointer-events-none disabled:opacity-50',
                            )}
                        >
                            {tab.label}
                        </button>
                    );
                })}

                {overflow.length > 0 && (
                    <OverflowMoreMenu
                        tabs={overflow}
                        current={current}
                        onTabChange={onTabChange}
                        label={moreLabel}
                        active={activeInOverflow}
                    />
                )}
            </div>
        </div>
    );
}

// ---------------------------------------------------------------------------
// Right panel tabs
// ---------------------------------------------------------------------------

type RightPanelTab = 'plan' | 'workstreams' | 'documents' | 'uploads' | 'artifacts' | 'payload' | 'conversation';

export interface AgentRightPanelProps {
    /** Optional payload content to show as a "Payload" tab */
    payloadContent?: React.ReactNode;
    /** Optional conversation content to show as a "Conversation" tab */
    conversationContent?: React.ReactNode;
    // Plan
    plan?: Plan;
    workstreamStatus?: Map<string, 'pending' | 'in_progress' | 'completed' | 'skipped'>;
    plans?: Array<{ plan: Plan; timestamp: number }>;
    activePlanIndex?: number;
    onChangePlan?: (index: number) => void;
    showPlan?: boolean;

    // Workstreams
    activeWorkstreams?: WorkstreamInfo[];
    messages?: AgentMessage[];
    hideWorkstreams?: boolean;

    // Documents
    openDocuments?: OpenDocument[];
    activeDocumentId?: string | null;
    onSelectDocument?: (id: string) => void;
    onCloseDocument?: (id: string) => void;
    onUpdateDocumentTitle?: (id: string, title: string) => void;
    docRefreshKey?: number;
    runId?: string;

    // Uploads
    processingFiles?: Map<string, ConversationFile>;

    // Artifacts
    /** Show the Artifacts tab (opt-in, default false) */
    showArtifacts?: boolean;
    artifactRefreshKey?: number;
    /** Open a markdown artifact in the document editor (used by the Artifacts tab). */
    onOpenDocument?: (path: string, name: string) => void;

    // Panel control
    onClose: () => void;
    /** Which tab to auto-activate when panel opens */
    defaultTab?: RightPanelTab;
    /** Controlled active tab (overrides internal state when provided) */
    activeTab?: RightPanelTab;
    /** Callback when the active tab changes */
    onTabChange?: (tab: RightPanelTab) => void;
}

function AgentRightPanelComponent({
    // Plan
    plan,
    workstreamStatus,
    plans = [],
    activePlanIndex = 0,
    onChangePlan,

    // Workstreams
    activeWorkstreams = [],
    messages = [],
    hideWorkstreams = false,

    // Documents
    openDocuments = [],
    activeDocumentId,
    onSelectDocument,
    onCloseDocument,
    onUpdateDocumentTitle,
    docRefreshKey = 0,
    runId,

    // Uploads
    processingFiles,

    // Artifacts
    showArtifacts = false,
    artifactRefreshKey = 0,
    onOpenDocument,

    // Payload
    payloadContent,

    // Conversation
    conversationContent,

    // Panel
    onClose,
    defaultTab,
    activeTab: activeTabProp,
    onTabChange,
}: AgentRightPanelProps) {
    const { t } = useUITranslation();
    const [internalActiveTab, setInternalActiveTab] = useState<RightPanelTab>(defaultTab || 'plan');
    const activeTab = activeTabProp ?? internalActiveTab;
    const handleTabChange = (name: string) => {
        setInternalActiveTab(name as RightPanelTab);
        onTabChange?.(name as RightPanelTab);
    };

    // Determine which tabs have content (for badges/indicators)
    const hasWorkstreams = !hideWorkstreams && activeWorkstreams.length > 0;
    const hasDocuments = openDocuments.length > 0;
    const hasUploads = processingFiles ? processingFiles.size > 0 : false;
    const withTabBoundary = useCallback(
        (name: string, content: React.ReactNode) => (
            <RightPanelErrorBoundary
                title={t('agent.panelRenderError', { name })}
                description={t('agent.panelRenderErrorDescription')}
            >
                {content}
            </RightPanelErrorBoundary>
        ),
        [t],
    );

    const conversationTab: TabDefinition = {
        name: 'conversation',
        label: 'Conversation',
        content: conversationContent
            ? withTabBoundary('Conversation', <div className="flex flex-col h-full min-h-0">{conversationContent}</div>)
            : null,
        is_allowed: !!conversationContent,
    };

    const tabs: TabDefinition[] = [
        ...(conversationContent ? [conversationTab] : []),
        {
            name: 'plan',
            label: t('agent.plan'),
            content: withTabBoundary(
                t('agent.plan'),
                plan ? (
                    <InlineSlidingPlanPanel
                        plan={plan}
                        workstreamStatus={workstreamStatus || new Map()}
                        isOpen={true}
                        onClose={onClose}
                        plans={plans}
                        activePlanIndex={activePlanIndex}
                        onChangePlan={onChangePlan}
                    />
                ) : (
                    <RightPanelEmptyState icon={<LayoutListIcon className="mb-2 size-8" />}>
                        {t('agent.noPlanAvailable')}
                    </RightPanelEmptyState>
                ),
            ),
            is_allowed: true,
        },
        {
            name: 'workstreams',
            label: hasWorkstreams ? (
                <span className="inline-flex min-w-0 items-center gap-1 whitespace-nowrap">
                    {t('agent.workstreams')}{' '}
                    <span className="inline-flex shrink-0 items-center justify-center rounded-full bg-info px-1.5 py-0.5 text-[10px] text-info">
                        {activeWorkstreams.length}
                    </span>
                </span>
            ) : (
                t('agent.workstreams')
            ),
            content: withTabBoundary(
                t('agent.workstreams'),
                <WorkstreamsTab workstreams={activeWorkstreams} messages={messages} runId={runId} />,
            ),
            is_allowed: !hideWorkstreams,
        },
        {
            name: 'documents',
            label: hasDocuments ? (
                <span className="inline-flex min-w-0 items-center gap-1 whitespace-nowrap">
                    {t('agent.documents')}{' '}
                    <span className="inline-flex shrink-0 items-center justify-center rounded-full bg-info px-1.5 py-0.5 text-[10px] text-info">
                        {openDocuments.length}
                    </span>
                </span>
            ) : (
                t('agent.documents')
            ),
            content: withTabBoundary(
                t('agent.documents'),
                openDocuments.length > 0 && onSelectDocument && onCloseDocument ? (
                    <DocumentPanel
                        isOpen={true}
                        documents={openDocuments}
                        activeDocumentId={activeDocumentId ?? null}
                        onSelectDocument={onSelectDocument}
                        onCloseDocument={onCloseDocument}
                        onUpdateDocumentTitle={onUpdateDocumentTitle}
                        refreshKey={docRefreshKey}
                        runId={runId}
                    />
                ) : (
                    <RightPanelEmptyState icon={<FileTextIcon className="mb-2 size-8" />}>
                        {t('agent.noDocumentsOpen')}
                    </RightPanelEmptyState>
                ),
            ),
            is_allowed: true,
        },
        {
            name: 'uploads',
            label: hasUploads ? (
                <span className="inline-flex min-w-0 items-center gap-1 whitespace-nowrap">
                    {t('agent.uploads')} <span className="inline-block w-1.5 h-1.5 rounded-full bg-info" />
                </span>
            ) : (
                t('agent.uploads')
            ),
            content: withTabBoundary(t('agent.uploads'), <UploadedDocumentsTab files={processingFiles} />),
            is_allowed: true,
        },
        {
            name: 'artifacts',
            label: t('agent.artifacts'),
            content: withTabBoundary(
                t('agent.artifacts'),
                <ArtifactsTab runId={runId} refreshKey={artifactRefreshKey} onOpenDocument={onOpenDocument} />,
            ),
            is_allowed: showArtifacts,
        },
        {
            name: 'payload',
            label: t('agent.payload'),
            content: payloadContent
                ? withTabBoundary(t('agent.payload'), <div className="overflow-y-auto">{payloadContent}</div>)
                : null,
            is_allowed: !!payloadContent,
        },
    ];

    const visibleTabs = tabs.filter((tab) => tab.is_allowed === undefined || tab.is_allowed === true);
    return (
        <Tabs tabs={tabs} current={activeTab} onTabChange={handleTabChange} fullHeight className="px-0">
            <div className="flex items-end justify-between shrink-0 px-1 py-1 gap-1">
                <OverflowTabsBar
                    tabs={visibleTabs}
                    current={activeTab}
                    onTabChange={handleTabChange}
                    className="min-w-0 flex-1"
                />
                {!conversationContent && (
                    <Button
                        variant="ghost"
                        size="sm"
                        className="shrink-0 ms-1"
                        onClick={onClose}
                        title="Close Right Panel"
                    >
                        <XIcon className="size-4" />
                    </Button>
                )}
            </div>
            <TabsPanel className="flex-1 min-h-0 pt-0 pb-0" />
        </Tabs>
    );
}

export const AgentRightPanel = React.memo(AgentRightPanelComponent);
