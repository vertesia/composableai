import { useUITranslation } from "@vertesia/ui/i18n";
import { ShieldOff } from "lucide-react";

interface TenantBlockedStepProps {
    email: string;
    /** Tenant display name if known. Falls back to a generic phrase if not. */
    tenantName?: string;
    onBack: () => void;
}

export default function TenantBlockedStep({ email, tenantName, onBack }: TenantBlockedStepProps) {
    const { t } = useUITranslation();
    const name = tenantName || t("auth.blocked.tenantFallback");

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
                    {t("auth.blocked.body", { name, email })}
                </p>
            </div>

            <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-md bg-destructive-background border border-destructive/20">
                <span className="size-6 rounded-md bg-destructive text-destructive-foreground grid place-items-center shrink-0">
                    <ShieldOff className="size-3.5" />
                </span>
                <div className="flex-1 min-w-0 text-sm">
                    <div className="font-semibold text-destructive">{name}</div>
                    <div className="text-xs text-destructive/80">
                        {t("auth.blocked.tenantMeta", { email })}
                    </div>
                </div>
            </div>

            <div className="flex flex-col gap-2">
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
