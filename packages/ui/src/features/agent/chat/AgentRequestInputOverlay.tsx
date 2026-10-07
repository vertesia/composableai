import type { McpConnectUxConfig } from '@vertesia/common';
import { Button, VTooltip } from '@vertesia/ui/core';
import { useUITranslation } from '@vertesia/ui/i18n';
import { useUserSession } from '@vertesia/ui/session';
import { ChevronDown, ChevronUp, HelpCircle, XIcon } from 'lucide-react';
import { useId, useState } from 'react';
import { RemoteMcpConnectionButton } from '../../oauth/RemoteMcpConnectionButton.js';
import { ComposerOverlay, ComposerOverlayQuestion } from './ComposerOverlay';
import {
    getRequestInputDisplayText,
    getRequestInputResolutionKey,
    getRequestInputResponseMetadata,
    getToolApprovalResponseMetadata,
    type RequestInputMessageWithUx,
    sendRequestInputResponse,
} from './ModernAgentOutput/requestInputMessages';

export interface AgentRequestInputOverlayProps {
    message?: RequestInputMessageWithUx;
    onSendMessage?: (message: string, metadata?: Record<string, unknown>) => void;
    /** Called after the user connects the MCP server requested by request_mcp_connection. */
    onMcpConnected?: (cfg: McpConnectUxConfig, metadata?: Record<string, unknown>) => void;
    isLoading?: boolean;
    disabled?: boolean;
    className?: string;
}

interface McpRequestInputControlsProps {
    mcpConnect: McpConnectUxConfig;
    onMcpConnected?: (cfg: McpConnectUxConfig) => void;
    onDecline: () => void;
    disabled: boolean;
}

function McpRequestInputControls({ mcpConnect, onMcpConnected, onDecline, disabled }: McpRequestInputControlsProps) {
    const { client } = useUserSession();
    const { t } = useUITranslation();

    return (
        <div className="flex shrink-0 items-center justify-end gap-2">
            <RemoteMcpConnectionButton
                appId={mcpConnect.app_install_id}
                collectionId={mcpConnect.collection_id}
                collectionName={mcpConnect.name}
                variant="default"
                onAuthChange={() => {
                    // useOAuthPopup fires onComplete even on cancel/popup-close, so only
                    // resume the agent once the connection is actually authenticated.
                    void client.remoteMcpConnections
                        .getCollectionStatus(mcpConnect.app_install_id, mcpConnect.collection_id)
                        .then((status) => {
                            if (status.authenticated) onMcpConnected?.(mcpConnect);
                        })
                        .catch(() => {
                            /* status check failed — do not resume */
                        });
                }}
                readOnly={disabled}
            />
            <Button variant="ghost" size="sm" onClick={onDecline} disabled={disabled}>
                <XIcon className="size-4" />
                <span>{t('mcpOAuth.decline')}</span>
            </Button>
        </div>
    );
}

export function AgentRequestInputOverlay(props: AgentRequestInputOverlayProps) {
    if (!props.message) return null;

    return (
        <PendingRequestInputOverlay
            {...props}
            message={props.message}
            key={`${props.message.workflow_run_id}:${getRequestInputResolutionKey(props.message)}`}
        />
    );
}

function PendingRequestInputOverlay({
    message,
    onSendMessage,
    onMcpConnected,
    isLoading = false,
    disabled = false,
    className,
}: AgentRequestInputOverlayProps & { message: RequestInputMessageWithUx }) {
    const { t } = useUITranslation();
    const [isCollapsed, setIsCollapsed] = useState(false);
    const contentId = useId();
    const toggleLabel = isCollapsed ? t('agent.showQuestions') : t('agent.hideQuestions');

    const uxConfig = message.details.ux;
    const options = uxConfig.options ?? [];
    const mcpConnect = uxConfig.mcp_connect;
    const freeResponse = uxConfig.free_response;
    const isDisabled = disabled || isLoading || !onSendMessage;
    const displayText = getRequestInputDisplayText(message);
    const send = (value: string, metadata?: Record<string, unknown>) => {
        if (isDisabled) return;
        sendRequestInputResponse(onSendMessage, message, value, metadata);
    };

    return (
        <ComposerOverlay className={className} data-agent-request-input-overlay>
            <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-2 px-3 pt-2 text-xs text-muted">
                <div className="flex min-w-0 items-center gap-2 px-1 font-medium">
                    <HelpCircle className="size-3.5 shrink-0" aria-hidden="true" />
                    <span className="truncate">{t('agent.pendingQuestions')}</span>
                </div>
                <VTooltip description={toggleLabel} asChild>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 shrink-0 rounded-lg [&_svg]:size-5"
                        onClick={() => setIsCollapsed((collapsed) => !collapsed)}
                        aria-label={toggleLabel}
                        aria-expanded={!isCollapsed}
                        aria-controls={contentId}
                    >
                        {isCollapsed ? <ChevronUp aria-hidden="true" /> : <ChevronDown aria-hidden="true" />}
                    </Button>
                </VTooltip>
            </div>
            {/* Keep the controls mounted so collapsing preserves drafts and selected options. */}
            <div id={contentId} hidden={isCollapsed}>
                {mcpConnect ? (
                    <div className="mx-auto flex w-full max-w-3xl flex-col gap-3 px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0 text-sm leading-6 text-foreground/85">{displayText}</div>
                        <McpRequestInputControls
                            mcpConnect={mcpConnect}
                            onMcpConnected={(cfg) => onMcpConnected?.(cfg, getRequestInputResponseMetadata(message))}
                            onDecline={() => send(t('agent.mcpDeclinedMessage', { name: mcpConnect.name }))}
                            disabled={isDisabled}
                        />
                    </div>
                ) : (
                    <ComposerOverlayQuestion
                        question={displayText}
                        options={options}
                        variant={uxConfig.variant}
                        multiSelect={uxConfig.multiSelect}
                        allowFreeResponse={options.length === 0 || !!freeResponse}
                        placeholder={freeResponse?.placeholder}
                        submitLabel={freeResponse?.submit_label}
                        onSelect={(optionId) => send(optionId, getToolApprovalResponseMetadata(message, optionId))}
                        onMultiSelect={(optionIds) => send(optionIds.join(', '))}
                        onSubmit={(value) => send(value, freeResponse?.metadata)}
                        isLoading={isDisabled}
                    />
                )}
            </div>
        </ComposerOverlay>
    );
}
