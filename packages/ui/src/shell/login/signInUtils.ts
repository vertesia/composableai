import { getFirebaseAuth, setFirebaseTenant } from '@vertesia/ui/session';
import { FirebaseError } from 'firebase/app';
import {
    type AuthProvider,
    signOut as firebaseSignOut,
    GithubAuthProvider,
    GoogleAuthProvider,
    OAuthProvider,
    signInWithEmailAndPassword,
    signInWithRedirect,
} from 'firebase/auth';

// Matches auth-tenants.json `provider` values. Tenant context is derived from
// email resolution at sign-in time, not encoded here.
export type ProviderId = 'google' | 'github' | 'microsoft' | 'oidc' | 'password';

/** Providers that sign in by redirecting to an identity provider. `password` signs in in place. */
export type RedirectProviderId = Exclude<ProviderId, 'password'>;

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
 * Whether the current sign-in went through a tenant. The key's presence is the marker, not its
 * value: a tenant with neither a label nor a name stores an empty string, and a sign-in outside a
 * tenant removes the key.
 */
export function isTenantSignIn(): boolean {
    return localStorage.getItem('tenantName') !== null;
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

const PROVIDER_BUILDERS: Record<RedirectProviderId, ProviderBuilder> = {
    google: buildGoogleProvider,
    github: buildGithubProvider,
    microsoft: buildMicrosoftProvider,
    oidc: buildOidcProvider,
};

function buildFirebaseProvider(idp: RedirectProviderId, email?: string, redirectTo?: string): AuthProvider {
    return PROVIDER_BUILDERS[idp](email, redirectTo);
}

export async function startSignIn(
    provider: RedirectProviderId,
    email: string,
    redirectTo?: string,
): Promise<{ ok: true } | { ok: false; reason: 'no-email' | 'password-required' }> {
    if (!email) return { ok: false, reason: 'no-email' };

    // A tenant-mapped email uses the tenant's provider (overriding `provider`); otherwise use `provider`.
    const tenant = await setFirebaseTenant(email);
    const auth = getFirebaseAuth();
    let effectiveIdp: ProviderId = provider;
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

    // A password tenant has no identity provider to redirect to; its step collects the password.
    if (effectiveIdp === 'password') return { ok: false, reason: 'password-required' };

    writePendingSignin({ email, provider: effectiveIdp, tenantName });
    void signInWithRedirect(auth, buildFirebaseProvider(effectiveIdp, email, redirectTo));
    return { ok: true };
}

export type PasswordSignInFailure = 'not-password-tenant' | 'invalid-credentials' | 'too-many-attempts' | 'failed';

// Firebase reports an unknown user, a wrong password and a disabled user with distinct codes on
// some SDK versions; they are folded into one answer so the form does not reveal which it was.
const INVALID_CREDENTIAL_CODES = new Set([
    'auth/invalid-credential',
    'auth/invalid-email',
    'auth/user-disabled',
    'auth/user-not-found',
    'auth/wrong-password',
]);

export function passwordFailureReason(err: unknown): Exclude<PasswordSignInFailure, 'not-password-tenant'> {
    if (!(err instanceof FirebaseError)) return 'failed';
    if (INVALID_CREDENTIAL_CODES.has(err.code)) return 'invalid-credentials';
    if (err.code === 'auth/too-many-requests') return 'too-many-attempts';
    return 'failed';
}

/**
 * Signs in a user of a password tenant, in place — there is no redirect. Only an address whose
 * domain resolves to a tenant configured for password sign-in may use it; the tenant is resolved
 * again here rather than trusted from the caller, so a returning session cannot carry a stale one.
 * On success the session's auth-state listener completes the login.
 */
export async function signInWithPassword(
    email: string,
    password: string,
): Promise<{ ok: true } | { ok: false; reason: PasswordSignInFailure }> {
    const tenant = await setFirebaseTenant(email);
    if (!tenant) return { ok: false, reason: 'failed' };
    if (tenant.provider !== 'password') return { ok: false, reason: 'not-password-tenant' };

    const tenantName = tenant.label || tenant.name || undefined;
    localStorage.setItem('tenantName', tenantName ?? '');
    writePendingSignin({ email, provider: 'password', tenantName });
    try {
        await signInWithEmailAndPassword(getFirebaseAuth(), email, password);
        return { ok: true };
    } catch (err: unknown) {
        clearPendingSignin();
        return { ok: false, reason: passwordFailureReason(err) };
    }
}

/** Starts a provider sign-in directly, skipping email/tenant resolution and clearing any tenant routing. */
export function startSignInWithoutTenant(provider: RedirectProviderId, redirectTo?: string): void {
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

function hasWhitespace(value: string): boolean {
    for (const char of value) {
        if (char.trim() === '') return true;
    }
    return false;
}

export function isValidEmail(email: string): boolean {
    const value = (email || '').trim();
    const at = value.indexOf('@');
    if (at <= 0 || at !== value.lastIndexOf('@')) return false;

    const domain = value.slice(at + 1);
    const dot = domain.indexOf('.');
    return dot > 0 && dot < domain.length - 1 && !hasWhitespace(value);
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
