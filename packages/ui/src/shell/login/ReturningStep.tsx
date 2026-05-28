import { useUITranslation } from "@vertesia/ui/i18n";
import { ArrowRight, Mail } from "lucide-react";
import { type ComponentType, useState } from "react";
// Buttons mirror TenantStep: dark "Continue with X" primary, plain bordered
// rows for "Other ways" alternatives — matches Tenant + Providers pages.
import { GithubIcon, GoogleIcon, MicrosoftIcon, SsoIcon } from "./LoginIcons";
import {
    type LastSession,
    type ProviderId,
    emailInitial,
    firstNameFromEmail,
    providerLabel,
    startSignIn,
} from "./loginUtils";

interface ReturningStepProps {
    session: LastSession;
    onNotYou: () => void;
    onProviderClicked: (provider: ProviderId) => void;
    redirectTo?: string;
}

const PROVIDER_ICONS: Record<ProviderId, ComponentType<{ className?: string }>> = {
    google: GoogleIcon,
    github: GithubIcon,
    microsoft: MicrosoftIcon,
    oidc: SsoIcon,
};

export default function ReturningStep({ session, onNotYou, onProviderClicked, redirectTo }: ReturningStepProps) {
    const { t } = useUITranslation();
    const [showOthers, setShowOthers] = useState(false);
    const firstName = session.name ? session.name.split(" ")[0]! : firstNameFromEmail(session.email);
    const LastIcon = PROVIDER_ICONS[session.lastProvider];
    // tenantName presence indicates the previous sign-in went through SSO. The
    // button itself looks the same as the personal case — SSO context is
    // conveyed by the tenant card above the button, not by button styling.
    const isSso = !!session.tenantName;
    const primaryLabel = t("auth.continueWithProvider", { provider: providerLabel(session.lastProvider) });

    // "Other ways" alternatives only show personal-OAuth IdPs. OIDC has no
    // personal-OAuth path (it's tenant-driven only) so it's excluded.
    const others: ProviderId[] = (["google", "github", "microsoft"] as ProviderId[]).filter(
        (p) => p !== session.lastProvider,
    );

    const continueWith = async (provider: ProviderId) => {
        onProviderClicked(provider);
        await startSignIn(provider, session.email, redirectTo);
    };

    return (
        <div className="w-full max-w-[420px] flex flex-col gap-6">
            <div>
                <div className="text-info text-[12.5px] font-medium mb-2">
                    {t("auth.returning.eyebrow")}
                </div>
                <h1 className="text-foreground text-[22px] font-semibold tracking-tight leading-tight mb-1.5">
                    {t("auth.returning.title", { name: firstName })}
                </h1>
                <p className="text-muted text-sm leading-relaxed">{t("auth.returning.body")}</p>
            </div>

            {isSso && session.tenantName ? (
                // Two-part user+org card. Top: avatar + name + company. Bottom:
                // Mail icon + email + "Not you?". Shape mirrors TenantStep so
                // both screens read with the same rhythm.
                <div className="rounded-md border border-border bg-background overflow-hidden">
                    <div className="flex items-center gap-3 px-3.5 py-2.5">
                        <div className="size-9 rounded-full bg-info text-info-foreground grid place-items-center text-sm font-semibold ring-4 ring-background ring-offset-1 ring-offset-border shrink-0">
                            {emailInitial(session.email)}
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="text-sm font-semibold text-foreground truncate">
                                {session.name || firstNameFromEmail(session.email)}
                            </div>
                            <div className="text-xs text-foreground/80 truncate">
                                {session.tenantName}
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-3 px-3.5 py-1 border-t border-border bg-muted-background">
                        <div className="w-9 h-6 grid place-items-center shrink-0">
                            <Mail className="size-3.5 text-muted" />
                        </div>
                        <span className="text-xs text-foreground/80 flex-1 truncate">
                            {session.email}
                        </span>
                        <button
                            type="button"
                            onClick={onNotYou}
                            className="cursor-pointer text-[11px] text-muted hover:text-foreground transition px-2 py-1 rounded underline decoration-transparent hover:decoration-current underline-offset-[3px]"
                        >
                            {t("auth.returning.notYou")}
                        </button>
                    </div>
                </div>
            ) : (
                <div className="flex items-center gap-3 px-3.5 py-2.5 rounded-md border border-border bg-muted-background">
                    <div className="size-9 rounded-full bg-info text-info-foreground grid place-items-center text-sm font-semibold ring-4 ring-background ring-offset-1 ring-offset-border shrink-0">
                        {emailInitial(session.email)}
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-foreground truncate">
                            {session.name || firstNameFromEmail(session.email)}
                        </div>
                        <div className="text-xs text-muted truncate">{session.email}</div>
                    </div>
                    <button
                        type="button"
                        onClick={onNotYou}
                        className="cursor-pointer text-xs text-muted hover:text-foreground transition px-2 py-1 rounded underline decoration-transparent hover:decoration-current underline-offset-[3px]"
                    >
                        {t("auth.returning.notYou")}
                    </button>
                </div>
            )}

            <div className="flex flex-col gap-2">
                <button
                    type="button"
                    onClick={() => continueWith(session.lastProvider)}
                    className="cursor-pointer h-[42px] inline-flex items-center justify-center gap-2.5 rounded-md bg-foreground text-background text-sm font-medium transition hover:opacity-90"
                >
                    <LastIcon className="size-[18px]" />
                    {primaryLabel}
                </button>

                {!showOthers && (
                    <button
                        type="button"
                        onClick={() => setShowOthers(true)}
                        className="cursor-pointer h-9 inline-flex items-center justify-center text-sm font-medium text-muted hover:text-foreground transition"
                    >
                        {t("auth.returning.useDifferent")}
                    </button>
                )}

                {showOthers && (
                    <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-3 my-2 text-muted-foreground text-[10.5px] uppercase tracking-widest">
                            <div className="flex-1 h-px bg-border" />
                            <span>{t("auth.returning.otherWays")}</span>
                            <div className="flex-1 h-px bg-border" />
                        </div>
                        {others.map((p) => {
                            const Icon = PROVIDER_ICONS[p];
                            return (
                                <button
                                    key={p}
                                    type="button"
                                    onClick={() => continueWith(p)}
                                    className="cursor-pointer group h-[42px] inline-flex items-center gap-3 pl-3.5 pr-3 rounded-md border border-border bg-background text-sm font-medium text-foreground transition hover:bg-muted-background"
                                >
                                    <Icon className="size-[18px] shrink-0" />
                                    <span className="flex-1 text-left">
                                        {t("auth.continueWithProvider", { provider: providerLabel(p) })}
                                    </span>
                                    <ArrowRight className="size-3.5 text-muted opacity-0 group-hover:opacity-100 transition" />
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
