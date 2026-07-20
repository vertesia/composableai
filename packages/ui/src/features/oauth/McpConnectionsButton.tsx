import { useUITranslation } from '@vertesia/ui/i18n';
import { Link2, Link2Off } from 'lucide-react';
import { useState } from 'react';
import { Badge, Button, Dropdown, MenuItem, Spinner, Switch, VTooltip } from '../../core/index.js';
import { McpConnectionsDialog } from './McpConnectionsDialog.js';
import { RemoteMcpConnectionButton } from './RemoteMcpConnectionButton.js';
import {
    countConnectedActiveGroups,
    getConnectedActiveGroupLabels,
    isGroupDisabled,
    toggleGroupDisabled,
    useMcpConnections,
} from './useMcpConnections.js';

export interface McpConnectionsButtonProps {
    /** Collection ids deactivated for this conversation. `undefined`/empty ⇒ all active. */
    disabledCollections?: string[];
    /** Emits the next disabled-collection list when a server is toggled. Omit for read-only. */
    onChange?: (disabled: string[]) => void;
    /** Called after a successful connect/disconnect (e.g. to trigger tool re-discovery). */
    onConnectionChange?: () => void;
    /** Read-only: show status only, no toggles or connect/disconnect controls. */
    readOnly?: boolean;
    /** Button visual style. */
    variant?: 'primary' | 'outline' | 'ghost' | 'secondary';
    size?: 'xs' | 'sm' | 'md';
}

/**
 * Toolbar button that opens the MCP connections dialog. The badge shows how many MCP
 * servers are connected and active for this conversation.
 * Renders nothing when the project has no OAuth MCP servers installed.
 */
export function McpConnectionsButton({
    disabledCollections,
    onChange,
    onConnectionChange,
    readOnly = false,
    variant = 'outline',
    size = 'sm',
}: McpConnectionsButtonProps) {
    const { t } = useUITranslation();
    const { groups, loading, statusLoading, reload } = useMcpConnections();
    const [isOpen, setIsOpen] = useState(false);

    if (!loading && groups.length === 0) {
        return null;
    }

    const activeCount = countConnectedActiveGroups(groups, disabledCollections);
    const activeLabels = getConnectedActiveGroupLabels(groups, disabledCollections);
    const visibleLabels = activeLabels.slice(0, 2);
    const hiddenLabelCount = activeLabels.length - visibleLabels.length;
    const summary =
        visibleLabels.length > 0
            ? `${visibleLabels.join(', ')}${hiddenLabelCount > 0 ? ` +${hiddenLabelCount}` : ''}`
            : undefined;

    return (
        <>
            <div className="flex min-w-0 items-center gap-2">
                {summary && (
                    <span className="max-w-48 truncate text-muted" title={activeLabels.join(', ')}>
                        {summary}
                    </span>
                )}
                <Button
                    variant={variant}
                    size={size}
                    className="shrink-0"
                    onClick={() => setIsOpen(true)}
                    disabled={loading}
                    aria-label={t('mcpConnections.manage')}
                >
                    <span>{t('mcpConnections.label')}</span>
                    {activeCount > 0 && <Badge variant="success">{activeCount}</Badge>}
                </Button>
            </div>
            <McpConnectionsDialog
                isOpen={isOpen}
                onClose={() => setIsOpen(false)}
                groups={groups}
                loading={loading}
                reload={reload}
                statusLoading={statusLoading}
                disabledCollections={disabledCollections}
                onChange={onChange}
                onConnectionChange={onConnectionChange}
                readOnly={readOnly}
            />
        </>
    );
}

/**
 * Inline MCP status list for forms. It shows all available OAuth MCP groups
 * without requiring the user to open the management dialog.
 */
export function McpConnectionsInlineList({
    disabledCollections,
    onChange,
    onConnectionChange,
    readOnly = false,
}: Omit<McpConnectionsButtonProps, 'variant' | 'size'>) {
    const { t } = useUITranslation();
    const { groups, loading, statusLoading, reload } = useMcpConnections();

    if (!loading && groups.length === 0) {
        return null;
    }

    const handleAuthChange = () => {
        void reload();
        onConnectionChange?.();
    };

    if (loading && groups.length === 0) {
        return (
            <div className="flex items-center gap-2 border-y border-border/70 py-2 text-sm text-muted">
                <Spinner className="size-4" />
                <span>{t('mcpConnections.label')}</span>
            </div>
        );
    }

    return (
        <div className="space-y-1">
            {groups.map((group) => {
                const active = !isGroupDisabled(group, disabledCollections);
                const connected = group.authStatus?.authenticated === true;
                const StatusIcon = connected ? Link2 : Link2Off;
                return (
                    <div key={group.key} className="flex flex-wrap items-center gap-x-3 gap-y-2 py-2 text-sm">
                        <div className="flex min-w-36 flex-1 items-center gap-2">
                            <StatusIcon
                                className={`size-4 shrink-0 ${connected ? 'text-success' : 'text-muted'}`}
                                aria-hidden="true"
                            />
                            <VTooltip
                                description={
                                    <div className="space-y-0.5">
                                        <div className="font-medium">{group.appName}</div>
                                        {group.memberNames.length > 1 && (
                                            <div className="text-xs text-muted">{group.memberNames.join(' · ')}</div>
                                        )}
                                    </div>
                                }
                                placement="top"
                                asChild
                            >
                                <span
                                    className={`block truncate ${active ? 'text-foreground' : 'text-muted line-through'}`}
                                >
                                    {group.label}
                                </span>
                            </VTooltip>
                        </div>
                        {statusLoading && !group.authStatus ? (
                            <Button
                                variant="outline"
                                size="sm"
                                disabled
                                className="h-6 w-32 justify-center px-2 text-xs"
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
                            <div className="flex min-w-24 items-center justify-end gap-2 text-xs">
                                <span className={active ? 'text-muted' : 'text-attention'}>
                                    {active ? t('mcpConnections.enabled') : t('mcpConnections.disabled')}
                                </span>
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
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}

/**
 * Compact composer action menu for MCP. The slash trigger keeps MCP out of the
 * main composer toolbar while still exposing the connection dialog when relevant.
 */
export function McpConnectionsActionMenu({
    disabledCollections,
    onChange,
    onConnectionChange,
    readOnly = false,
}: Omit<McpConnectionsButtonProps, 'variant' | 'size'>) {
    const { t } = useUITranslation();
    const { groups, loading, statusLoading, reload } = useMcpConnections();
    const [isOpen, setIsOpen] = useState(false);

    if (!loading && groups.length === 0) {
        return null;
    }

    const activeCount = countConnectedActiveGroups(groups, disabledCollections);

    return (
        <>
            <Dropdown
                align="left"
                trigger={
                    <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 rounded-md text-muted hover:bg-muted"
                        title={t('mcpConnections.settings')}
                        disabled={loading}
                    >
                        <span
                            className="flex size-5 items-center justify-center rounded-[3px] border border-muted text-sm font-semibold leading-none"
                            aria-hidden="true"
                        >
                            /
                        </span>
                    </Button>
                }
            >
                <MenuItem onClick={() => setIsOpen(true)} isDisabled={loading}>
                    <span>{t('mcpConnections.title')}</span>
                    {activeCount > 0 && <Badge variant="success">{activeCount}</Badge>}
                </MenuItem>
            </Dropdown>
            <McpConnectionsDialog
                isOpen={isOpen}
                onClose={() => setIsOpen(false)}
                groups={groups}
                loading={loading}
                reload={reload}
                statusLoading={statusLoading}
                disabledCollections={disabledCollections}
                onChange={onChange}
                onConnectionChange={onConnectionChange}
                readOnly={readOnly}
            />
        </>
    );
}
