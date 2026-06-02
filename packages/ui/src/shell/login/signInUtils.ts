import { getFirebaseAuth, setFirebaseTenant } from '@vertesia/ui/session';
import {
    type AuthProvider,
    signOut as firebaseSignOut,
    GithubAuthProvider,
    GoogleAuthProvider,
    OAuthProvider,
    signInWithRedirect,
} from 'firebase/auth';

// Matches auth-tenants.json `provider` values. Tenant context is derived from
// email resolution at sign-in time, not encoded here.
export type ProviderId = 'google' | 'github' | 'microsoft' | 'oidc';

export interface LastSuccessfulLogin {
    email: string;
    name?: string;
    lastProvider: ProviderId;
    tenantName?: string;
}

const LAST_SUCCESSFUL_LOGIN_KEY = 'vt.lastSuccessfulLogin';
const PENDING_SIGNIN_KEY = 'vt.pendingSignin';

export function readLastSuccessfulLogin(): LastSuccessfulLogin | null {
    try {
        const raw = localStorage.getItem(LAST_SUCCESSFUL_LOGIN_KEY);
        if (!raw) return null;
        const v = JSON.parse(raw) as LastSuccessfulLogin;
        if (!v?.email || !v?.lastProvider) return null;
        return v;
    } catch {
        return null;
    }
}

export function writeLastSuccessfulLogin(s: LastSuccessfulLogin): void {
    try {
        localStorage.setItem(LAST_SUCCESSFUL_LOGIN_KEY, JSON.stringify(s));
    } catch {
        // localStorage unavailable — the record is not persisted
    }
}

export function clearLastSuccessfulLogin(): void {
    try {
        localStorage.removeItem(LAST_SUCCESSFUL_LOGIN_KEY);
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

/**
 * Clears the persisted sign-in records (last-successful-login and pending) and
 * signs out of Firebase. Best-effort: sign-out errors (e.g. no active session)
 * are swallowed.
 */
export async function resetSignInState(): Promise<void> {
    clearLastSuccessfulLogin();
    clearPendingSignin();
    try {
        await firebaseSignOut(getFirebaseAuth());
    } catch {
        // best-effort: no active session, or auth not initialized
    }
}

function buildRedirectPath(redirectTo?: string): string {
    let path = redirectTo || window.location.pathname || '/';
    if (path[0] !== '/') path = `/${path}`;
    return path;
}

// One Firebase provider builder per IdP, keyed by id. `email` becomes a login
// hint (Google/Microsoft/OIDC: login_hint; GitHub: login); without it, Google
// forces the account chooser.
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

    // A tenant-mapped email uses the tenant's provider (overriding `provider`); otherwise use `provider`.
    const tenant = await setFirebaseTenant(email);
    const auth = getFirebaseAuth();
    let effectiveIdp = provider;
    let tenantName: string | undefined;

    if (tenant) {
        // Tenant config dictates the IdP.
        if (tenant.provider) effectiveIdp = tenant.provider as ProviderId;
        tenantName = tenant.label || tenant.name || undefined;
        localStorage.setItem('tenantName', tenantName ?? '');
    } else {
        // No tenant — clear any stale tenant routing from a prior attempt.
        localStorage.removeItem('tenantName');
        if (auth.tenantId) auth.tenantId = null;
    }

    writePendingSignin({ email, provider: effectiveIdp, tenantName });
    void signInWithRedirect(auth, buildFirebaseProvider(effectiveIdp, email, redirectTo));
    return { ok: true };
}

/** Starts a provider sign-in directly, skipping email/tenant resolution and clearing any tenant routing. */
export function startSignInWithoutTenant(provider: ProviderId, redirectTo?: string): void {
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
    return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

export function emailInitial(email: string): string {
    return (email || '?').charAt(0).toUpperCase();
}

export function firstNameFromEmail(email: string): string {
    const local = emailLocalPart(email);
    const parts = local.split(/[._-]+/).filter(Boolean);
    const first = parts[0] || 'friend';
    return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
}

export function isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((email || '').trim());
}

/**
 * Detects the customer-domain "needs invite" 403 from /auth/ensure-user by its message.
 * Walks the `cause` chain because the token fetch re-wraps the original error.
 */
export function isInviteRequiredError(err: unknown): boolean {
    let current: unknown = err;
    for (let depth = 0; current != null && depth < 8; depth++) {
        const msg = current instanceof Error ? current.message : String(current);
        if (msg.includes('Customer-domain user requires an invite to join')) return true;
        current = current instanceof Error ? current.cause : undefined;
    }
    return false;
}
