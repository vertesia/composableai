import { useUITranslation } from '@vertesia/ui/i18n';
import { useUserSession } from '@vertesia/ui/session';
import { CheckCircle2, Link2, ShieldAlertIcon, Unlink2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Button, Spinner } from '../../core/index.js';
import { useOAuthPopup } from './useOAuthPopup.js';

interface RemoteMcpConnectionButtonProps {
    appId: string;
    collectionId: string;
    collectionName?: string;
    /** Pre-fetched authentication status. If not provided, will fetch automatically. */
    authenticated?: boolean;
    onAuthChange?: () => void;
    onError?: (error: string | null) => void;
    variant?: 'default' | 'compact' | 'full';
    /** Show collection name label */
    showLabel?: boolean;
    /** Show disconnect button when authenticated */
    showDisconnect?: boolean;
    /** Read-only mode - only show status, no interactive buttons */
    readOnly?: boolean;
}

interface OAuthStatus {
    authenticated: boolean;
    collection_id: string;
    collection_name: string;
    expires_at?: string;
    mcp_server_url: string;
}

/**
 * Flexible connect button for remote MCP tool collections.
 * - 'compact': minimal size for lists (no disconnect)
 * - 'default': standard button size (no disconnect)
 * - 'full': with label, status, and disconnect button
 */
export function RemoteMcpConnectionButton({
    appId,
    collectionId,
    collectionName,
    authenticated: providedAuthenticated,
    onAuthChange,
    onError,
    variant = 'default',
    showLabel = false,
    showDisconnect = false,
    readOnly = false,
}: RemoteMcpConnectionButtonProps) {
    const { client } = useUserSession();
    const { t } = useUITranslation();
    const [status, setStatus] = useState<OAuthStatus | null>(null);
    const [loading, setLoading] = useState(providedAuthenticated === undefined && !readOnly);
    const [authenticating, setAuthenticating] = useState(false);
    const [disconnecting, setDisconnecting] = useState(false);

    const authenticated = providedAuthenticated ?? status?.authenticated ?? false;
    const displayName = collectionName ?? collectionId;
    const compactActionClassName = 'h-6 w-32 justify-center px-2 text-xs';

    const loadStatus = useCallback(async () => {
        if (providedAuthenticated !== undefined) {
            setLoading(false);
            return;
        }
        if (readOnly) {
            setLoading(false);
            return;
        }

        try {
            setLoading(true);
            const data = await client.remoteMcpConnections.getCollectionStatus(appId, collectionId);
            setStatus(data);
        } catch (error) {
            console.error('[RemoteMcpConnectionButton] Failed to load OAuth status:', error);
        } finally {
            setLoading(false);
        }
    }, [client, appId, collectionId, providedAuthenticated, readOnly]);

    useEffect(() => {
        void loadStatus();
    }, [loadStatus]);

    const { openOAuthPopup } = useOAuthPopup({
        onComplete: () => {
            setAuthenticating(false);
            void loadStatus();
            onAuthChange?.();
        },
        onError: (error) => {
            console.error('OAuth failed:', error);
            setAuthenticating(false);
        },
    });

    const handleConnect = async () => {
        try {
            setAuthenticating(true);
            onError?.(null);
            const response = await client.remoteMcpConnections.authorize(appId, collectionId);
            if (response.connected) {
                setAuthenticating(false);
                await loadStatus();
                onAuthChange?.();
            } else if (response.authorization_url) {
                openOAuthPopup(response.authorization_url);
            } else {
                onError?.(`${displayName}: Authorization URL not provided by server`);
                setAuthenticating(false);
            }
        } catch (error) {
            console.error('Failed to authorize:', error);
            const raw =
                error instanceof Error
                    ? ((error as { original_message?: string }).original_message ?? error.message)
                    : 'Failed to connect';
            const detail = raw.replace(/^[A-Za-z\s]+:\s/, '');
            onError?.(`${displayName}: ${detail}`);
            setAuthenticating(false);
        }
    };

    const handleDisconnect = async () => {
        try {
            setDisconnecting(true);
            await client.remoteMcpConnections.disconnect(appId, collectionId);
            await loadStatus();
            onAuthChange?.();
        } catch (error) {
            console.error('Failed to disconnect:', error);
        } finally {
            setDisconnecting(false);
        }
    };

    if (loading) {
        if (variant === 'compact') {
            return (
                <Button
                    variant="outline"
                    size="sm"
                    disabled
                    className={compactActionClassName}
                    title={t('mcpConnections.checkingStatus')}
                >
                    <Spinner className="size-3" />
                </Button>
            );
        }

        return (
            <div className="flex items-center gap-2 text-sm">
                <Spinner className="size-4" />
            </div>
        );
    }

    if (variant === 'full') {
        if (!authenticated) {
            return (
                <div className="flex items-center gap-2 text-sm">
                    {showLabel && <span className="font-medium text-foreground">{displayName}:</span>}
                    <Button variant="ghost" size="sm" onClick={handleConnect} disabled={authenticating}>
                        {authenticating ? (
                            <>
                                <Spinner className="size-4" />
                                <span>{t('mcpOAuth.authenticating')}</span>
                            </>
                        ) : (
                            <>
                                <ShieldAlertIcon className="size-4" />
                                <span>{t('mcpOAuth.authenticate')}</span>
                            </>
                        )}
                    </Button>
                </div>
            );
        }

        return (
            <div className="flex items-center gap-2">
                {showLabel && <span className="font-medium text-sm text-foreground">{displayName}:</span>}
                <div className="flex items-center gap-1 text-success text-sm">
                    <CheckCircle2 className="size-4" />
                    <span>{t('mcpOAuth.connected')}</span>
                </div>
                {showDisconnect && (
                    <Button variant="ghost" size="sm" onClick={handleDisconnect} disabled={disconnecting}>
                        {disconnecting ? <Spinner className="size-4" /> : t('mcpOAuth.disconnect')}
                    </Button>
                )}
            </div>
        );
    }

    if (authenticated) {
        if (variant === 'compact') {
            return (
                <div className="flex items-center gap-2">
                    {showLabel && <span className="font-medium text-xs text-foreground">{displayName}:</span>}
                    {!readOnly && showDisconnect && (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleDisconnect}
                            disabled={disconnecting}
                            className={compactActionClassName}
                        >
                            {disconnecting ? (
                                <Spinner className="size-3" />
                            ) : (
                                <>
                                    <Unlink2 className="size-3" />
                                    <span>{t('mcpOAuth.disconnect')}</span>
                                </>
                            )}
                        </Button>
                    )}
                </div>
            );
        }

        return (
            <div className="flex items-center gap-1 text-success">
                <CheckCircle2 className="size-4" />
                <span className="text-sm">{t('mcpOAuth.connected')}</span>
            </div>
        );
    }

    if (variant === 'compact') {
        if (readOnly) {
            return (
                <div className="flex items-center gap-2">
                    {showLabel && <span className="font-medium text-xs text-foreground">{collectionName}:</span>}
                    <div className="flex items-center gap-1 text-muted">
                        <span className="text-xs">{t('mcpOAuth.notConnected')}</span>
                    </div>
                </div>
            );
        }

        return (
            <div className="flex items-center gap-2">
                {showLabel && <span className="font-medium text-xs text-foreground">{displayName}:</span>}
                <Button
                    variant="outline"
                    size="sm"
                    onClick={handleConnect}
                    disabled={authenticating}
                    className={compactActionClassName}
                >
                    {authenticating ? (
                        <>
                            <Spinner className="size-3" />
                            <span>{t('mcpOAuth.connecting')}</span>
                        </>
                    ) : (
                        <>
                            <Link2 className="size-3" />
                            <span>{t('mcpOAuth.connect')}</span>
                        </>
                    )}
                </Button>
            </div>
        );
    }

    return (
        <Button variant="outline" size="sm" onClick={handleConnect} disabled={readOnly || authenticating}>
            {authenticating ? (
                <>
                    <Spinner className="size-4" />
                    <span>{t('mcpOAuth.connecting')}</span>
                </>
            ) : (
                <>
                    <Link2 className="size-4 me-1" />
                    <span>{t('mcpOAuth.connect')}</span>
                </>
            )}
        </Button>
    );
}
