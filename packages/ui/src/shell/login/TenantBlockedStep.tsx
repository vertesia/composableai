import { useUITranslation } from "@vertesia/ui/i18n";
import { ShieldOff } from "lucide-react";

interface TenantBlockedStepProps {
    email: string;
    /** Tenant display name if known. Falls back to a generic phrase if not. */
    tenantName?: string;
    onBack: () => void;
}

function emailDomain(e: string): string {
    const at = e.lastIndexOf("@");
    return at > 0 ? e.slice(at + 1) : "";
}

function capitalizeFirst(s: string): string {
    return s ? s[0]!.toUpperCase() + s.slice(1) : s;
}

export default function TenantBlockedStep({ email, tenantName, onBack }: TenantBlockedStepProps) {
    const { t } = useUITranslation();
    // Subheading keeps the i18n fallback ("your organization"). The callout
    // box uses a "<Domain> Team" form so the user sees something concrete when
    // we don't have a real tenant name.
    const subheadingName = tenantName || t("auth.blocked.tenantFallback");
    const domain = emailDomain(email);
    const boxName = tenantName || (domain ? `${capitalizeFirst(domain)} Team` : t("auth.blocked.tenantFallback"));

    return (
        <div className="w-full max-w-[420px] flex flex-col gap-6">
            <div>
                <div className="text-destructive text-[12.5px] font-medium mb-2">
                    {t("auth.blocked.eyebrow")}
                </div>
                <h1 className="text-foreground text-[22px] font-semibold tracking-tight leading-tight mb-1.5">
                    {t("auth.blocked.title")}
                </h1>
                <p className="text-muted text-sm leading-relaxed">
                    {t("auth.blocked.body", { name: subheadingName, email })}
                </p>
            </div>

            <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-md bg-destructive-background border border-destructive/20">
                    <ShieldOff className="size-5 text-destructive shrink-0" />
                    <div className="flex-1 min-w-0 text-sm">
                        <div className="font-semibold text-destructive">{boxName}</div>
                        <div className="text-xs text-destructive/80">
                            {t("auth.blocked.tenantMeta", { email })}
                        </div>
                    </div>
                </div>
                <button
                    type="button"
                    onClick={onBack}
                    className="cursor-pointer h-[36px] inline-flex items-center justify-center gap-2 rounded-md bg-transparent text-sm font-medium text-muted transition hover:bg-muted-background hover:text-foreground"
                >
                    {t("auth.blocked.useDifferent")}
                </button>
            </div>
        </div>
    );
}
