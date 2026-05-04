import type { OAuthProviderAuthStatus } from '@vertesia/common';
import { useUserSession } from '@vertesia/ui/session';
import { CheckCircle2, ExternalLink } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Button, Spinner } from '../../core/index.js';
import { useUITranslation } from '../../i18n/index.js';
import { useOAuthPopup } from './useOAuthPopup.js';

interface OAuthProviderConnectButtonProps {
    oauthProviderId: string;
    onAuthChange?: () => void;
}

/**
 * Connect button for generic OAuth Providers (not MCP-specific).
 * Uses the OAuth Providers API for authorize/status/disconnect.
 */
export function OAuthProviderConnectButton({ oauthProviderId, onAuthChange }: OAuthProviderConnectButtonProps) {
    const { client } = useUserSession();
    const { t } = useUITranslation();
    const [status, setStatus] = useState<OAuthProviderAuthStatus | null>(null);
    const [loading, setLoading] = useState(true);
    const [authenticating, setAuthenticating] = useState(false);
    const [disconnecting, setDisconnecting] = useState(false);

    const loadStatus = useCallback(async () => {
        try {
            setLoading(true);
            const data = await client.oauthProviders.getStatus(oauthProviderId);
            setStatus(data);
        } catch (err: unknown) {
            console.error('Failed to load OAuth provider status:', err);
        } finally {
            setLoading(false);
        }
    }, [client, oauthProviderId]);

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
            console.error('OAuth provider auth failed:', error);
            setAuthenticating(false);
        },
    });

    const handleConnect = async () => {
        if (authenticating) return;
        try {
            setAuthenticating(true);
            const response = await client.oauthProviders.authorize(oauthProviderId);
            if (response.authorization_url) {
                openOAuthPopup(response.authorization_url);
            }
        } catch (err: unknown) {
            console.error('Failed to authorize OAuth provider:', err);
            setAuthenticating(false);
        }
    };

    const handleDisconnect = async () => {
        if (disconnecting) return;
        try {
            setDisconnecting(true);
            await client.oauthProviders.disconnect(oauthProviderId);
            await loadStatus();
            onAuthChange?.();
        } catch (err: unknown) {
            console.error('Failed to disconnect OAuth provider:', err);
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
                    <span>{t('oauthProvider.connected')}</span>
                </div>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDisconnect}
                    disabled={disconnecting}
                >
                    {disconnecting ? <Spinner className="size-3" /> : t('oauthProvider.disconnect')}
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
                    <span>{t('oauthProvider.authenticating')}</span>
                </>
            ) : (
                <>
                    <ExternalLink className="size-4 mr-1" />
                    <span>{t('oauthProvider.authenticate')}</span>
                </>
            )}
        </Button>
    );
}
