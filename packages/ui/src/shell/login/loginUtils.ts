import { getFirebaseAuth, setFirebaseTenant } from '@vertesia/ui/session';
import { GithubAuthProvider, GoogleAuthProvider, OAuthProvider, signInWithRedirect } from 'firebase/auth';

// IdP types match auth-tenants.json `provider` values exactly. SSO vs personal
// OAuth is no longer a separate ProviderId — it's derived from whether
// setFirebaseTenant resolves a tenant for the email at sign-in time, and from
// `tenantName` presence on the stored LastSession for the returning view.
export type ProviderId = 'google' | 'github' | 'microsoft' | 'oidc';

export interface LastSession {
    email: string;
    name?: string;
    lastProvider: ProviderId;
    tenantName?: string;
}

const LAST_SESSION_KEY = 'vt.lastSession';
const PENDING_SIGNIN_KEY = 'vt.pendingSignin';

export function readLastSession(): LastSession | null {
    try {
        const raw = localStorage.getItem(LAST_SESSION_KEY);
        if (!raw) return null;
        const v = JSON.parse(raw) as LastSession;
        if (!v?.email || !v?.lastProvider) return null;
        return v;
    } catch {
        return null;
    }
}

export function writeLastSession(s: LastSession): void {
    try {
        localStorage.setItem(LAST_SESSION_KEY, JSON.stringify(s));
    } catch {
        // localStorage unavailable — returning view just won't surface next time
    }
}

export function clearLastSession(): void {
    try {
        localStorage.removeItem(LAST_SESSION_KEY);
    } catch {
        // ignore
    }
}

interface PendingSignin {
    email: string;
    provider: ProviderId;
    tenantName?: string;
}

export function readPendingSignin(): PendingSignin | null {
    try {
        const raw = sessionStorage.getItem(PENDING_SIGNIN_KEY);
        return raw ? (JSON.parse(raw) as PendingSignin) : null;
    } catch {
        return null;
    }
}

function writePendingSignin(p: PendingSignin): void {
    try {
        sessionStorage.setItem(PENDING_SIGNIN_KEY, JSON.stringify(p));
    } catch {
        // ignore
    }
}

export function clearPendingSignin(): void {
    try {
        sessionStorage.removeItem(PENDING_SIGNIN_KEY);
    } catch {
        // ignore
    }
}

function buildRedirectPath(redirectTo?: string): string {
    let path = redirectTo || window.location.pathname || '/';
    if (path[0] !== '/') path = `/${path}`;
    return path;
}

function buildFirebaseProvider(idp: ProviderId, redirectTo?: string) {
    if (idp === 'google') {
        const p = new GoogleAuthProvider();
        p.addScope('profile');
        p.addScope('email');
        p.setCustomParameters({
            prompt: 'select_account',
            redirect_uri: window.location.origin + buildRedirectPath(redirectTo),
        });
        return p;
    }
    if (idp === 'github') return new GithubAuthProvider();
    if (idp === 'microsoft') return new OAuthProvider('microsoft.com');
    return new OAuthProvider('oidc.main');
}

export async function startSignIn(
    provider: ProviderId,
    email: string,
    redirectTo?: string,
): Promise<{ ok: true } | { ok: false; reason: 'no-email' }> {
    if (!email) return { ok: false, reason: 'no-email' };

    // Demo mode: SigninScreen drives the alternate flow off a pre-saved
    // Firebase token. Skip the real OAuth redirect so the demo can complete
    // without the upstream OAuth provider rejecting the dev URL.
    if (hasAnyDemoTokens()) {
        return { ok: true };
    }

    // Resolve the email's tenant. If present → SSO with that tenant's IdP
    // (overriding the user's button pick — the IdP is dictated by the tenant
    // config, not the click). If absent → personal OAuth with the picked IdP.
    const tenant = await setFirebaseTenant(email);
    const auth = getFirebaseAuth();
    let effectiveIdp = provider;
    let tenantName: string | undefined;

    if (tenant) {
        // setFirebaseTenant already set auth.tenantId. Trust tenant.provider
        // for IdP selection — that's the canonical source.
        if (tenant.provider) effectiveIdp = tenant.provider as ProviderId;
        tenantName = tenant.label || tenant.name || undefined;
        localStorage.setItem('tenantName', tenantName ?? '');
    } else {
        // Personal OAuth: clear any stale tenant routing left over from a prior
        // SSO attempt on a different email.
        localStorage.removeItem('tenantName');
        if (auth.tenantId) auth.tenantId = null;
    }

    writePendingSignin({ email, provider: effectiveIdp, tenantName });
    void signInWithRedirect(auth, buildFirebaseProvider(effectiveIdp, redirectTo));
    return { ok: true };
}

export function providerLabel(id: ProviderId): string {
    if (id === 'google') return 'Google';
    if (id === 'github') return 'GitHub';
    if (id === 'microsoft') return 'Microsoft';
    return 'Sign In';
}

export function emailLocalPart(email: string): string {
    if (!email) return '';
    const at = email.lastIndexOf('@');
    return at > 0 ? email.slice(0, at) : email;
}

export function emailDomain(email: string): string {
    if (!email) return '';
    const at = email.lastIndexOf('@');
    return at > 0 ? email.slice(at + 1) : '';
}

export function capitalizeFirst(s: string): string {
    return s ? s[0]!.toUpperCase() + s.slice(1) : s;
}

export function emailInitial(email: string): string {
    return (email || '?')[0]!.toUpperCase();
}

export function firstNameFromEmail(email: string): string {
    const local = emailLocalPart(email);
    const parts = local.split(/[._-]+/).filter(Boolean);
    const first = parts[0] || 'friend';
    return first[0]!.toUpperCase() + first.slice(1).toLowerCase();
}

export function isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((email || '').trim());
}

/**
 * The 403 from /auth/ensure-user. We don't have a typed error class for this
 * (deliberately — see plan), so detect by the server's status code or message.
 * composable.ts wraps non-2xx in STSError-like errors; we look for the literal
 * server-side message.
 */
export function isInviteRequiredError(err: unknown): boolean {
    if (!err) return false;
    const msg = err instanceof Error ? err.message : String(err);
    return msg.includes('Customer-domain user requires an invite to join');
}

// ─── Demo / dev-only signin helpers ────────────────────────────────────────
// Multiple pre-captured Firebase ID tokens can be staged in localStorage from
// the DemoTokenPanel widget, keyed by lowercased email. When the user clicks a
// provider button, the SigninScreen looks up the token whose email matches the
// email they typed (or the email of the returning-session) and runs a flow
// based on that token's domain:
//   • staff domain (vertesiahq.com) → hands the token off to
//     UserSessionProvider's existing token+state hash branch via STS exchange,
//     so the app loads as signed-in.
//   • any other domain → posts the token to /auth/ensure-user directly so the
//     real 403/412/200 response routes the SigninScreen as if OAuth had
//     completed. (Customer-domain identities like cmorman.com will hit the
//     blocked view.)

const DEMO_TOKENS_KEY = 'vt.demoTokens';
const DEMO_TENANT_NAME_KEY = 'vt.demoTenantName';

const STAFF_DEMO_DOMAINS = new Set(['vertesiahq.com']);

export function isStaffDemoEmail(email: string | undefined): boolean {
    if (!email) return false;
    const at = email.lastIndexOf('@');
    if (at <= 0) return false;
    return STAFF_DEMO_DOMAINS.has(email.slice(at + 1).toLowerCase());
}

export type DemoFlow = 'success' | 'blocked';

export function demoFlowFor(info: DemoTokenInfo | null): DemoFlow | null {
    if (!info || info.expired) return null;
    return isStaffDemoEmail(info.email) ? 'success' : 'blocked';
}

function decodeJwtUnverified(token: string): Record<string, unknown> | null {
    try {
        const parts = token.split('.');
        if (parts.length !== 3) return null;
        let payload = parts[1]!.replace(/-/g, '+').replace(/_/g, '/');
        while (payload.length % 4 !== 0) payload += '=';
        return JSON.parse(atob(payload)) as Record<string, unknown>;
    } catch {
        return null;
    }
}

export interface DemoTokenInfo {
    token: string;
    email?: string;
    expiresAt?: Date;
    expired: boolean;
}

export function inspectDemoToken(token: string): DemoTokenInfo {
    const payload = decodeJwtUnverified(token);
    if (!payload) return { token, expired: false };
    const exp = typeof payload.exp === 'number' ? payload.exp : undefined;
    const expiresAt = exp ? new Date(exp * 1000) : undefined;
    return {
        token,
        email: typeof payload.email === 'string' ? payload.email : undefined,
        expiresAt,
        expired: expiresAt ? expiresAt.getTime() <= Date.now() : false,
    };
}

function readStore(): Record<string, string> {
    try {
        const raw = localStorage.getItem(DEMO_TOKENS_KEY);
        if (!raw) return {};
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' ? (parsed as Record<string, string>) : {};
    } catch {
        return {};
    }
}

function writeStore(store: Record<string, string>): void {
    try {
        if (Object.keys(store).length === 0) localStorage.removeItem(DEMO_TOKENS_KEY);
        else localStorage.setItem(DEMO_TOKENS_KEY, JSON.stringify(store));
    } catch {
        // ignore
    }
}

/** Returns all staged demo tokens, fresh (with expiry computed at call time). */
export function listDemoTokens(): DemoTokenInfo[] {
    const store = readStore();
    return Object.values(store).map(inspectDemoToken);
}

/** Decodes a pasted token, adds it to the store under its lowercased email. */
export function addDemoToken(token: string): DemoTokenInfo | null {
    const trimmed = token.trim();
    if (!trimmed) return null;
    const info = inspectDemoToken(trimmed);
    if (!info.email) return null;
    const store = readStore();
    store[info.email.toLowerCase()] = trimmed;
    writeStore(store);
    return info;
}

export function removeDemoToken(email: string): void {
    const store = readStore();
    delete store[email.toLowerCase()];
    writeStore(store);
}

export function clearAllDemoTokens(): void {
    writeStore({});
}

/** Looks up a staged token by the email the user typed (case-insensitive). */
export function lookupDemoToken(email: string | undefined): DemoTokenInfo | null {
    if (!email) return null;
    const store = readStore();
    const raw = store[email.toLowerCase()];
    return raw ? inspectDemoToken(raw) : null;
}

export function hasAnyDemoTokens(): boolean {
    return Object.keys(readStore()).length > 0;
}

export function readDemoTenantName(): string | null {
    try {
        return localStorage.getItem(DEMO_TENANT_NAME_KEY);
    } catch {
        return null;
    }
}

export function writeDemoTenantName(name: string): void {
    try {
        if (name.trim()) localStorage.setItem(DEMO_TENANT_NAME_KEY, name.trim());
        else localStorage.removeItem(DEMO_TENANT_NAME_KEY);
    } catch {
        // ignore
    }
}

/**
 * Drives the success-flow demo. Seeds sessionStorage so UserSessionProvider's
 * verifyState accepts the synthetic "demo" state, seeds pendingSignin so the
 * post-auth lastSession write picks up the user's email + the supplied provider,
 * then redirects to /#token=...&state=demo. The provider's existing token+state
 * branch (see UserSessionProvider.tsx) takes over from there — exchanges the
 * Firebase token via STS, runs session.login(), and the app re-renders signed-in.
 */
export function startDemoSuccessSignIn(
    token: string,
    email: string | undefined,
    provider: ProviderId = 'google',
): void {
    const stateValue = 'demo';
    sessionStorage.setItem('auth_state', stateValue);
    sessionStorage.setItem('auth_state_expiry', String(Date.now() + 5 * 60 * 1000));

    sessionStorage.setItem(
        PENDING_SIGNIN_KEY,
        JSON.stringify({
            email: email ?? 'demo@vertesiahq.com',
            provider,
        }),
    );

    const url = new URL(window.location.href);
    url.hash = `token=${encodeURIComponent(token)}&state=${stateValue}`;
    location.replace(url.toString());
}
