export const CENTRAL_AUTH_URL = 'https://internal-auth.vertesia.app/';

export interface AuthSelection {
    accountId?: string;
    projectId?: string;
}

export function buildCentralAuthRedirectUrl(
    currentHref: string,
    stsEndpoint: string,
    state: string,
    { accountId, projectId }: AuthSelection = {},
): string {
    const authUrl = new URL(CENTRAL_AUTH_URL);
    authUrl.searchParams.set('sts', stsEndpoint);

    const redirectUrl = new URL(currentHref);
    redirectUrl.hash = '';
    if (projectId) redirectUrl.searchParams.set('p', projectId);
    if (accountId) redirectUrl.searchParams.set('a', accountId);

    authUrl.searchParams.set('redirect_uri', redirectUrl.toString());
    authUrl.searchParams.set('state', state);
    return authUrl.toString();
}
