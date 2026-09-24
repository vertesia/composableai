import { appOAuthScopes } from '../src/app-permissions.ts';

/** Public CIMD for this deployment. STS validates it and asks the user for consent. */
export function GET(request) {
    const origin = new URL(request.url).origin;
    const scope = process.env.APP_OAUTH_SCOPES || appOAuthScopes.join(' ');
    const softwareStatement = process.env.APP_OAUTH_SOFTWARE_STATEMENT?.trim();
    return Response.json(
        {
            client_id: `${origin}/.well-known/oauth-client/vertesia-app`,
            client_name: process.env.VITE_APP_NAME || 'Vertesia application',
            redirect_uris: [`${origin}/app`],
            grant_types: [
                'authorization_code',
                ...(scope.split(/\s+/).includes('offline_access') ? ['refresh_token'] : []),
            ],
            response_types: ['code'],
            token_endpoint_auth_method: 'none',
            // Declare only permissions the app needs; STS still limits them to the user's grants.
            scope,
            ...(softwareStatement ? { software_statement: softwareStatement } : {}),
        },
        { headers: { 'Cache-Control': 'public, max-age=60' } },
    );
}
