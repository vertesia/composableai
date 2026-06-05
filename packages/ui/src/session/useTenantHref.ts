import { useContext } from 'react';
import { UserSessionContext } from './UserSession';

interface TenantRef {
    id: string;
}

/**
 * Append the active tenant (account `a` + project `p`) query params to an internal href so that
 * opening the link in a new tab or copying its address preserves the current account/project.
 *
 * Idempotent: any existing `a`/`p` are replaced rather than duplicated, and other query params and
 * the hash are preserved. Returns the href unchanged for external/non-path hrefs or when the tenant
 * is not known.
 */
export function withTenantParams(href: string, account?: TenantRef, project?: TenantRef): string {
    if (!account || !project || !href.startsWith('/')) {
        return href;
    }
    const url = new URL(href, 'http://localhost'); // dummy base so relative paths parse
    url.searchParams.set('p', project.id);
    url.searchParams.set('a', account.id);
    return url.pathname + url.search + url.hash;
}

/**
 * Resolve an internal href with the active tenant sticky params (account `a` + project `p`) baked
 * into the query string, so that opening the link in a new tab, middle-clicking, or copying its
 * address preserves the current account/project.
 *
 * Reads the session context directly rather than the throwing `useUserSession()` hook, so it is a
 * safe no-op in apps that don't mount a `UserSessionProvider` (e.g. admin-ui). Pass `skip` to leave
 * the href untouched (e.g. for tenant-switching links).
 */
export function useTenantHref(href: string, opts?: { skip?: boolean }): string;
export function useTenantHref(href: string | undefined, opts?: { skip?: boolean }): string | undefined;
export function useTenantHref(href: string | undefined, opts?: { skip?: boolean }): string | undefined {
    const session = useContext(UserSessionContext);
    if (!href || opts?.skip) {
        return href;
    }
    return withTenantParams(href, session?.account, session?.project);
}
