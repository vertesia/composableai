import type { McpConnectUxConfig } from '@vertesia/common';
import { Button, cn, VTooltip } from '@vertesia/ui/core';
import { useUITranslation } from '@vertesia/ui/i18n';
import { useUserSession } from '@vertesia/ui/session';
import { ChevronDownIcon, ChevronUpIcon, XIcon } from 'lucide-react';
import { useId, useState } from 'react';
import { RemoteMcpConnectionButton } from '../../oauth/RemoteMcpConnectionButton.js';
import { AskUserWidget } from './AskUserWidget';
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

    const wrapperClassName = cn(
        'flex-shrink-0 border-t border-border/70 bg-background/95 backdrop-blur',
        'fixed bottom-0 end-0 start-0 z-20 lg:sticky lg:start-auto lg:end-auto',
        'pb-safe-area',
        className,
    );

    return (
        <div className={wrapperClassName} data-agent-request-input-overlay>
            <div className="mx-auto flex w-full max-w-3xl justify-end px-3 py-1">
                <VTooltip description={isCollapsed ? t('agent.showQuestions') : t('agent.hideQuestions')} asChild>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="size-6"
                        aria-label={isCollapsed ? t('agent.showQuestions') : t('agent.hideQuestions')}
                        aria-expanded={!isCollapsed}
                        aria-controls={contentId}
                        onClick={() => setIsCollapsed((collapsed) => !collapsed)}
                    >
                        {isCollapsed ? <ChevronUpIcon className="size-4" /> : <ChevronDownIcon className="size-4" />}
                    </Button>
                </VTooltip>
            </div>
            {/* Keep the controls mounted so collapsing preserves drafts and selections. */}
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
                    <div className="mx-auto w-full max-w-3xl px-3 py-3">
                        <AskUserWidget
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
                            hideBorder
                            compact
                            isLoading={isDisabled}
                            className="my-0"
                            cardClassName="bg-background/80 shadow-lg shadow-black/5 dark:shadow-none"
                        />
                    </div>
                )}
            </div>
        </div>
    );
}
