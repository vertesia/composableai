import { getFirebaseAuth, setFirebaseTenant } from '@vertesia/ui/session';
import {
    type AuthProvider,
    GithubAuthProvider,
    GoogleAuthProvider,
    OAuthProvider,
    signInWithRedirect,
} from 'firebase/auth';

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

// Per-provider Firebase provider construction. One named builder per IdP keeps
// each provider's quirks (scopes, custom params) isolated and reachable by id —
// `startSignIn`/`startPersonalSignIn` look them up, so this is the single source
// of truth for provider config across every sign-in surface (tenant + personal).
//
// `email`, when present, becomes a login hint so the entered account is
// pre-selected (Google/Microsoft/OIDC use `login_hint`; GitHub uses `login`).
// Without an email, Google falls back to forcing the account chooser.
type ProviderBuilder = (email?: string, redirectTo?: string) => AuthProvider;

const buildGoogleProvider: ProviderBuilder = (email, redirectTo) => {
    const p = new GoogleAuthProvider();
    p.addScope('profile');
    p.addScope('email');
    p.setCustomParameters({
        redirect_uri: window.location.origin + buildRedirectPath(redirectTo),
        ...(email ? { login_hint: email } : { prompt: 'select_account' }),
    });
    return p;
};

const buildGithubProvider: ProviderBuilder = (email) => {
    const p = new GithubAuthProvider();
    p.addScope('profile');
    p.addScope('email');
    if (email) p.setCustomParameters({ login: email });
    return p;
};

const buildMicrosoftProvider: ProviderBuilder = (email) => {
    const p = new OAuthProvider('microsoft.com');
    p.addScope('profile');
    p.addScope('email');
    if (email) p.setCustomParameters({ login_hint: email });
    return p;
};

const buildOidcProvider: ProviderBuilder = (email) => {
    const p = new OAuthProvider('oidc.main');
    if (email) p.setCustomParameters({ login_hint: email });
    return p;
};

const PROVIDER_BUILDERS: Record<ProviderId, ProviderBuilder> = {
    google: buildGoogleProvider,
    github: buildGithubProvider,
    microsoft: buildMicrosoftProvider,
    oidc: buildOidcProvider,
};

function buildFirebaseProvider(idp: ProviderId, email?: string, redirectTo?: string): AuthProvider {
    return PROVIDER_BUILDERS[idp](email, redirectTo);
}

export async function startSignIn(
    provider: ProviderId,
    email: string,
    redirectTo?: string,
): Promise<{ ok: true } | { ok: false; reason: 'no-email' }> {
    if (!email) return { ok: false, reason: 'no-email' };

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
    void signInWithRedirect(auth, buildFirebaseProvider(effectiveIdp, email, redirectTo));
    return { ok: true };
}

/**
 * Personal (non-tenant) OAuth for the standalone buttons (e.g. SignInModal) that
 * have no email to resolve a tenant from. Clears any stale tenant routing, then
 * redirects with the provider's personal config — same builder as the tenant
 * path, so there's one source of truth for how each provider is constructed.
 */
export function startPersonalSignIn(provider: ProviderId, redirectTo?: string): void {
    const auth = getFirebaseAuth();
    localStorage.removeItem('tenantName');
    if (auth.tenantId) auth.tenantId = null;
    void signInWithRedirect(auth, buildFirebaseProvider(provider, undefined, redirectTo));
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
