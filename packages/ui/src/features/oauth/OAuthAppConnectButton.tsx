import type { OAuthAppAuthStatus } from '@vertesia/common';
import { useUserSession } from '@vertesia/ui/session';
import { Button, Spinner } from '../../core/index.js';
import { useUITranslation } from '../../i18n/index.js';
import { CheckCircle2, ExternalLink } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useOAuthPopup } from './useOAuthPopup.js';

interface OAuthAppConnectButtonProps {
    oauthAppId: string;
    onAuthChange?: () => void;
}

/**
 * Connect button for generic OAuth Applications (not MCP-specific).
 * Uses the OAuthApps API for authorize/status/disconnect.
 */
export function OAuthAppConnectButton({ oauthAppId, onAuthChange }: OAuthAppConnectButtonProps) {
    const { client } = useUserSession();
    const { t } = useUITranslation();
    const [status, setStatus] = useState<OAuthAppAuthStatus | null>(null);
    const [loading, setLoading] = useState(true);
    const [authenticating, setAuthenticating] = useState(false);
    const [disconnecting, setDisconnecting] = useState(false);

    const loadStatus = useCallback(async () => {
        try {
            setLoading(true);
            const data = await client.oauthApps.getStatus(oauthAppId);
            setStatus(data);
        } catch (err: unknown) {
            console.error('Failed to load OAuth app status:', err);
        } finally {
            setLoading(false);
        }
    }, [client, oauthAppId]);

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
            console.error('OAuth app auth failed:', error);
            setAuthenticating(false);
        },
    });

    const handleConnect = async () => {
        if (authenticating) return;
        try {
            setAuthenticating(true);
            const response = await client.oauthApps.authorize(oauthAppId);
            if (response.authorization_url) {
                openOAuthPopup(response.authorization_url);
            }
        } catch (err: unknown) {
            console.error('Failed to authorize OAuth app:', err);
            setAuthenticating(false);
        }
    };

    const handleDisconnect = async () => {
        if (disconnecting) return;
        try {
            setDisconnecting(true);
            await client.oauthApps.disconnect(oauthAppId);
            await loadStatus();
            onAuthChange?.();
        } catch (err: unknown) {
            console.error('Failed to disconnect OAuth app:', err);
        } finally {
            setDisconnecting(false);
        }
    };

    if (loading) {
        return <Spinner className="size-4" />;
    }

    if (status?.authenticated) {
        return (
            <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 text-success text-sm">
                    <CheckCircle2 className="size-4" />
                    <span>{t('oauthApps.connected')}</span>
                </div>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDisconnect}
                    disabled={disconnecting}
                >
                    {disconnecting ? <Spinner className="size-3" /> : t('oauthApps.disconnect')}
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
                    <span>{t('oauthApps.authenticating')}</span>
                </>
            ) : (
                <>
                    <ExternalLink className="size-4 mr-1" />
                    <span>{t('oauthApps.authenticate')}</span>
                </>
            )}
        </Button>
    );
}
