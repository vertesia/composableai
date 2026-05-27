import { Env } from "@vertesia/ui/env";
import { getFirebaseAuth, setFirebaseTenant } from "@vertesia/ui/session";
import { GithubAuthProvider, GoogleAuthProvider, OAuthProvider, signInWithRedirect } from "firebase/auth";

export type ProviderId = "google" | "github" | "microsoft" | "sso";

export interface LastSession {
    email: string;
    name?: string;
    lastProvider: ProviderId;
    tenantName?: string;
}

const LAST_SESSION_KEY = "vt.lastSession";
const PENDING_SIGNIN_KEY = "vt.pendingSignin";

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
    let path = redirectTo || window.location.pathname || "/";
    if (path[0] !== "/") path = `/${path}`;
    return path;
}

export async function startSignIn(
    provider: ProviderId,
    email: string,
    redirectTo?: string,
): Promise<{ ok: true } | { ok: false; reason: "tenant-not-found" | "no-email" }> {
    if (!email) return { ok: false, reason: "no-email" };

    // Demo mode: SigninScreen drives the alternate flow off the pre-saved
    // Firebase token. Skip the real OAuth redirect so the demo can complete
    // without the upstream OAuth provider rejecting the dev URL.
    if (getActiveDemoToken()) {
        return { ok: true };
    }

    writePendingSignin({ email, provider });

    if (provider === "sso") {
        const data = await setFirebaseTenant(email);
        if (!data) {
            clearPendingSignin();
            return { ok: false, reason: "tenant-not-found" };
        }
        localStorage.setItem("tenantName", data.name ?? "");
        writePendingSignin({ email, provider, tenantName: data.name ?? undefined });
        const providerType = Env.firebase?.providerType;
        const ssoProvider =
            providerType === "google"
                ? (() => {
                      const p = new GoogleAuthProvider();
                      p.addScope("profile");
                      p.addScope("email");
                      p.setCustomParameters({
                          prompt: "select_account",
                          redirect_uri: window.location.origin + buildRedirectPath(redirectTo),
                      });
                      return p;
                  })()
                : providerType === "microsoft"
                  ? new OAuthProvider("microsoft.com")
                  : providerType === "github"
                    ? new OAuthProvider("github.com")
                    : new OAuthProvider("oidc.main");
        void signInWithRedirect(getFirebaseAuth(), ssoProvider);
        return { ok: true };
    }

    // Personal OAuth: clear any prior tenant routing so we don't accidentally
    // sign in against an SSO tenant the user previously selected.
    localStorage.removeItem("tenantName");
    const auth = getFirebaseAuth();
    if (auth.tenantId) auth.tenantId = null;

    if (provider === "google") {
        const p = new GoogleAuthProvider();
        p.addScope("profile");
        p.addScope("email");
        p.setCustomParameters({
            prompt: "select_account",
            redirect_uri: window.location.origin + buildRedirectPath(redirectTo),
        });
        void signInWithRedirect(auth, p);
    } else if (provider === "github") {
        void signInWithRedirect(auth, new GithubAuthProvider());
    } else if (provider === "microsoft") {
        void signInWithRedirect(auth, new OAuthProvider("microsoft.com"));
    }

    return { ok: true };
}

export function providerLabel(id: ProviderId): string {
    if (id === "google") return "Google";
    if (id === "github") return "GitHub";
    if (id === "microsoft") return "Microsoft";
    return "Enterprise SSO";
}

export function emailLocalPart(email: string): string {
    if (!email) return "";
    const at = email.lastIndexOf("@");
    return at > 0 ? email.slice(0, at) : email;
}

export function emailInitial(email: string): string {
    return (email || "?")[0]!.toUpperCase();
}

export function firstNameFromEmail(email: string): string {
    const local = emailLocalPart(email);
    const parts = local.split(/[._-]+/).filter(Boolean);
    const first = parts[0] || "friend";
    return first[0]!.toUpperCase() + first.slice(1).toLowerCase();
}

export function isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((email || "").trim());
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
    return msg.includes("Customer-domain user requires an invite to join");
}

// ─── Demo / dev-only signin helper ─────────────────────────────────────────
// Lets a dev paste a pre-captured Firebase ID token into a UI panel; subsequent
// provider clicks skip real OAuth and hit /auth/ensure-user directly with the
// pasted token. Useful for demos on dev branch URLs where OAuth providers reject
// the redirect URI. Cleared by clicking "Clear" or via clearDemoToken().

const DEMO_TOKEN_KEY = "vt.demoToken";
const DEMO_TENANT_NAME_KEY = "vt.demoTenantName";

function decodeJwtUnverified(token: string): Record<string, unknown> | null {
    try {
        const parts = token.split(".");
        if (parts.length !== 3) return null;
        let payload = parts[1]!.replace(/-/g, "+").replace(/_/g, "/");
        while (payload.length % 4 !== 0) payload += "=";
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
    const exp = typeof payload.exp === "number" ? payload.exp : undefined;
    const expiresAt = exp ? new Date(exp * 1000) : undefined;
    return {
        token,
        email: typeof payload.email === "string" ? payload.email : undefined,
        expiresAt,
        expired: expiresAt ? expiresAt.getTime() <= Date.now() : false,
    };
}

export function readDemoToken(): DemoTokenInfo | null {
    try {
        const t = localStorage.getItem(DEMO_TOKEN_KEY);
        return t ? inspectDemoToken(t) : null;
    } catch {
        return null;
    }
}

export function writeDemoToken(token: string): void {
    try {
        localStorage.setItem(DEMO_TOKEN_KEY, token.trim());
    } catch {
        // ignore
    }
}

export function clearDemoToken(): void {
    try {
        localStorage.removeItem(DEMO_TOKEN_KEY);
    } catch {
        // ignore
    }
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

/** Returns the demo token string if present and unexpired, else null. */
export function getActiveDemoToken(): string | null {
    const info = readDemoToken();
    if (!info || info.expired) return null;
    return info.token;
}
