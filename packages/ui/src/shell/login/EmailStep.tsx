import type { UIResolvedTenant } from "@vertesia/common";
import { Spinner } from "@vertesia/ui/core";
import { useUITranslation } from "@vertesia/ui/i18n";
import { setFirebaseTenant } from "@vertesia/ui/session";
import { ArrowRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { isValidEmail } from "./loginUtils";

export type TenantInfo = UIResolvedTenant;

interface EmailStepProps {
    initialEmail?: string;
    onProceed: (email: string, tenant?: TenantInfo) => void;
}

export default function EmailStep({ initialEmail, onProceed }: EmailStepProps) {
    const { t } = useUITranslation();
    const [email, setEmail] = useState(initialEmail ?? "");
    const [submitError, setSubmitError] = useState(false);
    const [loading, setLoading] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        inputRef.current?.focus();
    }, []);

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (loading) return;
        if (!isValidEmail(email)) {
            setSubmitError(true);
            return;
        }
        setSubmitError(false);
        setLoading(true);
        try {
            const tenant = await setFirebaseTenant(email.trim().toLowerCase());
            onProceed(email.trim().toLowerCase(), tenant ?? undefined);
        } catch {
            // resolveTenant failed quietly — proceed to providers panel
            onProceed(email.trim().toLowerCase(), undefined);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="w-full max-w-[420px] flex flex-col gap-6">
            <div>
                <div className="text-info text-[12.5px] font-medium mb-2">
                    {t("auth.email.eyebrow")}
                </div>
                <h1 className="text-foreground text-[22px] font-semibold tracking-tight leading-tight mb-1.5">
                    {t("auth.email.title")}
                </h1>
                <p className="text-muted text-sm leading-relaxed">
                    {t("auth.email.body")}
                </p>
            </div>

            <form onSubmit={submit} noValidate className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                    <label htmlFor="vt-login-email" className="text-xs font-medium text-foreground/80">
                        {t("auth.email.label")}
                    </label>
                    <input
                        ref={inputRef}
                        id="vt-login-email"
                        name="vt-login-email"
                        type="email"
                        className="h-[42px] px-3.5 rounded-md border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground outline-none transition focus:border-info focus:ring-4 focus:ring-info/15 aria-[invalid=true]:border-destructive aria-[invalid=true]:ring-destructive/15"
                        placeholder={t("auth.email.placeholder")}
                        value={email}
                        onChange={(e) => {
                            setEmail(e.target.value);
                            if (submitError) setSubmitError(false);
                        }}
                        aria-invalid={submitError}
                        autoComplete="off"
                        autoCorrect="off"
                        autoCapitalize="off"
                        spellCheck={false}
                        data-1p-ignore
                        data-lpignore="true"
                        data-form-type="other"
                    />
                    <div className="text-xs text-destructive min-h-[14px]">
                        {submitError ? t("auth.email.invalidError") : ""}
                    </div>
                </div>

                <button
                    type="submit"
                    disabled={loading}
                    className="cursor-pointer h-[42px] inline-flex items-center justify-center gap-2.5 rounded-md bg-foreground text-background text-sm font-medium transition hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {loading ? (
                        <Spinner />
                    ) : (
                        <>
                            <span>{t("auth.continue")}</span>
                            <ArrowRight className="size-3.5" />
                        </>
                    )}
                </button>
            </form>
        </div>
    );
}
