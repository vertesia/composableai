import type { AgentMessage, ConversationFile, Plan } from '@vertesia/common';
import { FileProcessingStatus } from '@vertesia/common';
import { Badge, Button, cn, SelectBox, type Tab as TabDefinition, Tabs, TabsPanel, useToast } from '@vertesia/ui/core';
import { useUITranslation } from '@vertesia/ui/i18n';
import { useUserSession } from '@vertesia/ui/session';
import {
    CheckCircleIcon,
    ClipboardCopyIcon,
    DownloadCloudIcon,
    FileTextIcon,
    LayoutListIcon,
    Loader2Icon,
    XCircleIcon,
    XIcon,
} from 'lucide-react';
import React, { useCallback, useMemo, useState } from 'react';
import { ArtifactsTab } from './ArtifactsTab.js';
import { BrowserUseWidget, getLatestBrowserUseByWorkstream } from './BrowserUseWidget.js';
import { DocumentPanel } from './DocumentPanel.js';
import InlineSlidingPlanPanel from './ModernAgentOutput/InlineSlidingPlanPanel';
import { getConversationUrl } from './ModernAgentOutput/utils.js';
import type { OpenDocument } from './types/document.js';

// ---------------------------------------------------------------------------
// Workstream list types
// ---------------------------------------------------------------------------

export interface WorkstreamInfo {
    workstream_id: string;
    launch_id: string;
    elapsed_ms: number;
    deadline_ms: number;
    remaining_ms: number;
    status: 'running' | 'canceling' | 'completed' | 'canceled';
    phase?: string;
    child_workflow_id?: string;
    child_workflow_run_id?: string;
}

// ---------------------------------------------------------------------------
// UploadedDocuments (moved from WorkflowPayloadForm)
// ---------------------------------------------------------------------------

interface UploadedDocumentsProps {
    files?: Map<string, ConversationFile>;
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
        <div className="">
            {filesArray.length === 0 ? (
                <div className="flex flex-col items-center justify-center text-sm text-muted text-center py-8">
                    <FileTextIcon className="size-8 mb-2" />
                    {t('agent.noFilesUploadedYet')}
                </div>
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
            <div className="flex flex-col items-center justify-center py-8 text-muted">
                <LayoutListIcon className="size-8 mb-2" />
                <span className="text-sm">{t('agent.noActiveWorkstreams')}</span>
            </div>
        );
    }

    return (
        <div className="p-3 space-y-2">
            {workstreams.map((ws) => {
                const isActive = ws.status === 'running' || ws.status === 'canceling';
                const elapsed = Math.round(ws.elapsed_ms / 1000);
                const remaining = Math.round(ws.remaining_ms / 1000);
                const progress =
                    ws.deadline_ms > 0 ? Math.min(100, Math.round((ws.elapsed_ms / ws.deadline_ms) * 100)) : 0;
                const browserUse = browserUseByWorkstream.get(ws.workstream_id);

                const statusBadge =
                    ws.status === 'running' ? (
                        <Badge variant="info">{ws.phase || 'running'}</Badge>
                    ) : ws.status === 'canceling' ? (
                        <Badge variant="attention">canceling</Badge>
                    ) : ws.status === 'completed' ? (
                        <Badge variant="done">{t('agent.completed')}</Badge>
                    ) : (
                        <Badge variant="destructive">{t('agent.canceled')}</Badge>
                    );

                return (
                    <RightPanelErrorBoundary
                        key={ws.launch_id}
                        title={t('agent.workstreamRenderError')}
                        description={renderErrorDescription}
                        compact
                    >
                        <div className="p-3 border rounded-md space-y-2">
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-medium truncate">{ws.workstream_id}</span>
                                {statusBadge}
                            </div>
                            {/* Progress bar — only for active workstreams */}
                            {isActive && (
                                <>
                                    <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-info rounded-full transition-all duration-500"
                                            style={{ width: `${progress}%` }}
                                        />
                                    </div>
                                    <div className="flex justify-between text-xs text-muted">
                                        <span>{t('agent.elapsed', { seconds: elapsed })}</span>
                                        <span>{t('agent.remaining', { seconds: remaining })}</span>
                                    </div>
                                </>
                            )}
                            {browserUse && (
                                <RightPanelErrorBoundary
                                    title={t('agent.browserWidgetRenderError')}
                                    description={renderErrorDescription}
                                    compact
                                >
                                    <BrowserUseWidget state={browserUse} runId={runId} />
                                </RightPanelErrorBoundary>
                            )}
                            {/* Actions */}
                            {ws.child_workflow_run_id && (
                                <div className="flex gap-1 pt-1 border-t border-muted">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="text-xs h-7 px-2 text-muted hover:text-foreground"
                                        // biome-ignore lint/style/noNonNullAssertion: intentional non-null assertion; TS can't prove narrowing here
                                        onClick={() => copyRunId(ws.child_workflow_run_id!)}
                                    >
                                        <ClipboardCopyIcon className="size-3 me-1" />
                                        {t('agent.copyRunId')}
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="text-xs h-7 px-2 text-muted hover:text-foreground"
                                        // biome-ignore lint/style/noNonNullAssertion: intentional non-null assertion; TS can't prove narrowing here
                                        onClick={() => downloadConversation(ws.child_workflow_run_id!)}
                                    >
                                        <DownloadCloudIcon className="size-3 me-1" />
                                        {t('agent.download')}
                                    </Button>
                                </div>
                            )}
                        </div>
                    </RightPanelErrorBoundary>
                );
            })}
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
    showPlan,

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
    const hasPlan = showPlan && plan;
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
            label: hasPlan ? (
                <span className="flex items-center gap-1">
                    {t('agent.plan')} <span className="inline-block w-1.5 h-1.5 rounded-full bg-info" />
                </span>
            ) : (
                t('agent.plan')
            ),
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
                    <div className="flex flex-col items-center justify-center py-8 text-muted">
                        <span className="text-sm">{t('agent.noPlanAvailable')}</span>
                    </div>
                ),
            ),
            is_allowed: true,
        },
        {
            name: 'workstreams',
            label: hasWorkstreams ? (
                <span className="flex items-center gap-1">
                    {t('agent.workstreams')}{' '}
                    <span className="inline-flex items-center justify-center px-1.5 py-0.5 text-[10px] rounded-full bg-info text-info">
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
                <span className="flex items-center gap-1">
                    {t('agent.documents')}{' '}
                    <span className="inline-flex items-center justify-center px-1.5 py-0.5 text-[10px] rounded-full bg-info text-info">
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
                    <div className="flex flex-col items-center justify-center py-8 text-muted">
                        <FileTextIcon className="size-8 mb-2" />
                        <span className="text-sm">{t('agent.noDocumentsOpen')}</span>
                    </div>
                ),
            ),
            is_allowed: true,
        },
        {
            name: 'uploads',
            label: hasUploads ? (
                <span className="flex items-center gap-1">
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
                <ArtifactsTab runId={runId} refreshKey={artifactRefreshKey} />,
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
    const currentTab = visibleTabs.find((tab) => tab.name === activeTab);

    return (
        <Tabs tabs={tabs} current={activeTab} onTabChange={handleTabChange} fullHeight className="px-0">
            <div className="flex items-center border-b shrink-0 px-1 py-1 gap-1">
                <div className="flex-1 min-w-0">
                    <SelectBox<TabDefinition>
                        label="Select Options"
                        options={visibleTabs}
                        value={currentTab}
                        onChange={(tab) => tab && handleTabChange(tab.name)}
                        optionLabel={(tab) => tab.label}
                        by="name"
                    />
                </div>
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
            <TabsPanel className="pt-0" />
        </Tabs>
    );
}

export const AgentRightPanel = React.memo(AgentRightPanelComponent);
