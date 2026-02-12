import { AsyncExecutionResult } from "@vertesia/client";
import { Button, Command, CommandGroup, CommandItem, CommandList, cn, Popover, PopoverContent, PopoverTrigger, useToast } from "@vertesia/ui/core";
import { useUserSession } from "@vertesia/ui/session";
import { Bot, ClipboardList, CopyIcon, DownloadCloudIcon, ExternalLink, MoreVertical, XIcon } from "lucide-react";
import { PayloadBuilderProvider, usePayloadBuilder } from "../../PayloadBuilder";
import { useConversationTheme } from "../theme/ConversationThemeContext";
import { type ResolvedHeaderThemeClasses, resolveHeaderTheme } from "../theme/resolveHeaderTheme";
import { getConversationUrl } from "./utils";

export interface HeaderProps {
    title: string;
    isCompleted: boolean;
    onClose?: () => void;
    isModal: boolean;
    run: AsyncExecutionResult;
    viewMode: "stacked" | "sliding";
    onViewModeChange: (mode: "stacked" | "sliding") => void;
    showPlanPanel: boolean;
    hasPlan?: boolean;
    onTogglePlanPanel: () => void;
    onDownload?: () => void;
    onCopyRunId?: () => void;
    resetWorkflow?: () => void;
    onExportPdf?: () => void;
    /** Show green indicator when receiving streaming chunks */
    isReceivingChunks?: boolean;
    /** Additional className for the outer container */
    className?: string;
}

export default function Header({
    title,
    onClose,
    isModal,
    run,
    viewMode,
    onViewModeChange,
    showPlanPanel,
    hasPlan = false,
    onTogglePlanPanel,
    onDownload,
    onCopyRunId,
    resetWorkflow,
    onExportPdf,
    isReceivingChunks = false,
    className,
}: HeaderProps) {
    // Theme context: resolve cascade into flat class strings (authoritative)
    const conversationTheme = useConversationTheme();
    const theme = resolveHeaderTheme(conversationTheme?.header);

    return (
        <PayloadBuilderProvider>
            <div className={cn("flex flex-wrap items-end justify-between py-1.5 px-2 border-b shadow-sm flex-shrink-0", className, theme.root)}>
                <div className={cn("flex flex-wrap items-center space-x-2", theme.titleSection)}>
                    <div className={cn("flex items-center space-x-1", theme.iconContainer)}>
                        <Bot className={cn("size-5 text-muted", theme.icon)} />
                        <span className={cn("font-medium", theme.title)}>{title}</span>
                    </div>
                    <span className={cn("text-xs text-muted ml-1 flex items-center gap-1.5", theme.runId)}>
                        (Run ID: {run.runId.substring(0, 8)}...)
                        {/* Streaming chunk indicator - gray when idle, purple when receiving */}
                        <span className={cn(
                            "w-2 h-2 rounded-full transition-colors duration-200",
                            isReceivingChunks
                                ? "bg-purple-500 shadow-[0_0_6px_2px_rgba(168,85,247,0.6)]"
                                : "bg-gray-400",
                            theme.streamingIndicator,
                        )} />
                    </span>
                </div>
                <div className={cn("flex justify-end items-center space-x-2 ml-auto", theme.actionsSection)}>
                    {/* View Mode Toggle */}
                    <div className={cn("flex items-center space-x-1 bg-muted rounded p-0.5 mt-2 lg:mt-0", theme.viewToggle)}>
                        <Button variant={viewMode === "stacked" ? "outline" : "ghost"} size="xs" className={cn("rounded-l-md", theme.detailsButton)} onClick={() => onViewModeChange("stacked")}>
                            Details
                        </Button>
                        <Button variant={viewMode === "sliding" ? "outline" : "ghost"} size="xs" className={cn("rounded-r-md", theme.summaryButton)} onClick={() => onViewModeChange("sliding")}>
                            Summary
                        </Button>
                    </div>

                    {/* Plan Panel Toggle - Nicer styled button */}
                    <div className={cn("relative", theme.planContainer)}>
                        {/* Notification badge when plan is available but hidden */}
                        {hasPlan && !showPlanPanel && (
                            <span className={cn("absolute -top-1 -right-1 w-2.5 h-2.5 bg-primary rounded-full border border-border z-10", theme.planBadge)}></span>
                        )}
                        <Button
                            size="sm"
                            variant={showPlanPanel ? "primary" : "secondary"}
                            onClick={onTogglePlanPanel}
                            className={cn("transition-all duration-200 rounded-md", theme.planButton)}
                            title="Toggle plan panel"
                        >
                            <ClipboardList className={cn("size-4 mr-1.5", theme.planButtonIcon)} />
                            <span className={cn("font-medium text-xs", theme.planButtonText)}>{showPlanPanel ? "Hide Plan" : "Show Plan"}</span>
                        </Button>
                    </div>

                    {/* More actions */}
                    <MoreDropdown
                        run={run}
                        isModal={isModal}
                        onClose={onClose}
                        onDownload={onDownload}
                        onCopyRunId={onCopyRunId}
                        resetWorkflow={resetWorkflow}
                        onExportPdf={onExportPdf}
                        theme={theme}
                    />
                    {onClose && !isModal && (
                        <Button size="xs" variant="ghost" className={theme.closeButton} onClick={onClose}>
                            <XIcon className={cn("size-4", theme.closeButtonIcon)} />
                        </Button>
                    )}
                </div>
            </div>
        </PayloadBuilderProvider>
    );
}

function MoreDropdown({
    run,
    isModal,
    onClose,
    onDownload,
    onCopyRunId,
    resetWorkflow,
    onExportPdf,
    theme,
}: {
    run: AsyncExecutionResult;
    isModal: boolean;
    onClose?: () => void;
    onDownload?: () => void;
    onCopyRunId?: () => void;
    resetWorkflow?: () => void;
    onExportPdf?: () => void;
    theme: ResolvedHeaderThemeClasses;
}) {
    const toast = useToast();
    const { client } = useUserSession();
    const builder = usePayloadBuilder();

    const cancelWorkflow = async (run: AsyncExecutionResult) => {
        try {
            await client.store.workflows.terminate(run.workflowId, run.runId, "cancel");

            toast({
                status: "success",
                title: "Workflow cancelled",
                duration: 2000,
            });

            builder.reset();
            resetWorkflow?.();

            return true;
        } catch (error) {
            toast({
                status: "error",
                title: "Failed to cancel workflow",
                duration: 2000,
            });
            return false;
        }
    };

    const openUrl = (url: string) => {
        window.open(url, "_blank");
        return url;
    }

    return (
        <Popover hover>
            <PopoverTrigger>
                <Button size="xs" variant="ghost" className={theme.moreButton} title="More actions">
                    <MoreVertical className={cn("size-4", theme.moreButtonIcon)} />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-48" align="end">
                <div className={cn("rounded-md shadow-lg z-50", theme.dropdownContent)}>
                    <div className="py-1 min-w-36">
                        <Command>
                            <CommandList>
                                <CommandGroup>
                                    <div className={cn("flex items-center px-3 py-1.5 text-xs text-gray-700 dark:text-gray-300", theme.dropdownHeader)}>
                                        <span className="text-muted">Actions</span>
                                    </div>
                                    {
                                        isModal && (
                                            <CommandItem className={cn("text-xs", theme.dropdownItem)} onSelect={() => openUrl(`/store/agent-runner?agentId=${run.runId}__${run.workflowId}`)}>
                                                <ExternalLink className={cn("size-3.5 mr-2 text-muted", theme.dropdownItemIcon)} /> Open in new tab
                                            </CommandItem>
                                        )
                                    }
                                    <CommandItem className={cn("text-xs", theme.dropdownItem)} onSelect={() => {
                                        if (onCopyRunId) {
                                            onCopyRunId();
                                        } else {
                                            navigator.clipboard.writeText(run.runId);
                                            toast({
                                                status: "success",
                                                title: "Run ID copied",
                                                duration: 2000,
                                            });
                                        }
                                    }}>
                                        <CopyIcon className={cn("size-3.5 mr-2 text-muted", theme.dropdownItemIcon)} /> Copy Run ID
                                    </CommandItem>
                                    <CommandItem className={cn("text-xs", theme.dropdownItem)} onSelect={() => {
                                        if (onDownload) {
                                            onDownload();
                                        } else {
                                            getConversationUrl(client, run.runId).then((r) => window.open(r, "_blank"));
                                        }
                                    }}>
                                        <DownloadCloudIcon className={cn("size-3.5 mr-2 text-muted", theme.dropdownItemIcon)} /> Download
                                        Conversation
                                    </CommandItem>
                                    {onExportPdf && (
                                        <CommandItem className={cn("text-xs", theme.dropdownItem)} onSelect={onExportPdf}>
                                            <DownloadCloudIcon className={cn("size-3.5 mr-2 text-muted", theme.dropdownItemIcon)} /> Export as PDF
                                        </CommandItem>
                                    )}
                                    {onClose && isModal && (
                                        <CommandItem className={cn("text-xs", theme.dropdownItem)} onSelect={onClose}>
                                            <XIcon className={cn("size-3.5 mr-2 text-muted", theme.dropdownItemIcon)} /> Close
                                        </CommandItem>
                                    )}
                                    <CommandItem className={cn("text-xs text-destructive", theme.dropdownItem)} onSelect={() => {
                                        cancelWorkflow(run);
                                    }}>
                                        <XIcon className={cn("size-3.5 mr-2 text-destructive", theme.dropdownItemIcon)} /> Cancel Workflow
                                    </CommandItem>
                                </CommandGroup>
                            </CommandList>
                        </Command>
                    </div>
                </div>
            </PopoverContent>
        </Popover>
    );
}
