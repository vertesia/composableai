import { AsyncExecutionResult } from "@vertesia/client";
import { Button, Command, CommandGroup, CommandItem, CommandList, Popover, PopoverContent, PopoverTrigger, useToast } from "@vertesia/ui/core";
import { useUserSession } from "@vertesia/ui/session";
import {
    Bot,
    ClipboardList,
    CopyIcon,
    DownloadCloudIcon,
    ExternalLink,
    MoreVertical,
    Plus,
    XIcon,
} from "lucide-react";
import { PayloadBuilderProvider, usePayloadBuilder } from "../../PayloadBuilder";
import { getConversationUrl } from "./utils";

interface HeaderProps {
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
    resetWorkflow
}: HeaderProps) {
    return (
        <PayloadBuilderProvider>
            <div className="flex items-center justify-between py-1.5 px-2 border-b shadow-sm flex-shrink-0">
                <div className="flex flex-wrap items-center space-x-2">
                    <div className="flex items-center space-x-1">
                        <Bot className="size-5 text-muted" />
                        <span className="font-medium">{title}</span>
                    </div>
                    <span className="text-xs text-muted ml-1">
                        (Run ID: {run.runId.substring(0, 8)}...)
                    </span>
                </div>
                <div className="flex items-center space-x-2">
                    {/* View Mode Toggle */}
                    <div className="flex items-center space-x-1 bg-muted rounded p-0.5">
                        <Button variant={viewMode === "stacked" ? "outline" : "ghost"} size="xs" className="rounded-l-md" onClick={() => onViewModeChange("stacked")}>
                            Details
                        </Button>
                        <Button variant={viewMode === "sliding" ? "outline" : "ghost"} size="xs" className="rounded-l-md" onClick={() => onViewModeChange("sliding")}>
                            Most Important
                        </Button>
                    </div>

                    {/* Plan Panel Toggle - Nicer styled button */}
                    <div className="relative">
                        {/* Notification badge when plan is available but hidden */}
                        {hasPlan && !showPlanPanel && (
                            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-primary rounded-full border border-border z-10"></span>
                        )}
                        <Button
                            size="sm"
                            variant={showPlanPanel ? "primary" : "secondary"}
                            onClick={onTogglePlanPanel}
                            className={`transition-all duration-200 rounded-md`}
                            title="Toggle plan panel"
                        >
                            <ClipboardList className="size-4 mr-1.5" />
                            <span className="font-medium text-xs">{showPlanPanel ? "Hide Plan" : "Show Plan"}</span>
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
    run,
    isModal,
    onClose,
    onDownload,
    onCopyRunId,
    resetWorkflow
}: {
    run: AsyncExecutionResult;
    isModal: boolean;
    onClose?: () => void;
    onDownload?: () => void;
    onCopyRunId?: () => void;
    resetWorkflow?: () => void;
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
                <Button size="xs" variant="ghost" title="More actions">
                    <MoreVertical className="size-4" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-48" align="end">
                <div className="rounded-md shadow-lg z-50">
                    <div className="py-1 min-w-36">
                        <Command>
                            <CommandList>
                                <CommandGroup>
                                    <div className="flex items-center px-3 py-1.5 text-xs text-gray-700 dark:text-gray-300">
                                        <span className="text-muted">Actions</span>
                                    </div>
                                    {
                                        isModal && (
                                            <CommandItem className="text-xs" onSelect={() => openUrl(`/store/agent-runner?agentId=${run.runId}__${run.workflowId}`)}>
                                                <ExternalLink className="size-3.5 mr-2 text-muted" /> Open in new tab
                                            </CommandItem>
                                        )
                                    }
                                    <CommandItem className="text-xs" onSelect={() => {
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
                                        <CopyIcon className="size-3.5 mr-2 text-muted" /> Copy Run ID
                                    </CommandItem>
                                    <CommandItem className="text-xs" onSelect={() => {
                                        if (onDownload) {
                                            onDownload();
                                        } else {
                                            getConversationUrl(client, run.runId).then((r) => window.open(r, "_blank"));
                                        }
                                    }}>
                                        <DownloadCloudIcon className="size-3.5 mr-2 text-muted" /> Download
                                        Conversation
                                    </CommandItem>
                                    {onClose && isModal && (
                                        <CommandItem className="text-xs" onSelect={onClose}>
                                            <XIcon className="size-3.5 mr-2 text-muted" /> Close
                                        </CommandItem>
                                    )}
                                    <CommandItem className="text-xs text-destructive" onSelect={() => {
                                        cancelWorkflow(run);
                                    }}>
                                        <XIcon className="size-3.5 mr-2 text-destructive" /> Cancel Workflow
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
