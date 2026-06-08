import type { AgentRun } from '@vertesia/common';
import { Button, cn, Dropdown, MenuGroup, MenuItem, useToast } from '@vertesia/ui/core';
import { useUITranslation } from '@vertesia/ui/i18n';
import { useRouterContext } from '@vertesia/ui/router';
import { useUserSession } from '@vertesia/ui/session';
import {
    Bot,
    ClipboardList,
    CopyIcon,
    DownloadCloudIcon,
    ExternalLink,
    GitFork,
    InfoIcon,
    MoreVertical,
    XIcon,
} from 'lucide-react';
import { PayloadBuilderProvider, usePayloadBuilder } from '../../PayloadBuilder';
import type { AgentConversationViewMode } from './AllMessagesMixed';
import { getConversationUrl } from './utils';

export interface HeaderProps {
    title: string;
    isCompleted: boolean;
    /** Workflow is in a terminal state (completed/failed/cancelled) — not just idle */
    isTerminal?: boolean;
    onClose?: () => void;
    isModal: boolean;
    agentRunId: string;
    workflowRunId: string;
    viewMode: AgentConversationViewMode;
    onViewModeChange: (mode: AgentConversationViewMode) => void;
    showPlanPanel: boolean;
    hasPlan?: boolean;
    showPlanButton?: boolean;
    onTogglePlanPanel: () => void;
    onDownload?: () => void;
    // onCopyRunId?: () => void;
    resetWorkflow?: () => void;
    onExportPdf?: () => void;
    /** Called to show run details/internals modal */
    onShowDetails?: () => void;
    /** Whether workflow control actions such as cancel should be shown. */
    allowWorkflowControl?: boolean;
    /**
     * @deprecated No longer used. Continuing a completed conversation now happens
     * automatically when the user sends a message. Kept as an optional no-op to preserve
     * type compatibility for external consumers of this public component.
     */
    onRestart?: (newRun: AgentRun) => void;
    /** Called after a clone succeeds — receives the new AgentRun */
    onClone?: (newRun: AgentRun) => void;
    /** Show green indicator when receiving streaming chunks */
    isReceivingChunks?: boolean;
    /** Additional className for the outer container */
    className?: string;
}

export default function Header({
    title,
    isTerminal = false,
    onClose,
    isModal,
    agentRunId,
    workflowRunId,
    viewMode,
    onViewModeChange,
    showPlanPanel,
    hasPlan = false,
    showPlanButton = true,
    onTogglePlanPanel,
    onDownload,
    // onCopyRunId,
    resetWorkflow,
    onExportPdf,
    onShowDetails,
    allowWorkflowControl = true,
    onClone,
    isReceivingChunks = false,
    className,
}: HeaderProps) {
    const { t } = useUITranslation();
    return (
        <PayloadBuilderProvider>
            <div
                className={cn(
                    'flex flex-wrap items-end justify-between py-1.5 px-2 border-b shadow-sm flex-shrink-0',
                    className,
                )}
            >
                <div className="flex flex-wrap items-center space-x-2">
                    <div className="flex items-center space-x-1">
                        <Bot className="size-5 text-muted" />
                        <span className="font-medium">{title}</span>
                    </div>
                    <span className="text-xs text-muted ms-1 flex items-center gap-1.5">
                        (Agent Run ID: {agentRunId})
                        {/* Streaming chunk indicator - gray when idle, purple when receiving */}
                        <span
                            className={cn(
                                'w-2 h-2 rounded-full transition-colors duration-200',
                                isReceivingChunks
                                    ? 'bg-purple-500 shadow-[0_0_6px_2px_rgba(168,85,247,0.6)]'
                                    : 'bg-gray-400',
                            )}
                        />
                    </span>
                </div>
                <div className="flex justify-end items-center space-x-2 ms-auto">
                    {/* View Mode Toggle */}
                    <div className="flex items-center space-x-1 bg-muted rounded p-0.5 mt-2 lg:mt-0">
                        <Button
                            variant={viewMode === 'stacked' ? 'outline' : 'ghost'}
                            size="xs"
                            onClick={() => onViewModeChange('stacked')}
                        >
                            {t('agent.details')}
                        </Button>
                        <Button
                            variant={viewMode === 'sliding' ? 'outline' : 'ghost'}
                            size="xs"
                            onClick={() => onViewModeChange('sliding')}
                        >
                            {t('agent.summary')}
                        </Button>
                    </div>

                    {showPlanButton && (
                        <div className="relative">
                            {/* Notification badge when plan is available but hidden */}
                            {hasPlan && !showPlanPanel && (
                                <span className="absolute -top-1 -end-1 w-2.5 h-2.5 bg-primary rounded-full border border-border z-10"></span>
                            )}
                            <Button
                                size="sm"
                                variant={showPlanPanel ? 'primary' : 'secondary'}
                                onClick={onTogglePlanPanel}
                                className="transition-all duration-200 rounded-md"
                                title={t('agent.toggleRightSidebar')}
                            >
                                <ClipboardList className="size-4 me-1.5" />
                                <span className="font-medium text-xs">
                                    {showPlanPanel ? t('agent.hideSidebar') : t('agent.showSidebar')}
                                </span>
                            </Button>
                        </div>
                    )}

                    {/* More actions */}
                    <MoreDropdown
                        agentRunId={agentRunId}
                        workflowRunId={workflowRunId}
                        isModal={isModal}
                        isTerminal={isTerminal}
                        onClose={onClose}
                        onDownload={onDownload}
                        resetWorkflow={resetWorkflow}
                        onExportPdf={onExportPdf}
                        onShowDetails={onShowDetails}
                        allowWorkflowControl={allowWorkflowControl}
                        onClone={onClone}
                    />
                    {onClose && !isModal && (
                        <Button size="xs" variant="ghost" onClick={onClose}>
                            <XIcon className="size-4" />
                        </Button>
                    )}
                </div>
            </div>
        </PayloadBuilderProvider>
    );
}

function MoreDropdown({
    agentRunId,
    workflowRunId,
    isModal,
    isTerminal,
    onClose,
    onDownload,
    resetWorkflow,
    onExportPdf,
    onShowDetails,
    allowWorkflowControl = true,
    onClone,
}: {
    agentRunId: string;
    workflowRunId: string;
    isModal: boolean;
    isTerminal: boolean;
    onClose?: () => void;
    onDownload?: () => void;
    onCopyRunId?: () => void;
    resetWorkflow?: () => void;
    onExportPdf?: () => void;
    onShowDetails?: () => void;
    allowWorkflowControl?: boolean;
    onClone?: (newRun: AgentRun) => void;
}) {
    const { t } = useUITranslation();
    const toast = useToast();
    const { client } = useUserSession();
    const builder = usePayloadBuilder();
    const { router } = useRouterContext();

    const cancelWorkflow = async () => {
        try {
            await client.agents.terminate(agentRunId, 'cancel');

            toast({
                status: 'success',
                title: t('agent.workflowCancelled'),
                duration: 2000,
            });

            builder.reset();
            resetWorkflow?.();

            return true;
        } catch (_error) {
            toast({
                status: 'error',
                title: t('agent.failedToCancelWorkflow'),
                duration: 2000,
            });
            return false;
        }
    };

    const cloneWorkflow = async () => {
        try {
            const newRun = await client.agents.fork(agentRunId);
            toast({
                status: 'success',
                title: t('agent.conversationCloned'),
                duration: 2000,
            });
            onClone?.(newRun);
        } catch (_error) {
            toast({
                status: 'error',
                title: t('agent.failedToCloneConversation'),
                duration: 2000,
            });
        }
    };

    const openUrl = (url: string) => {
        // Carry the active tenant sticky params (a/p) on internal routes so the new tab keeps the
        // current account/project; leave absolute/external URLs untouched.
        const href = url.startsWith('/') ? router.getTopRouter().navigator.addStickyParams(url) : url;
        window.open(href, '_blank');
        return href;
    };

    const copyAgentRunId = () => {
        navigator.clipboard.writeText(agentRunId);
        toast({
            status: 'success',
            title: t('agent.agentRunIdCopied'),
            duration: 2000,
        });
    };

    const copyWorkflowRunId = () => {
        navigator.clipboard.writeText(workflowRunId);
        toast({
            status: 'success',
            title: t('agent.workflowRunIdCopied'),
            duration: 2000,
        });
    };

    return (
        <Dropdown
            align="right"
            trigger={
                <Button size="xs" variant="ghost" title={t('agent.moreActions')}>
                    <MoreVertical className="size-4" />
                </Button>
            }
        >
            <MenuGroup label="Actions">
                {isModal && (
                    <MenuItem onClick={() => openUrl(`/store/agent-runner/${agentRunId}`)}>
                        <ExternalLink className="size-3.5 text-muted" /> {t('agent.openInNewTab')}
                    </MenuItem>
                )}
                <MenuItem onClick={copyAgentRunId}>
                    <CopyIcon className="size-3.5 text-muted" /> {t('agent.copyAgentRunId')}
                </MenuItem>
                <MenuItem onClick={copyWorkflowRunId}>
                    <CopyIcon className="size-3.5 text-muted" /> {t('agent.copyWorkflowRunId')}
                </MenuItem>
                {onShowDetails && (
                    <MenuItem onClick={onShowDetails}>
                        <InfoIcon className="size-3.5 text-muted" /> {t('agent.details')}
                    </MenuItem>
                )}
                <MenuItem
                    onClick={() => {
                        if (onDownload) {
                            onDownload();
                        } else {
                            void getConversationUrl(client, agentRunId).then((r) => window.open(r, '_blank'));
                        }
                    }}
                >
                    <DownloadCloudIcon className="size-3.5 text-muted" /> {t('agent.downloadConversation')}
                </MenuItem>
                {onExportPdf && (
                    <MenuItem onClick={onExportPdf}>
                        <DownloadCloudIcon className="size-3.5 text-muted" /> {t('agent.exportAsPdf')}
                    </MenuItem>
                )}
                {onClose && isModal && (
                    <MenuItem onClick={onClose}>
                        <XIcon className="size-3.5 text-muted" /> {t('agent.close')}
                    </MenuItem>
                )}
                {onClone && (
                    <MenuItem onClick={cloneWorkflow}>
                        <GitFork className="size-3.5 text-muted" /> {t('agent.cloneConversation')}
                    </MenuItem>
                )}
                {allowWorkflowControl && !isTerminal && (
                    <MenuItem onClick={cancelWorkflow} variant="destructive">
                        <XIcon className="size-3.5" /> {t('agent.cancelWorkflow')}
                    </MenuItem>
                )}
            </MenuGroup>
        </Dropdown>
    );
}
