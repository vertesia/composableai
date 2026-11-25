import type { McpStepUpScopeMode } from '@vertesia/common';
import { useUITranslation } from '@vertesia/ui/i18n';
import { useUserSession } from '@vertesia/ui/session';
import { KeyRound } from 'lucide-react';
import { useRef, useState } from 'react';
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

/** The part of `required` that `granted` lacks, or undefined when all of it was granted or `granted` is unknown. */
function missingScope(required: string, granted: string | undefined): string | undefined {
    if (granted === undefined) return undefined;
    const held = new Set(granted.split(/\s+/));
    const missing = required.split(/\s+/).filter((token) => token && !held.has(token));
    return missing.length > 0 ? missing.join(' ') : undefined;
}

/** The reconnect this button started: how to recognise its outcome. */
interface StepUpAttempt {
    /** The OAuth `state`: only the callback message for it counts. */
    state?: string;
    /** Reported by the collection status once the grant of this reconnect is stored. Absent from older servers. */
    id?: string;
}

/**
 * Asks an already connected user to reconnect an MCP server and grant the scope it refused a tool call for
 * (`insufficient_scope`). The authorization request asks for that scope, the scope already granted and the server's
 * advertised scopes; if the authorization server refuses that union with `invalid_scope`, the user can try again with
 * the refused scope alone.
 *
 * The outcome is that of this reconnect only. The collection status confirms it by the attempt id the authorize call
 * returned, which also works when this app runs on another origin than the callback page, whose message cannot reach
 * it; the callback message counts only for this reconnect's OAuth `state`.
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
    const attemptRef = useRef<StepUpAttempt | undefined>(undefined);
    // A union attempt that ended without a confirmed grant. An app on another origin than the callback page never
    // hears an `invalid_scope` refusal, so it then also offers to ask for the refused scope alone.
    const [unconfirmed, setUnconfirmed] = useState(false);
    const displayName = collectionName ?? collectionId;

    const reportFailure = (detail: string) => {
        toast({ status: 'error', title: t('oauthStatus.connectFailed'), description: `${displayName}: ${detail}` });
    };

    /** Whether the stored grant is this reconnect's, and the scope it lacks when the server says. */
    const confirmAttempt = async (
        attempt: StepUpAttempt,
        result: OAuthPopupResult | undefined,
    ): Promise<{ granted: boolean; missing?: string }> => {
        if (attempt.id) {
            const status = await client.remoteMcpConnections.getCollectionStatus(appId, collectionId);
            if (!status.authenticated || status.step_up_attempt !== attempt.id) return { granted: false };
            return { granted: true, missing: result?.missing_scope ?? missingScope(requiredScope, status.scope) };
        }
        // A server that predates attempt ids: only this reconnect's own callback message tells.
        return result?.success ? { granted: true, missing: result.missing_scope } : { granted: false };
    };

    const { openOAuthPopup } = useOAuthPopup({
        onComplete: (result?: OAuthPopupResult) => {
            const attempt = attemptRef.current;
            attemptRef.current = undefined;
            if (result?.error_code === INVALID_SCOPE && scopeMode === 'union') {
                setAuthorizing(false);
                setScopeMode('challenged');
                return;
            }
            if (!attempt) {
                setAuthorizing(false);
                return;
            }
            confirmAttempt(attempt, result)
                .then(({ granted, missing }) => {
                    setAuthorizing(false);
                    if (granted) onGranted(missing);
                    else if (scopeMode === 'union') setUnconfirmed(true);
                })
                .catch((error: unknown) => {
                    setAuthorizing(false);
                    reportFailure(oauthErrorDetail(error) ?? t('oauthStatus.connectFailed'));
                });
        },
        onError: (error) => {
            if (scopeMode === 'union' && error.includes(INVALID_SCOPE)) return;
            reportFailure(error);
        },
    });

    const handleGrant = async (mode: McpStepUpScopeMode = scopeMode) => {
        try {
            setAuthorizing(true);
            setUnconfirmed(false);
            if (mode !== scopeMode) setScopeMode(mode);
            const response = await client.remoteMcpConnections.authorize(appId, collectionId, {
                required_scope: requiredScope,
                ...(refusedTool ? { refused_tool: refusedTool } : {}),
                scope_mode: mode,
            });
            if (response.authorization_url) {
                attemptRef.current = { state: response.state, id: response.step_up_attempt };
                openOAuthPopup(response.authorization_url, response.state ? { state: response.state } : {});
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
            {unconfirmed && scopeMode === 'union' && (
                <span className="text-xs text-attention">{t('mcpOAuth.stepUpNotConfirmed')}</span>
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
            {unconfirmed && scopeMode === 'union' && !authorizing && (
                <Button variant="ghost" size="sm" onClick={() => void handleGrant('challenged')} disabled={disabled}>
                    {t('mcpOAuth.stepUpChallengedOnly')}
                </Button>
            )}
        </div>
    );
}
