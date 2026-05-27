import type { UIResolvedTenant } from "@vertesia/common";
import AuthPending from "./AuthPending";
import EmailStep, { type TenantInfo } from "./EmailStep";
import type { LastSession } from "./loginUtils";
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
const MOCK_TENANT_SSO: UIResolvedTenant & TenantInfo = {
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

const MOCK_RETURNING_SSO: LastSession = {
    email: "alice@vertesia.io",
    name: "Alice Example",
    lastProvider: "sso",
    tenantName: "Vertesia",
};

// State per gate: yes/no/n-a for "would this gate fire on the email shown."
type GateState = "yes" | "no" | "na";

interface GateMeta {
    /** Email's domain is in Mongo as account_type=customer + email_domains. Drives the 403. */
    customerBlock: GateState;
    /** Email's domain is in auth-tenants.json. Drives the TenantStep page + SSO routing. */
    authTenant: GateState;
    /** Current step has a specific IdP type bound (Google/Microsoft/etc) vs the generic OIDC fallback. */
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
              ? "text-muted bg-background border-border"
              : "text-muted-foreground bg-background border-border opacity-60";
    const symbol = state === "yes" ? "✓" : state === "no" ? "✗" : "—";
    return (
        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] font-medium ${className}`}>
            <span>{symbol}</span>
            <span>{label}</span>
        </span>
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
                        <Badge label="customer-block" state={meta.customerBlock} />
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
                    <div className="text-xs text-muted mt-3 flex flex-wrap gap-3">
                        <span>
                            <strong className="text-foreground">customer-block</strong> — email's domain is on a
                            Mongo customer account → would 403 on <code>/auth/ensure-user</code>
                        </span>
                        <span>
                            <strong className="text-foreground">auth-tenant</strong> — email's domain is in
                            <code> auth-tenants.json</code> → SSO routing → TenantStep
                        </span>
                        <span>
                            <strong className="text-foreground">provider known</strong> — a specific IdP type
                            (Google/Microsoft) is bound at this step vs the generic OIDC / provider-list fallback
                        </span>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-5">
                    <Frame
                        title="Email step"
                        sub="Initial entry. No email typed yet — no gates evaluated."
                        meta={{ customerBlock: "na", authTenant: "na", providerKnown: "na" }}
                    >
                        <EmailStep onProceed={noop} />
                    </Frame>

                    <Frame
                        title="Email step (prefilled)"
                        sub="charles@vertesiahq.com — staff domain."
                        meta={{ customerBlock: "no", authTenant: "no", providerKnown: "na" }}
                    >
                        <EmailStep initialEmail="charles@vertesiahq.com" onProceed={noop} />
                    </Frame>

                    <Frame
                        title="Providers — known consumer"
                        sub="charles@gmail.com — Gmail/iCloud/etc."
                        meta={{ customerBlock: "no", authTenant: "no", providerKnown: "na" }}
                    >
                        <ProvidersStep email="charles@gmail.com" onBack={noop} onProviderClicked={noop} />
                    </Frame>

                    <Frame
                        title="Providers — unknown domain"
                        sub="charles@acme.com — no tenant matched; same copy as consumer."
                        meta={{ customerBlock: "no", authTenant: "no", providerKnown: "na" }}
                    >
                        <ProvidersStep email="charles@acme.com" onBack={noop} onProviderClicked={noop} />
                    </Frame>

                    <Frame
                        title="Tenant — Google Workspace SSO"
                        sub="alice@vertesia.io — domain resolved a tenant with provider=google."
                        meta={{ customerBlock: "no", authTenant: "yes", providerKnown: "yes" }}
                    >
                        <TenantStep email="alice@vertesia.io" tenant={MOCK_TENANT_SSO} onBack={noop} onProviderClicked={noop} />
                    </Frame>

                    <Frame
                        title="Tenant — generic OIDC"
                        sub="user@acme.com — tenant resolved but provider=oidc → fallback wording."
                        meta={{ customerBlock: "no", authTenant: "yes", providerKnown: "no" }}
                    >
                        <TenantStep email="user@acme.com" tenant={MOCK_TENANT_OIDC} onBack={noop} onProviderClicked={noop} />
                    </Frame>

                    <Frame
                        title="Blocked — known tenant"
                        sub="charles@cmorman.com — 403 from /auth/ensure-user with a tenantName."
                        meta={{ customerBlock: "yes", authTenant: "no", providerKnown: "na" }}
                    >
                        <TenantBlockedStep email="charles@cmorman.com" tenantName="Charles Morman - Testing" onBack={noop} />
                    </Frame>

                    <Frame
                        title="Blocked — fallback name"
                        sub="user@acme.com — 403 with no tenantName (falls back to copy default)."
                        meta={{ customerBlock: "yes", authTenant: "no", providerKnown: "na" }}
                    >
                        <TenantBlockedStep email="user@acme.com" onBack={noop} />
                    </Frame>

                    <Frame
                        title="Returning — Google"
                        sub="charles@vertesiahq.com — last signed in via Google."
                        meta={{ customerBlock: "no", authTenant: "no", providerKnown: "yes" }}
                    >
                        <ReturningStep session={MOCK_RETURNING_GOOGLE} onNotYou={noop} onProviderClicked={noop} />
                    </Frame>

                    <Frame
                        title="Returning — SSO with tenant"
                        sub="alice@vertesia.io — last signed in via Enterprise SSO."
                        meta={{ customerBlock: "no", authTenant: "yes", providerKnown: "yes" }}
                    >
                        <ReturningStep session={MOCK_RETURNING_SSO} onNotYou={noop} onProviderClicked={noop} />
                    </Frame>

                    <Frame
                        title="Auth pending — Google"
                        sub="Shown while redirecting to provider."
                        meta={{ customerBlock: "na", authTenant: "na", providerKnown: "yes" }}
                    >
                        <AuthPending provider="google" />
                    </Frame>

                    <Frame
                        title="Auth pending — SSO"
                        sub="Shown while redirecting to IdP."
                        meta={{ customerBlock: "na", authTenant: "na", providerKnown: "yes" }}
                    >
                        <AuthPending provider="sso" />
                    </Frame>

                    <Frame
                        title="Signup form"
                        sub="412 from ensure-user — no invite, no customer block, no existing user."
                        meta={{ customerBlock: "no", authTenant: "no", providerKnown: "na" }}
                    >
                        <SignupForm onSignup={noop} goBack={noop} />
                    </Frame>
                </div>
            </div>
        </div>
    );
}
