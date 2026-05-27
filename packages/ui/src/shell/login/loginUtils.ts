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

    // Demo mode: SigninScreen drives the alternate flow off a pre-saved
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

// ─── Demo / dev-only signin helpers ────────────────────────────────────────
// One pre-captured Firebase ID token is staged in localStorage from the
// DemoTokenPanel widget. The flow it drives on a provider button click is
// inferred from the token's email domain:
//   • staff domain (vertesiahq.com) → hands the token off to
//     UserSessionProvider's existing token+state hash branch via STS exchange,
//     so the app loads as signed-in.
//   • any other domain → posts the token to /auth/ensure-user directly so the
//     real 403/412/200 response routes the SigninScreen as if OAuth had
//     completed. (Customer-domain identities like cmorman.com will hit the
//     blocked view.)

const DEMO_TOKEN_KEY = "vt.demoToken";
const DEMO_TENANT_NAME_KEY = "vt.demoTenantName";

const STAFF_DEMO_DOMAINS = new Set(["vertesiahq.com"]);

export function isStaffDemoEmail(email: string | undefined): boolean {
    if (!email) return false;
    const at = email.lastIndexOf("@");
    if (at <= 0) return false;
    return STAFF_DEMO_DOMAINS.has(email.slice(at + 1).toLowerCase());
}

export type DemoFlow = "success" | "blocked";

export function demoFlowFor(info: DemoTokenInfo | null): DemoFlow | null {
    if (!info || info.expired) return null;
    return isStaffDemoEmail(info.email) ? "success" : "blocked";
}

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

/** Returns the demo token string if staged and unexpired. */
export function getActiveDemoToken(): string | null {
    const info = readDemoToken();
    return info && !info.expired ? info.token : null;
}

/**
 * Drives the success-flow demo. Seeds sessionStorage so UserSessionProvider's
 * verifyState accepts the synthetic "demo" state, seeds pendingSignin so the
 * post-auth lastSession write picks up the user's email + the supplied provider,
 * then redirects to /#token=...&state=demo. The provider's existing token+state
 * branch (see UserSessionProvider.tsx) takes over from there — exchanges the
 * Firebase token via STS, runs session.login(), and the app re-renders signed-in.
 */
export function startDemoSuccessSignIn(provider: ProviderId = "google"): void {
    const token = getActiveDemoToken();
    if (!token) return;
    const info = inspectDemoToken(token);

    const stateValue = "demo";
    sessionStorage.setItem("auth_state", stateValue);
    sessionStorage.setItem("auth_state_expiry", String(Date.now() + 5 * 60 * 1000));

    sessionStorage.setItem(
        PENDING_SIGNIN_KEY,
        JSON.stringify({
            email: info.email ?? "demo@vertesiahq.com",
            provider,
        }),
    );

    const url = new URL(window.location.href);
    url.hash = `token=${encodeURIComponent(token)}&state=${stateValue}`;
    location.replace(url.toString());
}
