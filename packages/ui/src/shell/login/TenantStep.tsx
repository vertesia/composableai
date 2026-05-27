import { useUITranslation } from "@vertesia/ui/i18n";
import { Lock, Mail } from "lucide-react";
import type { TenantInfo } from "./EmailStep";
import { startSignIn } from "./loginUtils";

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
        google: "Google Workspace",
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

    const onContinue = async () => {
        onProviderClicked();
        // The tenant was already resolved + Firebase tenantId set during EmailStep —
        // calling startSignIn("sso") will route through the configured IdP.
        await startSignIn("sso", email, redirectTo);
    };

    return (
        <div className="w-full max-w-[420px] flex flex-col gap-6">
            <div>
                <div className="text-info text-[12.5px] font-medium mb-2">
                    {t("auth.tenant.eyebrowSso")}
                </div>
                <h1 className="text-foreground text-[22px] font-semibold tracking-tight leading-tight mb-1.5">
                    {t("auth.tenant.title", { name: tenantName })}
                </h1>
                <p className="text-muted text-sm leading-relaxed">{t("auth.tenant.bodySso")}</p>
            </div>

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
                <div className="flex items-center gap-2 px-3 py-2.5 border-t border-border bg-muted-background">
                    <Mail className="size-4 text-muted shrink-0" />
                    <span className="text-sm text-foreground/80 flex-1 truncate">{email}</span>
                    <button
                        type="button"
                        onClick={onBack}
                        className="text-xs text-muted hover:text-foreground transition px-2 py-1 rounded underline decoration-transparent hover:decoration-current underline-offset-[3px]"
                    >
                        {t("auth.change")}
                    </button>
                </div>
            </div>

            <div className="flex flex-col gap-2">
                <button
                    type="button"
                    onClick={onContinue}
                    className="h-[42px] inline-flex items-center justify-center gap-2.5 rounded-md bg-info text-info-foreground text-sm font-medium transition hover:opacity-90"
                >
                    <Lock className="size-4" />
                    {t("auth.tenant.continueWithIdp", { idp: idpName })}
                </button>
                <button
                    type="button"
                    onClick={onBack}
                    className="h-[36px] inline-flex items-center justify-center gap-2 rounded-md bg-transparent text-sm font-medium text-muted transition hover:bg-muted-background hover:text-foreground"
                >
                    {t("auth.tenant.notPartOf", { name: tenantName })}
                </button>
            </div>
        </div>
    );
}
