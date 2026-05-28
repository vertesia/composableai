import type { UIResolvedTenant } from "@vertesia/common";
import { ArrowDown, Mail } from "lucide-react";
import AuthPending from "./AuthPending";
import EmailStep, { type TenantInfo } from "./EmailStep";
import { type LastSession, emailInitial, firstNameFromEmail } from "./loginUtils";
import ProvidersStep from "./ProvidersStep";
import ReturningStep from "./ReturningStep";
import SignupForm from "./SignupForm";
import TenantBlockedStep from "./TenantBlockedStep";
import TenantStep from "./TenantStep";

// Dev-only overview. Renders every SigninScreen step with mock props so the
// visual review (cursor states, semantic colors, spacing, copy) can happen on
// one scroll. Activated by ?preview=signin in the URL — see SigninScreen.tsx.

const noop = () => {};

// Shaped to match what /api/resolve-tenant actually returns: name = slug,
// label = pretty display string. TenantStep now reads label first.
const MOCK_TENANT_GOOGLE: UIResolvedTenant & TenantInfo = {
    firebaseTenantId: "vertesia-tenant-id",
    name: "vertesia",
    label: "Vertesia",
    provider: "google",
};

const MOCK_TENANT_OIDC: UIResolvedTenant & TenantInfo = {
    firebaseTenantId: "acme-tenant-id",
    name: "acme-corp",
    label: "Acme Corp",
    provider: "oidc",
};

const MOCK_RETURNING_GOOGLE: LastSession = {
    email: "charles@vertesiahq.com",
    name: "Charles Morman",
    lastProvider: "google",
};

const MOCK_RETURNING_TENANT_MS: LastSession = {
    email: "alice@vertesia.io",
    name: "Alice Example",
    lastProvider: "microsoft",
    tenantName: "Vertesia",
};

const MOCK_RETURNING_TENANT_OIDC: LastSession = {
    email: "user@acme-corp.com",
    name: "Generic User",
    lastProvider: "oidc",
    tenantName: "Acme Corp",
};

// Variant of the tenant-based returning user+org display: user name + company
// on top, email + "Not you?" on the bottom (mirrors TenantStep's icon + email
// + action row). This is the layout used by the live ReturningStep tenant path.
function UserOrgDisplayEmailBottom({ session }: { session: LastSession }) {
    return (
        <div className="rounded-md border border-border bg-background overflow-hidden">
            <div className="flex items-center gap-3 px-3.5 py-2.5">
                <div className="size-9 rounded-full bg-info text-info-foreground grid place-items-center text-sm font-semibold ring-4 ring-background ring-offset-1 ring-offset-border shrink-0">
                    {emailInitial(session.email)}
                </div>
                <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-foreground truncate">
                        {session.name || firstNameFromEmail(session.email)}
                    </div>
                    {session.tenantName && (
                        <div className="text-xs text-foreground/80 truncate">{session.tenantName}</div>
                    )}
                </div>
            </div>
            <div className="flex items-center gap-3 px-3.5 py-1 border-t border-border bg-muted-background">
                <div className="w-9 h-6 grid place-items-center shrink-0">
                    <Mail className="size-3.5 text-muted" />
                </div>
                <span className="text-xs text-foreground/80 flex-1 truncate">{session.email}</span>
                <button
                    type="button"
                    className="cursor-pointer text-[11px] text-muted hover:text-foreground transition px-2 py-1 rounded underline decoration-transparent hover:decoration-current underline-offset-[3px]"
                >
                    Not you?
                </button>
            </div>
        </div>
    );
}

// Variant of the tenant-based returning user+org display: company sits between
// name and email, all three stacked in a single section (no border-t bottom row).
function UserOrgDisplaySingle({ session }: { session: LastSession }) {
    return (
        <div className="rounded-md border border-border bg-background overflow-hidden">
            <div className="flex items-center gap-3 px-3.5 py-2.5">
                <div className="size-9 rounded-full bg-info text-info-foreground grid place-items-center text-sm font-semibold ring-4 ring-background ring-offset-1 ring-offset-border shrink-0">
                    {emailInitial(session.email)}
                </div>
                <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-foreground truncate">
                        {session.name || firstNameFromEmail(session.email)}
                    </div>
                    {session.tenantName && (
                        <div className="text-xs text-foreground/80 truncate">{session.tenantName}</div>
                    )}
                    <div className="text-xs text-muted truncate">{session.email}</div>
                </div>
                <button
                    type="button"
                    className="cursor-pointer text-xs text-muted hover:text-foreground transition px-2 py-1 rounded underline decoration-transparent hover:decoration-current underline-offset-[3px]"
                >
                    Not you?
                </button>
            </div>
        </div>
    );
}

// What HAS been verified by the UI/server flow path that leads to this screen.
// Distinct from "what's true about the email in the abstract" — these badges
// describe what's actually been checked.
type GateState = "yes" | "no" | "na";

interface GateMeta {
    /** Verified: a 403 from /auth/ensure-user → email's domain is on a customer account. */
    customerDomain: GateState;
    /** Verified: self-serve sign-up has been allowed (412) vs blocked (403). */
    signupAllowed: GateState;
    /** Verified: /api/resolve-tenant matched (yes) or didn't match (no) auth-tenants.json. */
    authTenant: GateState;
    /** Verified: a specific IdP type (Google/Microsoft/GitHub) is bound at this step. */
    providerKnown: GateState;
}

interface FrameProps {
    title: string;
    sub?: string;
    meta?: GateMeta;
    children: React.ReactNode;
}

function Badge({ label, state }: { label: string; state: GateState }) {
    const className =
        state === "yes"
            ? "text-success bg-success-background border-success/30"
            : state === "no"
              ? "text-destructive bg-destructive-background border-destructive/30"
              : "text-muted bg-background border-border opacity-70";
    const symbol = state === "yes" ? "✓" : state === "no" ? "✗" : "—";
    return (
        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] font-medium ${className}`}>
            <span>{symbol}</span>
            <span>{label}</span>
        </span>
    );
}

function FlowArrow({ label }: { label?: string }) {
    return (
        <div className="flex flex-col items-center my-2 text-muted">
            <ArrowDown className="size-6" />
            {label && <div className="text-[11px] font-medium uppercase tracking-wider mt-1">{label}</div>}
        </div>
    );
}

interface SectionProps {
    title: string;
    sub?: string;
    cols?: 2 | 3;
    children: React.ReactNode;
}

function Section({ title, sub, cols = 3, children }: SectionProps) {
    const colsClass =
        cols === 2 ? "grid-cols-1 lg:grid-cols-2" : "grid-cols-1 lg:grid-cols-2 xl:grid-cols-3";
    return (
        <div>
            <div className="mb-3">
                <div className="text-sm font-semibold text-foreground">{title}</div>
                {sub && <div className="text-[11px] text-muted mt-0.5">{sub}</div>}
            </div>
            <div className={`grid ${colsClass} gap-5`}>{children}</div>
        </div>
    );
}

function Frame({ title, sub, meta, children }: FrameProps) {
    return (
        <div className="flex flex-col gap-3 rounded-lg border border-border bg-muted-background p-5">
            <div className="border-b border-border pb-2">
                <div className="text-xs font-semibold uppercase tracking-wider text-foreground">{title}</div>
                {sub && <div className="text-[11px] text-muted mt-0.5">{sub}</div>}
                {meta && (
                    <div className="flex flex-wrap gap-1 mt-2">
                        <Badge label="customer domain" state={meta.customerDomain} />
                        <Badge label="sign-up allowed" state={meta.signupAllowed} />
                        <Badge label="auth-tenant" state={meta.authTenant} />
                        <Badge label="provider known" state={meta.providerKnown} />
                    </div>
                )}
            </div>
            <div className="flex justify-center bg-background rounded-md p-6 min-h-[300px]">{children}</div>
        </div>
    );
}

export default function SigninPreview() {
    return (
        <div className="min-h-screen bg-muted-background p-6 overflow-y-auto">
            <div className="max-w-[1400px] mx-auto">
                <div className="mb-6">
                    <h1 className="text-2xl font-semibold text-foreground">SigninScreen — all states</h1>
                    <p className="text-sm text-muted mt-1">
                        Dev preview. Visit without <code>?preview=signin</code> for the real flow.
                    </p>
                    <div className="text-xs text-muted mt-3">
                        Badges describe what the UI / server flow has{" "}
                        <strong className="text-foreground">verified</strong> by the time the screen renders — not
                        speculative properties of the email. <strong className="text-foreground">—</strong> means the
                        gate hasn't been checked yet at this step.
                    </div>
                    <div className="text-xs text-muted mt-2 flex flex-wrap gap-3">
                        <span>
                            <strong className="text-foreground">customer domain</strong> — confirmed via 403 from{" "}
                            <code>/auth/ensure-user</code>
                        </span>
                        <span>
                            <strong className="text-foreground">sign-up allowed</strong> — 412 from{" "}
                            <code>/auth/ensure-user</code> (✓), or 403 fired (✗)
                        </span>
                        <span>
                            <strong className="text-foreground">auth-tenant</strong> — <code>/api/resolve-tenant</code>{" "}
                            ran and matched (or didn't)
                        </span>
                        <span>
                            <strong className="text-foreground">provider known</strong> — a specific IdP type is bound
                            at this step
                        </span>
                    </div>
                </div>

                <Section title="1. Email step" sub="User types their email and hits Continue.">
                    <Frame
                        title="Email step (empty)"
                        sub="Initial entry. No server check has run yet."
                        meta={{ customerDomain: "na", signupAllowed: "na", authTenant: "na", providerKnown: "na" }}
                    >
                        <EmailStep onProceed={noop} />
                    </Frame>

                    <Frame
                        title="Email step (prefilled)"
                        sub="Same screen with text in the field — nothing checked, just a UI state."
                        meta={{ customerDomain: "na", signupAllowed: "na", authTenant: "na", providerKnown: "na" }}
                    >
                        <EmailStep initialEmail="charles@vertesiahq.com" onProceed={noop} />
                    </Frame>
                </Section>

                <FlowArrow label="POST /api/resolve-tenant" />

                <Section title="2. Tenant step" sub="One of three variations renders based on the resolve-tenant result.">
                    <Frame
                        title="Tenant — no match"
                        sub="Reached because /api/resolve-tenant returned no match. Renders the generic providers list."
                        meta={{ customerDomain: "na", signupAllowed: "na", authTenant: "no", providerKnown: "na" }}
                    >
                        <ProvidersStep email="charles@gmail.com" onBack={noop} onProviderClicked={noop} />
                    </Frame>

                    <Frame
                        title="Tenant — Google"
                        sub="Reached because /api/resolve-tenant returned a tenant with provider=google."
                        meta={{ customerDomain: "na", signupAllowed: "na", authTenant: "yes", providerKnown: "yes" }}
                    >
                        <TenantStep email="alice@vertesia.io" tenant={MOCK_TENANT_GOOGLE} onBack={noop} onProviderClicked={noop} />
                    </Frame>

                    <Frame
                        title="Tenant — generic OIDC"
                        sub="Reached with tenant.provider=oidc → no branded IdP, fallback wording."
                        meta={{ customerDomain: "na", signupAllowed: "na", authTenant: "yes", providerKnown: "no" }}
                    >
                        <TenantStep email="user@acme.com" tenant={MOCK_TENANT_OIDC} onBack={noop} onProviderClicked={noop} />
                    </Frame>
                </Section>

                <FlowArrow label="User clicks provider → Firebase signInWithRedirect" />

                <Section title="3. Auth pending" sub="OAuth redirect in flight." cols={2}>
                    <Frame
                        title="Auth pending — Google"
                        sub="Provider picked; OAuth redirect in flight. Server checks not started."
                        meta={{ customerDomain: "na", signupAllowed: "na", authTenant: "na", providerKnown: "yes" }}
                    >
                        <AuthPending provider="google" />
                    </Frame>

                    <Frame
                        title="Auth pending — OIDC / Fallback"
                        sub="OIDC redirect in flight; auth-tenant must have matched to get here."
                        meta={{ customerDomain: "na", signupAllowed: "na", authTenant: "yes", providerKnown: "yes" }}
                    >
                        <AuthPending provider="oidc" />
                    </Frame>
                </Section>

                <FlowArrow label="OAuth completes → STS 404 → POST /auth/ensure-user" />

                <Section title="4. Post-auth outcome" sub="Three terminal states based on the ensure-user response.">
                    <Frame
                        title="Blocked — Customer+Tenant w/o Invite"
                        sub="403 from /auth/ensure-user. Path went through auth-tenant match; tenantName from tenant.label."
                        meta={{ customerDomain: "yes", signupAllowed: "no", authTenant: "yes", providerKnown: "na" }}
                    >
                        <TenantBlockedStep email="alice@acme-corp.com" tenantName="Acme Corp" onBack={noop} />
                    </Frame>

                    <Frame
                        title="Blocked — Customer w/o Invite"
                        sub="403 with no auth-tenant in path → no tenant name available, i18n fallback used."
                        meta={{ customerDomain: "yes", signupAllowed: "no", authTenant: "no", providerKnown: "na" }}
                    >
                        <TenantBlockedStep email="user@acme.com" onBack={noop} />
                    </Frame>

                    <Frame
                        title="Success — New Self-Serve User Onboard"
                        sub="412 from /auth/ensure-user — no customer block, no existing user, no invite."
                        meta={{ customerDomain: "no", signupAllowed: "yes", authTenant: "na", providerKnown: "na" }}
                    >
                        <SignupForm onSignup={noop} goBack={noop} />
                    </Frame>
                </Section>

                <div className="mt-10 pt-6 border-t border-border">
                    <Section
                        title="Returning visitor (separate entry path)"
                        sub="Shown on revisit when vt.lastSession is present in localStorage — bypasses the email step."
                    >
                        <Frame
                            title="Returning — personal Google"
                            sub="lastProvider=google, no tenantName → last sign-in was personal OAuth."
                            meta={{ customerDomain: "na", signupAllowed: "na", authTenant: "no", providerKnown: "yes" }}
                        >
                            <ReturningStep session={MOCK_RETURNING_GOOGLE} onNotYou={noop} onProviderClicked={noop} />
                        </Frame>

                        <Frame
                            title="Returning Tenant — Microsoft"
                            sub="lastProvider=microsoft, tenantName set → branded tenant last time."
                            meta={{ customerDomain: "na", signupAllowed: "na", authTenant: "yes", providerKnown: "yes" }}
                        >
                            <ReturningStep session={MOCK_RETURNING_TENANT_MS} onNotYou={noop} onProviderClicked={noop} />
                        </Frame>

                        <Frame
                            title="Returning Tenant — OIDC / Fallback"
                            sub="lastProvider=oidc, tenantName set → generic/unbranded tenant last time."
                            meta={{ customerDomain: "na", signupAllowed: "na", authTenant: "yes", providerKnown: "yes" }}
                        >
                            <ReturningStep session={MOCK_RETURNING_TENANT_OIDC} onNotYou={noop} onProviderClicked={noop} />
                        </Frame>
                    </Section>

                    <div className="mt-6">
                        <Section
                            title="User + org display — alt A (single section)"
                            sub="Company between user name and email, all in one section."
                            cols={2}
                        >
                            <Frame title="Alt A — Tenant Microsoft">
                                <UserOrgDisplaySingle session={MOCK_RETURNING_TENANT_MS} />
                            </Frame>
                            <Frame title="Alt A — Tenant OIDC / Fallback">
                                <UserOrgDisplaySingle session={MOCK_RETURNING_TENANT_OIDC} />
                            </Frame>
                        </Section>
                    </div>

                    <div className="mt-6">
                        <Section
                            title="User + org display — alt B (email on bottom)"
                            sub="Name + company on top; email moved to a separate bottom row with Mail icon, matching TenantStep."
                            cols={2}
                        >
                            <Frame title="Alt B — Tenant Microsoft">
                                <UserOrgDisplayEmailBottom session={MOCK_RETURNING_TENANT_MS} />
                            </Frame>
                            <Frame title="Alt B — Tenant OIDC / Fallback">
                                <UserOrgDisplayEmailBottom session={MOCK_RETURNING_TENANT_OIDC} />
                            </Frame>
                        </Section>
                    </div>
                </div>
            </div>
        </div>
    );
}
