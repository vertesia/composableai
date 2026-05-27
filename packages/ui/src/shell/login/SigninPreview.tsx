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

const MOCK_TENANT_SSO: UIResolvedTenant & TenantInfo = {
    firebaseTenantId: "vertesia-tenant-id",
    name: "Vertesia",
    provider: "google",
    label: "Vertesia",
};

const MOCK_TENANT_OIDC: UIResolvedTenant & TenantInfo = {
    firebaseTenantId: "acme-tenant-id",
    name: "Acme Corp",
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

interface FrameProps {
    title: string;
    sub?: string;
    children: React.ReactNode;
}

function Frame({ title, sub, children }: FrameProps) {
    return (
        <div className="flex flex-col gap-3 rounded-lg border border-border bg-muted-background p-5">
            <div className="border-b border-border pb-2">
                <div className="text-xs font-semibold uppercase tracking-wider text-foreground">{title}</div>
                {sub && <div className="text-[11px] text-muted mt-0.5">{sub}</div>}
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
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-5">
                    <Frame title="Email step" sub="Initial entry. Validates email format on blur.">
                        <EmailStep onProceed={noop} />
                    </Frame>

                    <Frame title="Email step (prefilled)" sub="Returning user navigates back.">
                        <EmailStep initialEmail="charles@vertesiahq.com" onProceed={noop} />
                    </Frame>

                    <Frame title="Providers — known consumer" sub="Gmail/iCloud/etc.">
                        <ProvidersStep email="charles@gmail.com" onBack={noop} onProviderClicked={noop} />
                    </Frame>

                    <Frame title="Providers — unknown domain" sub="No tenant matched; same copy as known.">
                        <ProvidersStep email="charles@acme.com" onBack={noop} onProviderClicked={noop} />
                    </Frame>

                    <Frame title="Tenant — Google Workspace SSO" sub="Single-tenant matched on email domain.">
                        <TenantStep email="alice@vertesia.io" tenant={MOCK_TENANT_SSO} onBack={noop} onProviderClicked={noop} />
                    </Frame>

                    <Frame title="Tenant — generic OIDC" sub="Provider unknown / fallback wording.">
                        <TenantStep email="user@acme.com" tenant={MOCK_TENANT_OIDC} onBack={noop} onProviderClicked={noop} />
                    </Frame>

                    <Frame title="Blocked — known tenant" sub="403 from /auth/ensure-user with tenantName.">
                        <TenantBlockedStep email="charles@cmorman.com" tenantName="Charles Morman - Testing" onBack={noop} />
                    </Frame>

                    <Frame title="Blocked — fallback name" sub="403 with no tenantName (falls back to copy default).">
                        <TenantBlockedStep email="user@acme.com" onBack={noop} />
                    </Frame>

                    <Frame title="Returning — Google" sub="Welcome back, primary button = Google.">
                        <ReturningStep session={MOCK_RETURNING_GOOGLE} onNotYou={noop} onProviderClicked={noop} />
                    </Frame>

                    <Frame title="Returning — SSO with tenant" sub="Primary button shows tenant name.">
                        <ReturningStep session={MOCK_RETURNING_SSO} onNotYou={noop} onProviderClicked={noop} />
                    </Frame>

                    <Frame title="Auth pending — Google" sub="Shown while redirecting to provider.">
                        <AuthPending provider="google" />
                    </Frame>

                    <Frame title="Auth pending — SSO" sub="Shown while redirecting to IdP.">
                        <AuthPending provider="sso" />
                    </Frame>

                    <Frame title="Signup form" sub="Shown on 412 from ensure-user (no invite, no customer block).">
                        <SignupForm onSignup={noop} goBack={noop} />
                    </Frame>
                </div>
            </div>
        </div>
    );
}
