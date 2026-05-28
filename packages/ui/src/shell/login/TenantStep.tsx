import { useUITranslation } from "@vertesia/ui/i18n";
import { Mail } from "lucide-react";
import type { TenantInfo } from "./EmailStep";
import { providerIcon } from "./LoginIcons";
import { GhostButton, InlineLinkButton, PrimaryButton, StepHeader, StepLayout } from "./LoginPrimitives";
import { type ProviderId, startSignIn } from "./loginUtils";

interface TenantStepProps {
    email: string;
    tenant: TenantInfo;
    onBack: () => void;
    onProviderClicked: () => void;
    redirectTo?: string;
}

function tenantInitials(name: string): string {
    return name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((p) => p[0]!.toUpperCase())
        .join("");
}

function providerDisplay(provider: string): string {
    const map: Record<string, string> = {
        google: "Google",
        microsoft: "Microsoft Entra ID",
        oidc: "your identity provider",
        github: "GitHub",
    };
    return map[provider] ?? "your identity provider";
}

export default function TenantStep({ email, tenant, onBack, onProviderClicked, redirectTo }: TenantStepProps) {
    const { t } = useUITranslation();
    const tenantName = tenant.label || tenant.name || t("auth.blocked.tenantFallback");
    const idpName = providerDisplay(tenant.provider ?? "");
    const IdpIcon = providerIcon(tenant.provider);
    // OIDC / unknown providers don't have a recognizable brand to put in
    // "Continue with X" — use a generic CTA instead.
    const isGenericIdp = !tenant.provider || tenant.provider === "oidc";
    const buttonLabel = isGenericIdp
        ? t("auth.tenant.continueGeneric")
        : t("auth.tenant.continueWithIdp", { idp: idpName });

    const onContinue = async () => {
        onProviderClicked();
        // SSO mode is implicit: startSignIn re-runs setFirebaseTenant on the
        // email, sees a tenant resolves, and dispatches with the tenant's IdP.
        // We pass tenant.provider here mainly for type-correctness; startSignIn
        // will override with the canonical tenant.provider anyway.
        await startSignIn((tenant.provider ?? "oidc") as ProviderId, email, redirectTo);
    };

    return (
        <StepLayout>
            <StepHeader
                eyebrow={t("auth.tenant.eyebrowSso")}
                title={t("auth.tenant.title", { name: tenantName })}
                body={t("auth.tenant.bodySso")}
            />

            <div className="rounded-md border border-border bg-background overflow-hidden">
                <div className="flex items-center gap-2.5 px-3 py-2.5">
                    <span className="size-[30px] rounded-md bg-info text-info-foreground grid place-items-center text-[11px] font-semibold shrink-0">
                        {tenantInitials(tenantName)}
                    </span>
                    <div className="flex-1 min-w-0">
                        <div className="text-[13.5px] font-semibold text-foreground leading-tight">
                            {tenantName}
                        </div>
                        <div className="text-[11.5px] text-muted leading-tight mt-0.5">
                            {t("auth.tenant.viaIdp", { idp: idpName })}
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-2.5 px-3 py-1.5 border-t border-border bg-muted-background">
                    <div className="size-[30px] grid place-items-center shrink-0">
                        <Mail className="size-4 text-muted" />
                    </div>
                    <span className="text-sm text-foreground/80 flex-1 truncate">{email}</span>
                    <InlineLinkButton onClick={onBack}>{t("auth.change")}</InlineLinkButton>
                </div>
            </div>

            <div className="flex flex-col gap-2">
                <PrimaryButton onClick={onContinue}>
                    <IdpIcon className="size-[18px]" />
                    {buttonLabel}
                </PrimaryButton>
                <GhostButton onClick={onBack}>
                    {t("auth.tenant.notPartOf", { name: tenantName })}
                </GhostButton>
            </div>
        </StepLayout>
    );
}
