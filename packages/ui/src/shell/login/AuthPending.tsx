import { Spinner } from "@vertesia/ui/core";
import { useUITranslation } from "@vertesia/ui/i18n";
import { providerIcon } from "./LoginIcons";
import { StepHeader, StepLayout } from "./LoginPrimitives";
import { type ProviderId, providerLabel } from "./loginUtils";

interface AuthPendingProps {
    provider: ProviderId;
    onCancel?: () => void;
}

export default function AuthPending({ provider, onCancel }: AuthPendingProps) {
    const { t } = useUITranslation();
    const Icon = providerIcon(provider);
    // OIDC has no brand name to drop into "Redirecting to X" — the title needs
    // a noun phrase ("Sign-In Provider"), unlike the button CTA context where
    // providerLabel's "Sign In" reads fine ("Continue with Sign In").
    const titleProvider = provider === "oidc" ? "Sign-In Provider" : providerLabel(provider);

    return (
        <StepLayout centered>
            <div>
                <div className="inline-grid place-items-center size-14 rounded-xl bg-info-background border border-info/15 mb-3.5">
                    <Icon className={provider === "oidc" ? "size-6 text-info" : "size-6"} />
                </div>
                <StepHeader
                    title={t("auth.pending.title", { provider: titleProvider })}
                    body={t("auth.pending.body")}
                />
            </div>

            <div className="w-full flex flex-col gap-2">
                <button
                    type="button"
                    disabled
                    className="h-[42px] inline-flex items-center justify-center gap-2.5 rounded-md bg-foreground text-background text-sm font-medium opacity-90"
                >
                    <Spinner />
                    <span>{t("auth.pending.authenticating")}</span>
                </button>
                {onCancel && (
                    <button
                        type="button"
                        onClick={onCancel}
                        className="h-9 inline-flex items-center justify-center text-sm font-medium text-muted hover:text-foreground transition"
                    >
                        {t("auth.pending.cancel")}
                    </button>
                )}
            </div>
        </StepLayout>
    );
}
