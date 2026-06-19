import { useUITranslation } from '@vertesia/ui/i18n';
import { useState } from 'react';
import { Badge, Button, Dropdown, MenuItem } from '../../core/index.js';
import { McpConnectionsDialog } from './McpConnectionsDialog.js';
import { countConnectedActiveGroups, useMcpConnections } from './useMcpConnections.js';

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
    const { groups, loading, reload } = useMcpConnections();
    const [isOpen, setIsOpen] = useState(false);

    if (!loading && groups.length === 0) {
        return null;
    }

    const activeCount = countConnectedActiveGroups(groups, disabledCollections);

    return (
        <>
            <Button
                variant={variant}
                size={size}
                onClick={() => setIsOpen(true)}
                disabled={loading}
                aria-label={t('mcpConnections.manage')}
            >
                <span>{t('mcpConnections.label')}</span>
                {activeCount > 0 && <Badge variant="success">{activeCount}</Badge>}
            </Button>
            <McpConnectionsDialog
                isOpen={isOpen}
                onClose={() => setIsOpen(false)}
                groups={groups}
                loading={loading}
                reload={reload}
                disabledCollections={disabledCollections}
                onChange={onChange}
                onConnectionChange={onConnectionChange}
                readOnly={readOnly}
            />
        </>
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
    const { groups, loading, reload } = useMcpConnections();
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
                        aria-label={t('mcpConnections.settings')}
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
                disabledCollections={disabledCollections}
                onChange={onChange}
                onConnectionChange={onConnectionChange}
                readOnly={readOnly}
            />
        </>
    );
}
