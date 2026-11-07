import type { OAuthProviderAuthStatus } from '@vertesia/common';
import { useUITranslation } from '@vertesia/ui/i18n';
import { useUserSession } from '@vertesia/ui/session';
import { CheckCircle2, ExternalLink } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Button, Spinner, useToast } from '../../core/index.js';
import { OAuthStatusUnknown } from './OAuthStatusUnknown.js';
import { isOAuthStatusUnknownError, oauthErrorDetail } from './oauthStatusError.js';
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
    const toast = useToast();
    const [status, setStatus] = useState<OAuthProviderAuthStatus | null>(null);
    const [statusUnknown, setStatusUnknown] = useState(false);
    const [loading, setLoading] = useState(true);
    const [authenticating, setAuthenticating] = useState(false);
    const [disconnecting, setDisconnecting] = useState(false);

    const loadStatus = useCallback(async () => {
        try {
            setLoading(true);
            const data = await client.oauthProviders.getStatus(oauthProviderId);
            setStatus(data);
            setStatusUnknown(false);
        } catch (err: unknown) {
            console.error('Failed to load OAuth provider status:', err);
            setStatusUnknown(isOAuthStatusUnknownError(err));
        } finally {
            setLoading(false);
        }
    }, [client, oauthProviderId]);

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
            console.error('OAuth provider auth failed:', error);
            setAuthenticating(false);
            toast({ status: 'error', title: t('oauthStatus.connectFailed'), description: error });
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
            toast({ status: 'error', title: t('oauthStatus.connectFailed'), description: oauthErrorDetail(err) });
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
            toast({ status: 'error', title: t('oauthStatus.disconnectFailed'), description: oauthErrorDetail(err) });
        } finally {
            setDisconnecting(false);
        }
    };

    if (loading) {
        return <Spinner className="size-4" />;
    }

    if (statusUnknown) {
        return <OAuthStatusUnknown onRetry={() => void loadStatus()} />;
    }

    if (status?.authenticated) {
        return (
            <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 text-success text-sm">
                    <CheckCircle2 className="size-4" />
                    <span>{t('oauthProvider.connected')}</span>
                </div>
                <Button variant="outline" size="sm" onClick={handleDisconnect} disabled={disconnecting}>
                    {disconnecting ? <Spinner className="size-3" /> : t('oauthProvider.disconnect')}
                </Button>
            </div>
        );
    }

    return (
        <Button variant="outline" size="sm" onClick={handleConnect} disabled={authenticating}>
            {authenticating ? (
                <>
                    <Spinner className="size-4" />
                    <span>{t('oauthProvider.authenticating')}</span>
                </>
            ) : (
                <>
                    <ExternalLink className="size-4 me-1" />
                    <span>{t('oauthProvider.authenticate')}</span>
                </>
            )}
        </Button>
    );
}
