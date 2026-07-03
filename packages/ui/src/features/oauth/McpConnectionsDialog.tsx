import { useUITranslation } from '@vertesia/ui/i18n';
import { Link2, Link2Off } from 'lucide-react';
import { Button, Modal, ModalBody, ModalTitle, Spinner, Switch, VTooltip } from '../../core/index.js';
import { RemoteMcpConnectionButton } from './RemoteMcpConnectionButton.js';
import { isGroupDisabled, type McpConnectionGroup, toggleGroupDisabled } from './useMcpConnections.js';

export interface McpConnectionsDialogProps {
    isOpen: boolean;
    onClose: () => void;
    groups: McpConnectionGroup[];
    loading: boolean;
    /** True while group-level OAuth status is being fetched after the MCP rows are known. */
    statusLoading?: boolean;
    /** Refresh connection status after connect/disconnect. */
    reload: () => void;
    /** Collection ids deactivated for this conversation. `undefined`/empty ⇒ all active. */
    disabledCollections?: string[];
    /** Emits the next disabled-collection list when a server is toggled. Omit for read-only. */
    onChange?: (disabled: string[]) => void;
    /** Called after a successful connect/disconnect (e.g. to trigger tool re-discovery). */
    onConnectionChange?: () => void;
    /** Read-only: show status only, no toggles or connect/disconnect controls. */
    readOnly?: boolean;
}

/**
 * Dialog to manage the MCP servers available to an agent conversation.
 * Each server can be connected/disconnected (OAuth) and activated/deactivated for this run.
 */
export function McpConnectionsDialog({
    isOpen,
    onClose,
    groups,
    loading,
    statusLoading = false,
    reload,
    disabledCollections,
    onChange,
    onConnectionChange,
    readOnly = false,
}: McpConnectionsDialogProps) {
    const { t } = useUITranslation();

    const handleAuthChange = () => {
        reload();
        onConnectionChange?.();
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} size="md" className="max-w-[92vw] sm:max-w-[620px] lg:max-w-[620px]">
            <ModalTitle>{t('mcpConnections.title')}</ModalTitle>
            <ModalBody>
                <p className="mb-4 text-sm text-muted">{t('mcpConnections.subtitle')}</p>
                {loading ? (
                    <div className="flex items-center justify-center py-8">
                        <Spinner className="size-5" />
                    </div>
                ) : groups.length === 0 ? (
                    <div className="py-8 text-center text-sm text-muted">{t('mcpConnections.empty')}</div>
                ) : (
                    <div className="space-y-1">
                        {groups.map((group) => {
                            const active = !isGroupDisabled(group, disabledCollections);
                            const connected = group.authStatus?.authenticated === true;
                            const StatusIcon = connected ? Link2 : Link2Off;
                            return (
                                <div key={group.key} className="flex items-center justify-between gap-3 py-3">
                                    <div className="flex min-w-0 items-center gap-2">
                                        <StatusIcon
                                            className={`size-4 shrink-0 ${connected ? 'text-success' : 'text-muted'}`}
                                            aria-hidden="true"
                                        />
                                        <VTooltip
                                            description={
                                                <div className="space-y-0.5">
                                                    <div className="font-medium">{group.appName}</div>
                                                    {group.memberNames.length > 1 && (
                                                        <div className="text-xs text-muted">
                                                            {group.memberNames.join(' · ')}
                                                        </div>
                                                    )}
                                                </div>
                                            }
                                            placement="top"
                                            asChild
                                        >
                                            <span
                                                className={`truncate ${active ? 'text-foreground' : 'text-muted line-through'}`}
                                            >
                                                {group.label}
                                            </span>
                                        </VTooltip>
                                    </div>
                                    <div className="flex shrink-0 items-center gap-3">
                                        {statusLoading && !group.authStatus ? (
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                disabled
                                                className="h-6 w-32 justify-center px-2 text-xs"
                                                aria-label={t('mcpConnections.checkingStatus')}
                                                title={t('mcpConnections.checkingStatus')}
                                            >
                                                <Spinner className="size-3" />
                                            </Button>
                                        ) : (
                                            <RemoteMcpConnectionButton
                                                appId={group.appId}
                                                collectionId={group.representativeId}
                                                collectionName={group.label}
                                                authenticated={group.authStatus?.authenticated}
                                                onAuthChange={handleAuthChange}
                                                variant="compact"
                                                showDisconnect
                                                readOnly={readOnly}
                                            />
                                        )}
                                        {onChange && (
                                            <Switch
                                                size="sm"
                                                value={active}
                                                onChange={(checked) =>
                                                    onChange(toggleGroupDisabled(group, disabledCollections, checked))
                                                }
                                                disabled={readOnly}
                                                aria-label={
                                                    active
                                                        ? t('mcpConnections.deactivateAria', { name: group.label })
                                                        : t('mcpConnections.activateAria', { name: group.label })
                                                }
                                            />
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </ModalBody>
        </Modal>
    );
}
