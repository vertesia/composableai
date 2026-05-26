import { Spinner } from "@vertesia/ui/core";
import { useUITranslation } from "@vertesia/ui/i18n";
import type { ComponentType } from "react";
import { GithubIcon, GoogleIcon, MicrosoftIcon, SsoIcon } from "./LoginIcons";
import { type ProviderId, providerLabel } from "./loginUtils";

interface AuthPendingProps {
    provider: ProviderId;
    onCancel?: () => void;
}

const ICONS: Record<ProviderId, ComponentType<{ className?: string }>> = {
    google: GoogleIcon,
    github: GithubIcon,
    microsoft: MicrosoftIcon,
    sso: SsoIcon,
};

export default function AuthPending({ provider, onCancel }: AuthPendingProps) {
    const { t } = useUITranslation();
    const Icon = ICONS[provider];

    return (
        <div className="w-full max-w-[420px] flex flex-col gap-6 items-center text-center">
            <div>
                <div className="inline-grid place-items-center size-14 rounded-xl bg-info-background border border-info/15 mb-3.5">
                    <Icon className={provider === "sso" ? "size-6 text-info" : "size-6"} />
                </div>
                <h1 className="text-foreground text-[22px] font-semibold tracking-tight leading-tight mb-1.5">
                    {t("auth.pending.title", { provider: providerLabel(provider) })}
                </h1>
                <p className="text-muted text-sm leading-relaxed">{t("auth.pending.body")}</p>
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
        </div>
    );
}
