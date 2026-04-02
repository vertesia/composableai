import { useUserSession } from '@vertesia/ui/session';
import { Button, Spinner } from '../../core/index.js';
import { useUITranslation } from '../../i18n/index.js';
import { CheckCircle2, ExternalLink, ShieldAlertIcon } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useOAuthPopup } from './useOAuthPopup.js';

interface McpOAuthConnectButtonProps {
    appId: string;
    collectionName: string;
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
    collection_name: string;
    expires_at?: string;
    mcp_server_url: string;
}

/**
 * Flexible OAuth connect button for MCP tool collections.
 * - 'compact': minimal size for lists (no disconnect)
 * - 'default': standard button size (no disconnect)
 * - 'full': with label, status, and disconnect button
 */
export function McpOAuthConnectButton({
    appId,
    collectionName,
    authenticated: providedAuthenticated,
    onAuthChange,
    onError,
    variant = 'default',
    showLabel = false,
    showDisconnect = false,
    readOnly = false
}: McpOAuthConnectButtonProps) {
    const { client } = useUserSession();
    const { t } = useUITranslation();
    const [status, setStatus] = useState<OAuthStatus | null>(null);
    const [loading, setLoading] = useState(providedAuthenticated === undefined);
    const [authenticating, setAuthenticating] = useState(false);
    const [disconnecting, setDisconnecting] = useState(false);

    // Use provided authenticated status or fetch it
    const authenticated = providedAuthenticated ?? status?.authenticated ?? false;

    const loadStatus = useCallback(async () => {
        if (providedAuthenticated !== undefined) {
            setLoading(false);
            return; // Skip loading if authenticated status is provided
        }

        try {
            setLoading(true);
            const data = await client.mcpOAuth.getCollectionStatus(appId, collectionName);
            setStatus(data);
        } catch (error) {
            console.error('[McpOAuthConnectButton] Failed to load OAuth status:', error);
        } finally {
            setLoading(false);
        }
    }, [client, appId, collectionName, providedAuthenticated]);

    useEffect(() => {
        loadStatus();
    }, [loadStatus]);

    const { openOAuthPopup } = useOAuthPopup({
        onComplete: () => {
            setAuthenticating(false);
            loadStatus();
            onAuthChange?.();
        },
        onError: (error) => {
            console.error('OAuth failed:', error);
            setAuthenticating(false);
        }
    });

    const handleConnect = async () => {
        try {
            setAuthenticating(true);
            onError?.(null);
            const response = await client.mcpOAuth.authorize(appId, collectionName);
            if (response.connected) {
                // Client credentials: token was fetched server-side, no popup needed
                setAuthenticating(false);
                await loadStatus();
                onAuthChange?.();
            } else if (response.authorization_url) {
                openOAuthPopup(response.authorization_url);
            } else {
                onError?.(`${collectionName}: Authorization URL not provided by server`);
                setAuthenticating(false);
            }
        } catch (error) {
            console.error('Failed to authorize:', error);
            const raw = error instanceof Error
                ? ((error as { original_message?: string }).original_message ?? error.message)
                : 'Failed to connect';
            // Strip leading HTTP status text (e.g. "Bad Request: ", "Not Found: ")
            const detail = raw.replace(/^[A-Za-z\s]+:\s/, '');
            onError?.(`${collectionName}: ${detail}`);
            setAuthenticating(false);
        }
    };

    const handleDisconnect = async () => {
        try {
            setDisconnecting(true);
            await client.mcpOAuth.disconnect(appId, collectionName);
            await loadStatus();
            onAuthChange?.();
        } catch (error) {
            console.error('Failed to disconnect:', error);
        } finally {
            setDisconnecting(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center gap-2 text-sm">
                <Spinner className="size-4" />
            </div>
        );
    }

    // Full variant with label and disconnect
    if (variant === 'full') {
        if (!authenticated) {
            return (
                <div className="flex items-center gap-2 text-sm">
                    {showLabel && <span className="font-medium text-foreground">{collectionName}:</span>}
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
                {showLabel && <span className="font-medium text-sm text-foreground">{collectionName}:</span>}
                <div className="flex items-center gap-1 text-success text-sm">
                    <CheckCircle2 className="size-4" />
                    <span>{t('mcpOAuth.connected')}</span>
                </div>
                {showDisconnect && (
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleDisconnect}
                        disabled={disconnecting}
                    >
                        {disconnecting ? <Spinner className="size-4" /> : t('mcpOAuth.disconnect')}
                    </Button>
                )}
            </div>
        );
    }

    // Compact and default variants
    if (authenticated) {
        if (variant === 'compact') {
            return (
                <div className="flex items-center gap-2">
                    {showLabel && <span className="font-medium text-xs text-foreground">{collectionName}:</span>}
                    <div className="flex items-center gap-1 text-success">
                        <CheckCircle2 className="size-3" />
                        <span className="text-xs">{t('mcpOAuth.connected')}</span>
                    </div>
                    {!readOnly && showDisconnect && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleDisconnect}
                            disabled={disconnecting}
                            className="h-6 px-2 text-xs"
                        >
                            {disconnecting ? <Spinner className="size-3" /> : t('mcpOAuth.disconnect')}
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
        // Read-only mode for not authenticated
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
                {showLabel && <span className="font-medium text-xs text-foreground">{collectionName}:</span>}
                <Button
                    variant="outline"
                    size="sm"
                    onClick={handleConnect}
                    disabled={authenticating}
                    className="h-6 px-2 text-xs"
                >
                    {authenticating ? (
                        <>
                            <Spinner className="size-3" />
                            <span>{t('mcpOAuth.connecting')}</span>
                        </>
                    ) : (
                        <>
                            <ExternalLink className="size-3 mr-1" />
                            <span>{t('mcpOAuth.connect')}</span>
                        </>
                    )}
                </Button>
            </div>
        );
    }

    return (
        <Button
            variant="outline"
            size="sm"
            onClick={handleConnect}
            disabled={authenticating}
        >
            {authenticating ? (
                <>
                    <Spinner className="size-4" />
                    <span>{t('mcpOAuth.connecting')}</span>
                </>
            ) : (
                <>
                    <ExternalLink className="size-4 mr-1" />
                    <span>{t('mcpOAuth.connect')}</span>
                </>
            )}
        </Button>
    );
}
