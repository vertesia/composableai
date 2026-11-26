import { getOAuthPermissionScopes, Permission } from '@vertesia/common';
import jwt from 'jsonwebtoken';
import type { ConfigResult } from './server/index.js';

// account:member is added to every request by the server, so it says nothing about what the person ticked.
const PERMISSION_SCOPES = new Set<string>(
    getOAuthPermissionScopes().filter((scope) => scope !== Permission.account_member),
);

/**
 * What a person should fix right after an OAuth sign-in, before the profile fails later for a reason it cannot show.
 * The approval page leaves "Renew access" and every permission unticked by default, so both mistakes are easy to make
 * and only surface an hour later (expired, no refresh token) or on the first API call (403).
 */
export function signInWarnings(result: ConfigResult): string[] {
    if (!result.oauth_server_url) return []; // Legacy sign-ins mint a platform token with neither concept.
    const warnings: string[] = [];
    if (!result.refresh_token) {
        warnings.push(
            `This sign-in cannot renew itself, so profile "${result.profile}" signs out when its access token expires. ` +
                'To stay signed in, sign in again and tick "Renew access" on the approval page.',
        );
    }
    const decoded = jwt.decode(result.token, { json: true });
    const scopes = typeof decoded?.scope === 'string' ? decoded.scope.split(' ') : undefined;
    if (scopes && !scopes.some((scope) => PERMISSION_SCOPES.has(scope))) {
        warnings.push(
            'This sign-in granted no platform permissions, so most commands will be refused (403). ' +
                'Sign in again and tick the permissions this profile needs on the approval page.',
        );
    }
    return warnings;
}
