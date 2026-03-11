import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Badge, Button, useToast, Tabs, TabsBar, TabsPanel, type Tab as TabDefinition } from '@vertesia/ui/core';
import { useUITranslation } from '../../../i18n/index.js';
import {
    CheckCircleIcon,
    ClipboardCopyIcon,
    DownloadCloudIcon,
    FileTextIcon,
    Loader2Icon,
    LayoutListIcon,
    XCircleIcon,
    XIcon,
} from 'lucide-react';
import { FileProcessingStatus } from '@vertesia/common';
import type { Plan, ConversationFile, AgentMessage } from '@vertesia/common';
import { useUserSession } from '@vertesia/ui/session';
import InlineSlidingPlanPanel from './ModernAgentOutput/InlineSlidingPlanPanel';
import { getConversationUrl } from './ModernAgentOutput/utils.js';
import { DocumentPanel } from './DocumentPanel.js';
import { ArtifactsTab } from './ArtifactsTab.js';
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
    status: 'running' | 'canceling';
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
        <div className="p-3">
            {filesArray.length === 0 ? (
                <div className="text-sm text-muted text-center py-8">
                    {t('agent.noFilesUploadedYet')}
                </div>
            ) : (
                <div className="space-y-2">
                    {filesArray.map((file) => (
                        <div
                            key={file.id}
                            className="flex items-start gap-2 p-2 border border-muted rounded-md"
                        >
                            <div className="mt-0.5">{getStatusIcon(file.status)}</div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-2">
                                    <span className="text-sm font-medium truncate">
                                        {file.name}
                                    </span>
                                    {getStatusBadge(file.status)}
                                </div>
                                {file.error && (
                                    <div className="text-xs text-destructive mt-1">
                                        {file.error}
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

// ---------------------------------------------------------------------------
// Workstreams tab
// ---------------------------------------------------------------------------

interface WorkstreamsTabProps {
    workstreams: WorkstreamInfo[];
    messages: AgentMessage[];
    runId?: string;
}

function WorkstreamsTab({ workstreams }: WorkstreamsTabProps) {
    const { t } = useUITranslation();
    const { client } = useUserSession();
    const toast = useToast();

    const copyRunId = useCallback((runId: string) => {
        navigator.clipboard.writeText(runId);
        toast({ status: 'success', title: t('agent.runIdCopied'), duration: 2000 });
    }, [toast]);

    const downloadConversation = useCallback(async (runId: string) => {
        try {
            const url = await getConversationUrl(client, runId);
            if (url) window.open(url, '_blank');
        } catch {
            toast({ status: 'error', title: t('agent.failedToDownload') });
        }
    }, [client, toast]);

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
                const elapsed = Math.round(ws.elapsed_ms / 1000);
                const remaining = Math.round(ws.remaining_ms / 1000);
                const progress = ws.deadline_ms > 0
                    ? Math.min(100, Math.round((ws.elapsed_ms / ws.deadline_ms) * 100))
                    : 0;

                return (
                    <div
                        key={ws.launch_id}
                        className="p-3 border rounded-md space-y-2"
                    >
                        <div className="flex items-center justify-between">
                            <span className="text-sm font-medium truncate">
                                {ws.workstream_id}
                            </span>
                            <Badge variant={ws.status === 'running' ? 'info' : 'attention'}>
                                {ws.status === 'running' ? (ws.phase || 'running') : 'canceling'}
                            </Badge>
                        </div>
                        {/* Progress bar */}
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
                        {/* Actions */}
                        {ws.child_workflow_run_id && (
                            <div className="flex gap-1 pt-1 border-t border-muted">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-xs h-7 px-2 text-muted hover:text-foreground"
                                    onClick={() => copyRunId(ws.child_workflow_run_id!)}
                                >
                                    <ClipboardCopyIcon className="size-3 mr-1" />
                                    {t('agent.copyRunId')}
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-xs h-7 px-2 text-muted hover:text-foreground"
                                    onClick={() => downloadConversation(ws.child_workflow_run_id!)}
                                >
                                    <DownloadCloudIcon className="size-3 mr-1" />
                                    {t('agent.download')}
                                </Button>
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}

// ---------------------------------------------------------------------------
// Right panel tabs
// ---------------------------------------------------------------------------

type RightPanelTab = 'plan' | 'workstreams' | 'documents' | 'uploads' | 'artifacts' | 'payload';

export interface AgentRightPanelProps {
    /** Optional payload content to show as a "Payload" tab */
    payloadContent?: React.ReactNode;
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
    docRefreshKey = 0,
    runId,

    // Uploads
    processingFiles,

    // Artifacts
    showArtifacts = false,
    artifactRefreshKey = 0,

    // Payload
    payloadContent,

    // Panel
    onClose,
    defaultTab,
}: AgentRightPanelProps) {
    const { t } = useUITranslation();
    const [activeTab, setActiveTab] = useState<RightPanelTab>(defaultTab || 'plan');

    // Auto-switch to relevant tab when content appears
    useEffect(() => {
        if (defaultTab) {
            setActiveTab(defaultTab);
        }
    }, [defaultTab]);

    // Determine which tabs have content (for badges/indicators)
    const hasWorkstreams = !hideWorkstreams && activeWorkstreams.length > 0;
    const hasDocuments = openDocuments.length > 0;
    const hasUploads = processingFiles ? processingFiles.size > 0 : false;
    const hasPlan = showPlan && plan;

    const handleCloseDocPanel = useCallback(() => {
        setActiveTab('plan');
    }, []);

    const tabs: TabDefinition[] = [
        {
            name: 'plan',
            label: hasPlan
                ? <span className="flex items-center gap-1">{t('agent.plan')} <span className="inline-block w-1.5 h-1.5 rounded-full bg-info" /></span>
                : t('agent.plan'),
            content: plan ? (
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
            is_allowed: true,
        },
        {
            name: 'workstreams',
            label: hasWorkstreams
                ? <span className="flex items-center gap-1">{t('agent.workstreams')} <span className="inline-flex items-center justify-center px-1.5 py-0.5 text-[10px] rounded-full bg-info text-info">{activeWorkstreams.length}</span></span>
                : t('agent.workstreams'),
            content: <WorkstreamsTab workstreams={activeWorkstreams} messages={messages} runId={runId} />,
            is_allowed: !hideWorkstreams,
        },
        {
            name: 'documents',
            label: hasDocuments
                ? <span className="flex items-center gap-1">{t('agent.documents')} <span className="inline-flex items-center justify-center px-1.5 py-0.5 text-[10px] rounded-full bg-info text-info">{openDocuments.length}</span></span>
                : t('agent.documents'),
            content: openDocuments.length > 0 && onSelectDocument && onCloseDocument ? (
                <DocumentPanel
                    isOpen={true}
                    onClose={handleCloseDocPanel}
                    documents={openDocuments}
                    activeDocumentId={activeDocumentId ?? null}
                    onSelectDocument={onSelectDocument}
                    onCloseDocument={onCloseDocument}
                    refreshKey={docRefreshKey}
                    runId={runId}
                />
            ) : (
                <div className="flex flex-col items-center justify-center py-8 text-muted">
                    <FileTextIcon className="size-8 mb-2" />
                    <span className="text-sm">{t('agent.noDocumentsOpen')}</span>
                </div>
            ),
            is_allowed: true,
        },
        {
            name: 'uploads',
            label: hasUploads
                ? <span className="flex items-center gap-1">{t('agent.uploads')} <span className="inline-block w-1.5 h-1.5 rounded-full bg-info" /></span>
                : t('agent.uploads'),
            content: <UploadedDocumentsTab files={processingFiles} />,
            is_allowed: true,
        },
        {
            name: 'artifacts',
            label: t('agent.artifacts'),
            content: <ArtifactsTab runId={runId} refreshKey={artifactRefreshKey} />,
            is_allowed: showArtifacts,
        },
        {
            name: 'payload',
            label: t('agent.payload'),
            content: payloadContent ? <div className="overflow-y-auto">{payloadContent}</div> : null,
            is_allowed: !!payloadContent,
        },
    ];

    return (
        <Tabs
            tabs={tabs}
            current={activeTab}
            onTabChange={(name) => setActiveTab(name as RightPanelTab)}
            fullHeight
            className="px-0"
        >
            <div className="flex items-center border-b shrink-0 px-1">
                <div className="flex-1 overflow-x-auto">
                    <TabsBar className="border-b-0 mb-0" />
                </div>
                <Button variant="ghost" size="sm" className="shrink-0 ml-1" onClick={onClose}>
                    <XIcon className="size-4" />
                </Button>
            </div>
            <TabsPanel className="pt-0" />
        </Tabs>
    );
}

export const AgentRightPanel = React.memo(AgentRightPanelComponent);
