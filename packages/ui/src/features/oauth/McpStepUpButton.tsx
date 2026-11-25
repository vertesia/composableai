import type { McpStepUpScopeMode } from '@vertesia/common';
import { useUITranslation } from '@vertesia/ui/i18n';
import { useUserSession } from '@vertesia/ui/session';
import { KeyRound } from 'lucide-react';
import { useState } from 'react';
import { Button, Spinner, useToast } from '../../core/index.js';
import { oauthErrorDetail } from './oauthStatusError.js';
import { type OAuthPopupResult, useOAuthPopup } from './useOAuthPopup.js';

export interface McpStepUpButtonProps {
    appId: string;
    collectionId: string;
    collectionName?: string;
    /** The scope the MCP server refused a tool call for. */
    requiredScope: string;
    /** The tool the server refused. */
    refusedTool?: string;
    /**
     * Called once the user has reconnected. `missingScope` is the part of `requiredScope` the authorization server
     * did not grant, when it said so.
     */
    onGranted: (missingScope?: string) => void;
    disabled?: boolean;
}

/** The authorization response error of an authorization server that refuses a scope it does not know. */
const INVALID_SCOPE = 'invalid_scope';

/**
 * Asks an already connected user to reconnect an MCP server and grant the scope it refused a tool call for
 * (`insufficient_scope`). The authorization request asks for that scope, the scope already granted and the server's
 * advertised scopes; if the authorization server refuses that union with `invalid_scope`, the user can try again with
 * the refused scope alone.
 */
export function McpStepUpButton({
    appId,
    collectionId,
    collectionName,
    requiredScope,
    refusedTool,
    onGranted,
    disabled = false,
}: McpStepUpButtonProps) {
    const { client } = useUserSession();
    const { t } = useUITranslation();
    const toast = useToast();
    const [authorizing, setAuthorizing] = useState(false);
    const [scopeMode, setScopeMode] = useState<McpStepUpScopeMode>('union');
    const displayName = collectionName ?? collectionId;

    const reportFailure = (detail: string) => {
        toast({ status: 'error', title: t('oauthStatus.connectFailed'), description: `${displayName}: ${detail}` });
    };

    const { openOAuthPopup } = useOAuthPopup({
        onComplete: (result?: OAuthPopupResult) => {
            setAuthorizing(false);
            if (result?.success) {
                onGranted(result.missing_scope);
            } else if (result?.error_code === INVALID_SCOPE && scopeMode === 'union') {
                setScopeMode('challenged');
            }
        },
        onError: (error) => {
            if (scopeMode === 'union' && error.includes(INVALID_SCOPE)) return;
            reportFailure(error);
        },
    });

    const handleGrant = async () => {
        try {
            setAuthorizing(true);
            const response = await client.remoteMcpConnections.authorize(appId, collectionId, {
                required_scope: requiredScope,
                ...(refusedTool ? { refused_tool: refusedTool } : {}),
                scope_mode: scopeMode,
            });
            if (response.authorization_url) {
                openOAuthPopup(response.authorization_url);
            } else {
                // A project credential connects without the user: there is nothing to grant from here.
                setAuthorizing(false);
                onGranted(requiredScope);
            }
        } catch (error) {
            setAuthorizing(false);
            reportFailure(oauthErrorDetail(error) ?? t('oauthStatus.connectFailed'));
        }
    };

    return (
        <div className="flex items-center gap-2">
            {scopeMode === 'challenged' && (
                <span className="text-xs text-attention">{t('mcpOAuth.stepUpInvalidScope')}</span>
            )}
            <Button variant="outline" size="sm" onClick={() => void handleGrant()} disabled={disabled || authorizing}>
                {authorizing ? (
                    <>
                        <Spinner className="size-4" />
                        <span>{t('mcpOAuth.connecting')}</span>
                    </>
                ) : (
                    <>
                        <KeyRound className="size-4 me-1" />
                        <span>
                            {scopeMode === 'challenged' ? t('mcpOAuth.stepUpRetry') : t('mcpOAuth.stepUpGrant')}
                        </span>
                    </>
                )}
            </Button>
        </div>
    );
}
