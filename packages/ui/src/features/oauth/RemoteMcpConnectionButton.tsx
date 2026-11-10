import { useUITranslation } from '@vertesia/ui/i18n';
import { useUserSession } from '@vertesia/ui/session';
import { CheckCircle2, Link2, ShieldAlertIcon, Unlink2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Button, Spinner, useToast } from '../../core/index.js';
import { OAuthStatusUnknown } from './OAuthStatusUnknown.js';
import { isOAuthStatusUnknownError, oauthErrorDetail } from './oauthStatusError.js';
import { useOAuthPopup } from './useOAuthPopup.js';

interface RemoteMcpConnectionButtonProps {
    appId: string;
    collectionId: string;
    collectionName?: string;
    /** Pre-fetched authentication status. If not provided, will fetch automatically. */
    authenticated?: boolean;
    /** The parent's status lookup got no answer, so a missing `authenticated` does not mean disconnected. */
    statusUnavailable?: boolean;
    onAuthChange?: () => void;
    /** Receives connect and disconnect failures. Without it they are shown as a toast. */
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
    statusUnavailable = false,
    onAuthChange,
    onError,
    variant = 'default',
    showLabel = false,
    showDisconnect = false,
    readOnly = false,
}: RemoteMcpConnectionButtonProps) {
    const { client } = useUserSession();
    const { t } = useUITranslation();
    const toast = useToast();
    const [status, setStatus] = useState<OAuthStatus | null>(null);
    const [statusError, setStatusError] = useState(false);
    const [loading, setLoading] = useState(providedAuthenticated === undefined && !readOnly);
    const [authenticating, setAuthenticating] = useState(false);
    const [disconnecting, setDisconnecting] = useState(false);

    const authenticated = providedAuthenticated ?? status?.authenticated ?? false;
    const statusUnknown = providedAuthenticated === undefined && (statusError || (statusUnavailable && !status));
    const displayName = collectionName ?? collectionId;
    const compactActionClassName = 'h-6 w-32 justify-center px-2 text-xs';

    const loadStatus = useCallback(async (): Promise<boolean> => {
        if (providedAuthenticated !== undefined) {
            setLoading(false);
            return true;
        }
        if (readOnly) {
            setLoading(false);
            return true;
        }

        try {
            setLoading(true);
            const data = await client.remoteMcpConnections.getCollectionStatus(appId, collectionId);
            setStatus(data);
            setStatusError(false);
            return true;
        } catch (error) {
            console.error('[RemoteMcpConnectionButton] Failed to load OAuth status:', error);
            setStatusError(isOAuthStatusUnknownError(error));
            return false;
        } finally {
            setLoading(false);
        }
    }, [client, appId, collectionId, providedAuthenticated, readOnly]);

    useEffect(() => {
        void loadStatus();
    }, [loadStatus]);

    const reportFailure = (title: string, detail: string) => {
        const message = `${displayName}: ${detail}`;
        if (onError) {
            onError(message);
        } else {
            toast({ status: 'error', title, description: message });
        }
    };

    // A parent may be waiting on this answer: the agent overlay resumes once the connection is authenticated.
    const handleRetryStatus = async () => {
        if (await loadStatus()) {
            onAuthChange?.();
        }
    };

    const { openOAuthPopup } = useOAuthPopup({
        onComplete: () => {
            setAuthenticating(false);
            void loadStatus();
            onAuthChange?.();
        },
        onError: (error) => {
            console.error('OAuth failed:', error);
            setAuthenticating(false);
            reportFailure(t('oauthStatus.connectFailed'), error);
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
                reportFailure(t('oauthStatus.connectFailed'), 'Authorization URL not provided by server');
                setAuthenticating(false);
            }
        } catch (error) {
            console.error('Failed to authorize:', error);
            reportFailure(t('oauthStatus.connectFailed'), oauthErrorDetail(error) ?? t('oauthStatus.connectFailed'));
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
            reportFailure(
                t('oauthStatus.disconnectFailed'),
                oauthErrorDetail(error) ?? t('oauthStatus.disconnectFailed'),
            );
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

    if (statusUnknown) {
        const compact = variant === 'compact';
        return (
            <div className="flex items-center gap-2">
                {showLabel && (
                    <span className={`font-medium text-foreground ${compact ? 'text-xs' : 'text-sm'}`}>
                        {displayName}:
                    </span>
                )}
                <OAuthStatusUnknown
                    onRetry={readOnly ? undefined : () => void handleRetryStatus()}
                    compact={compact}
                    className={compact ? compactActionClassName : undefined}
                />
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
