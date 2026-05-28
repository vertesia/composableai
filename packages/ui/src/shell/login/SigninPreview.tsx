import type { UIResolvedTenant } from '@vertesia/common';
import { Button, Spinner } from '@vertesia/ui/core';
import { useUITranslation } from '@vertesia/ui/i18n';
import { ArrowDown } from 'lucide-react';
import AuthPending from './AuthPending';
import EmailStep, { type TenantInfo } from './EmailStep';
import { providerIcon } from './LoginIcons';
import { OutlinedProviderButton, PlainLinkButton, PrimaryButton, ProviderButton } from './LoginPrimitives';
import type { LastSession, ProviderId } from './loginUtils';
import ProvidersStep from './ProvidersStep';
import ReturningStep from './ReturningStep';
import SignupForm from './SignupForm';
import TenantBlockedStep from './TenantBlockedStep';
import TenantStep from './TenantStep';

// Dev-only overview. Renders every SigninScreen step with mock props so the
// visual review (cursor states, semantic colors, spacing, copy) can happen on
// one scroll. Activated by ?preview=signin in the URL — see SigninScreen.tsx.

const noop = () => {};

// Shaped to match what /api/resolve-tenant actually returns: name = slug,
// label = pretty display string. TenantStep now reads label first.
const MOCK_TENANT_GOOGLE: UIResolvedTenant & TenantInfo = {
    firebaseTenantId: 'vertesia-tenant-id',
    name: 'vertesia',
    label: 'Vertesia',
    provider: 'google',
};

const MOCK_TENANT_OIDC: UIResolvedTenant & TenantInfo = {
    firebaseTenantId: 'acme-tenant-id',
    name: 'acme-corp',
    label: 'Acme Corp',
    provider: 'oidc',
};

const MOCK_RETURNING_GOOGLE: LastSession = {
    email: 'charles@vertesiahq.com',
    name: 'Charles Morman',
    lastProvider: 'google',
};

const MOCK_RETURNING_TENANT_MS: LastSession = {
    email: 'alice@vertesia.io',
    name: 'Alice Example',
    lastProvider: 'microsoft',
    tenantName: 'Vertesia',
};

const MOCK_RETURNING_TENANT_OIDC: LastSession = {
    email: 'user@acme-corp.com',
    name: 'Generic User',
    lastProvider: 'oidc',
    tenantName: 'Acme Corp',
};

// What HAS been verified by the UI/server flow path that leads to this screen.
// Distinct from "what's true about the email in the abstract" — these badges
// describe what's actually been checked.
type GateState = 'yes' | 'no' | 'na';

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
        state === 'yes'
            ? 'text-success bg-success-background border-success/30'
            : state === 'no'
              ? 'text-destructive bg-destructive-background border-destructive/30'
              : 'text-muted bg-background border-border opacity-70';
    const symbol = state === 'yes' ? '✓' : state === 'no' ? '✗' : '—';
    return (
        <span
            className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] font-medium ${className}`}
        >
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
    const colsClass = cols === 2 ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1 lg:grid-cols-2 xl:grid-cols-3';
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

// One frame's worth of "Continue with X" variants. Repeats the same five new
// candidates (primary, secondary, ProviderButton outline/filled/start) plus a
// pre-PR legacy replica, so the three providers (Google, Microsoft, GitHub)
// can be compared side-by-side.
interface ProviderComparisonFrameProps {
    provider: ProviderId;
    label: string;
    /** Optional pre-PR replica. Omit for providers that have no legacy button (e.g. OIDC). */
    legacyImgSrc?: string;
    legacyImgAlt?: string;
}

function ProviderComparisonFrame({ provider, label, legacyImgSrc, legacyImgAlt }: ProviderComparisonFrameProps) {
    const Icon = providerIcon(provider);
    return (
        <Frame title={label}>
            <div className="w-full max-w-[420px] flex flex-col gap-4">
                <div className="flex flex-col">
                    <div className="text-[11px] font-medium text-muted mb-1.5">
                        New — primary (returning user / tenant continue)
                    </div>
                    <PrimaryButton onClick={noop}>
                        <Icon className="size-[18px]" />
                        {label}
                    </PrimaryButton>
                </div>
                <div className="flex flex-col">
                    <div className="text-[11px] font-medium text-muted mb-1.5">
                        New — secondary (providers list / other ways)
                    </div>
                    <OutlinedProviderButton provider={provider} label={label} onClick={noop} />
                </div>
                <div className="flex flex-col">
                    <div className="text-[11px] font-medium text-muted mb-1.5">
                        New — ProviderButton, outline (default)
                    </div>
                    <ProviderButton provider={provider} label={label} onClick={noop} />
                </div>
                <div className="flex flex-col">
                    <div className="text-[11px] font-medium text-muted mb-1.5">New — ProviderButton, filled (dark)</div>
                    <ProviderButton provider={provider} label={label} onClick={noop} variant="filled" />
                </div>
                <div className="flex flex-col">
                    <div className="text-[11px] font-medium text-muted mb-1.5">
                        New — ProviderButton, align=&quot;start&quot;
                    </div>
                    <ProviderButton provider={provider} label={label} onClick={noop} align="start" />
                </div>
                {legacyImgSrc && (
                    <div className="flex flex-col">
                        <div className="text-[11px] font-medium text-muted mb-1.5">
                            Legacy — pre-PR shell with remote &lt;img&gt;
                        </div>
                        {/* Visual replica only — onClick omitted so the preview doesn't fire a real Firebase redirect. */}
                        <Button
                            variant="outline"
                            className="w-full py-5 flex rounded-lg hover:shadow-sm transition duration-150 text-center"
                        >
                            <img className="size-6" src={legacyImgSrc} loading="lazy" alt={legacyImgAlt ?? ''} />
                            <span className="text-sm font-semibold">{label}</span>
                        </Button>
                    </div>
                )}
            </div>
        </Frame>
    );
}

export default function SigninPreview() {
    const { t } = useUITranslation();
    return (
        <div className="min-h-screen bg-muted-background p-6 overflow-y-auto">
            <div className="max-w-[1400px] mx-auto">
                <div className="mb-6">
                    <h1 className="text-2xl font-semibold text-foreground">SigninScreen — all states</h1>
                    <p className="text-sm text-muted mt-1">
                        Dev preview. Visit without <code>?preview=signin</code> for the real flow.
                    </p>
                    <div className="text-xs text-muted mt-3">
                        Badges describe what the UI / server flow has{' '}
                        <strong className="text-foreground">verified</strong> by the time the screen renders — not
                        speculative properties of the email. <strong className="text-foreground">—</strong> means the
                        gate hasn't been checked yet at this step.
                    </div>
                    <div className="text-xs text-muted mt-2 flex flex-wrap gap-3">
                        <span>
                            <strong className="text-foreground">customer domain</strong> — confirmed via 403 from{' '}
                            <code>/auth/ensure-user</code>
                        </span>
                        <span>
                            <strong className="text-foreground">sign-up allowed</strong> — 412 from{' '}
                            <code>/auth/ensure-user</code> (✓), or 403 fired (✗)
                        </span>
                        <span>
                            <strong className="text-foreground">auth-tenant</strong> — <code>/api/resolve-tenant</code>{' '}
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
                        meta={{ customerDomain: 'na', signupAllowed: 'na', authTenant: 'na', providerKnown: 'na' }}
                    >
                        <EmailStep onProceed={noop} />
                    </Frame>

                    <Frame
                        title="Email step (prefilled)"
                        sub="Same screen with text in the field — nothing checked, just a UI state."
                        meta={{ customerDomain: 'na', signupAllowed: 'na', authTenant: 'na', providerKnown: 'na' }}
                    >
                        <EmailStep initialEmail="charles@vertesiahq.com" onProceed={noop} />
                    </Frame>
                </Section>

                <FlowArrow label="POST /api/resolve-tenant" />

                <Section
                    title="2. Tenant step"
                    sub="One of three variations renders based on the resolve-tenant result."
                >
                    <Frame
                        title="Tenant — no match"
                        sub="Reached because /api/resolve-tenant returned no match. Renders the generic providers list."
                        meta={{ customerDomain: 'na', signupAllowed: 'na', authTenant: 'no', providerKnown: 'na' }}
                    >
                        <ProvidersStep email="charles@gmail.com" onBack={noop} onProviderClicked={noop} />
                    </Frame>

                    <Frame
                        title="Tenant — Google"
                        sub="Reached because /api/resolve-tenant returned a tenant with provider=google."
                        meta={{ customerDomain: 'na', signupAllowed: 'na', authTenant: 'yes', providerKnown: 'yes' }}
                    >
                        <TenantStep
                            email="alice@vertesia.io"
                            tenant={MOCK_TENANT_GOOGLE}
                            onBack={noop}
                            onProviderClicked={noop}
                        />
                    </Frame>

                    <Frame
                        title="Tenant — generic OIDC"
                        sub="Reached with tenant.provider=oidc → no branded IdP, fallback wording."
                        meta={{ customerDomain: 'na', signupAllowed: 'na', authTenant: 'yes', providerKnown: 'no' }}
                    >
                        <TenantStep
                            email="user@acme.com"
                            tenant={MOCK_TENANT_OIDC}
                            onBack={noop}
                            onProviderClicked={noop}
                        />
                    </Frame>
                </Section>

                <FlowArrow label="User clicks provider → Firebase signInWithRedirect" />

                <Section title="3. Auth pending" sub="OAuth redirect in flight." cols={2}>
                    <Frame
                        title="Auth pending — Google"
                        sub="Provider picked; OAuth redirect in flight. Server checks not started."
                        meta={{ customerDomain: 'na', signupAllowed: 'na', authTenant: 'na', providerKnown: 'yes' }}
                    >
                        <AuthPending provider="google" />
                    </Frame>

                    <Frame
                        title="Auth pending — OIDC / Fallback"
                        sub="OIDC redirect in flight; auth-tenant must have matched to get here."
                        meta={{ customerDomain: 'na', signupAllowed: 'na', authTenant: 'yes', providerKnown: 'yes' }}
                    >
                        <AuthPending provider="oidc" />
                    </Frame>
                </Section>

                <FlowArrow label="OAuth completes → STS 404 → POST /auth/ensure-user" />

                <Section title="4. Post-auth outcome" sub="Three terminal states based on the ensure-user response.">
                    <Frame
                        title="Blocked — Customer+Tenant w/o Invite"
                        sub="403 from /auth/ensure-user. Path went through auth-tenant match; tenantName from tenant.label."
                        meta={{ customerDomain: 'yes', signupAllowed: 'no', authTenant: 'yes', providerKnown: 'na' }}
                    >
                        <TenantBlockedStep email="alice@acme-corp.com" tenantName="Acme Corp" onBack={noop} />
                    </Frame>

                    <Frame
                        title="Blocked — Customer w/o Invite"
                        sub="403 with no auth-tenant in path → no tenant name available, i18n fallback used."
                        meta={{ customerDomain: 'yes', signupAllowed: 'no', authTenant: 'no', providerKnown: 'na' }}
                    >
                        <TenantBlockedStep email="user@acme.com" onBack={noop} />
                    </Frame>

                    <Frame
                        title="Success — New Self-Serve User Onboard"
                        sub="412 from /auth/ensure-user — no customer block, no existing user, no invite."
                        meta={{ customerDomain: 'no', signupAllowed: 'yes', authTenant: 'na', providerKnown: 'na' }}
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
                            meta={{ customerDomain: 'na', signupAllowed: 'na', authTenant: 'no', providerKnown: 'yes' }}
                        >
                            <ReturningStep session={MOCK_RETURNING_GOOGLE} onNotYou={noop} onProviderClicked={noop} />
                        </Frame>

                        <Frame
                            title="Returning Tenant — Microsoft"
                            sub="lastProvider=microsoft, tenantName set → branded tenant last time."
                            meta={{
                                customerDomain: 'na',
                                signupAllowed: 'na',
                                authTenant: 'yes',
                                providerKnown: 'yes',
                            }}
                        >
                            <ReturningStep
                                session={MOCK_RETURNING_TENANT_MS}
                                onNotYou={noop}
                                onProviderClicked={noop}
                            />
                        </Frame>

                        <Frame
                            title="Returning Tenant — OIDC / Fallback"
                            sub="lastProvider=oidc, tenantName set → generic/unbranded tenant last time."
                            meta={{
                                customerDomain: 'na',
                                signupAllowed: 'na',
                                authTenant: 'yes',
                                providerKnown: 'yes',
                            }}
                        >
                            <ReturningStep
                                session={MOCK_RETURNING_TENANT_OIDC}
                                onNotYou={noop}
                                onProviderClicked={noop}
                            />
                        </Frame>
                    </Section>

                    <div className="mt-6">
                        <Section
                            title="Provider buttons — new wrapper vs legacy"
                            sub="Each column: PrimaryButton + OutlinedProviderButton + the new ProviderButton primitive in three variants, with the pre-PR shell at the bottom (OIDC has no pre-PR equivalent)."
                            cols={3}
                        >
                            <ProviderComparisonFrame
                                provider="google"
                                label={t('auth.continueWithGoogle')}
                                legacyImgSrc="https://www.svgrepo.com/show/475656/google-color.svg"
                                legacyImgAlt="google logo"
                            />
                            <ProviderComparisonFrame
                                provider="microsoft"
                                label={t('auth.continueWithMicrosoft')}
                                legacyImgSrc="https://learn.microsoft.com/en-us/entra/identity-platform/media/howto-add-branding-in-apps/ms-symbollockup_mssymbol_19.svg"
                                legacyImgAlt="microsoft logo"
                            />
                            <ProviderComparisonFrame
                                provider="github"
                                label={t('auth.continueWithGithub')}
                                legacyImgSrc="https://www.svgrepo.com/show/503359/github.svg"
                                legacyImgAlt="github logo"
                            />
                            <ProviderComparisonFrame provider="oidc" label={t('auth.tenant.continueGeneric')} />
                        </Section>
                    </div>

                    <div className="mt-6">
                        <Section
                            title="Auxiliary buttons — raw vs composableai Button"
                            sub="Comparing the existing raw &lt;button&gt; implementations against composableai-Button-based primitives. Bottom row is what the new step components actually render."
                            cols={2}
                        >
                            <Frame title="Plain link (Use a different sign-in method / Cancel)">
                                <div className="w-full max-w-[420px] flex flex-col gap-4">
                                    <div className="flex flex-col">
                                        <div className="text-[11px] font-medium text-muted mb-1.5">
                                            A — raw &lt;button&gt; (pre-conversion)
                                        </div>
                                        <button
                                            type="button"
                                            className="cursor-pointer h-9 inline-flex items-center justify-center text-sm font-medium text-muted hover:text-foreground transition"
                                        >
                                            Use a different sign-in method
                                        </button>
                                    </div>
                                    <div className="flex flex-col">
                                        <div className="text-[11px] font-medium text-muted mb-1.5">
                                            B — Button variant=&quot;link&quot;
                                        </div>
                                        <Button variant="link">Use a different sign-in method</Button>
                                    </div>
                                    <div className="flex flex-col">
                                        <div className="text-[11px] font-medium text-muted mb-1.5">
                                            C — Button variant=&quot;ghost&quot;
                                        </div>
                                        <Button variant="ghost">Use a different sign-in method</Button>
                                    </div>
                                    <div className="flex flex-col">
                                        <div className="text-[11px] font-medium text-muted mb-1.5">
                                            D — PlainLinkButton (new primitive, visually matches A)
                                        </div>
                                        <PlainLinkButton>Use a different sign-in method</PlainLinkButton>
                                    </div>
                                </div>
                            </Frame>

                            <Frame title="Loading state (Authenticating…)">
                                <div className="w-full max-w-[420px] flex flex-col gap-4">
                                    <div className="flex flex-col">
                                        <div className="text-[11px] font-medium text-muted mb-1.5">
                                            A — raw &lt;button&gt; disabled, opacity-90 (pre-conversion)
                                        </div>
                                        <button
                                            type="button"
                                            disabled
                                            className="h-[42px] inline-flex items-center justify-center gap-2.5 rounded-md bg-foreground text-background text-sm font-medium opacity-90"
                                        >
                                            <Spinner />
                                            <span>Authenticating</span>
                                        </button>
                                    </div>
                                    <div className="flex flex-col">
                                        <div className="text-[11px] font-medium text-muted mb-1.5">
                                            B — Button variant=&quot;primary&quot; disabled (different blue + 50%
                                            opacity)
                                        </div>
                                        <Button variant="primary" disabled>
                                            <Spinner />
                                            <span>Authenticating</span>
                                        </Button>
                                    </div>
                                    <div className="flex flex-col">
                                        <div className="text-[11px] font-medium text-muted mb-1.5">
                                            C — PrimaryButton disabled (50% opacity — looks muted)
                                        </div>
                                        <PrimaryButton disabled>
                                            <Spinner />
                                            <span>Authenticating</span>
                                        </PrimaryButton>
                                    </div>
                                    <div className="flex flex-col">
                                        <div className="text-[11px] font-medium text-muted mb-1.5">
                                            D — PrimaryButton loading (90% opacity — &quot;active but waiting&quot;)
                                        </div>
                                        <PrimaryButton loading>
                                            <Spinner />
                                            <span>Authenticating</span>
                                        </PrimaryButton>
                                    </div>
                                </div>
                            </Frame>
                        </Section>
                    </div>
                </div>
            </div>
        </div>
    );
}
