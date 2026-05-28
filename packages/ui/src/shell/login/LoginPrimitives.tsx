// Shared visual primitives for the sign-in flow. Each step (EmailStep,
// TenantStep, ReturningStep, ProvidersStep, TenantBlockedStep, AuthPending)
// is composed from the building blocks below. Keep these dumb — no state,
// no business logic — so the steps stay easy to read and consistent.
import { ArrowRight } from "lucide-react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { providerIcon } from "./LoginIcons";
import type { ProviderId } from "./loginUtils";

// ─── Layout ─────────────────────────────────────────────────────────────────

interface StepLayoutProps {
    children: ReactNode;
    /** Centers content (icon-above-title screens like AuthPending). */
    centered?: boolean;
}

export function StepLayout({ children, centered = false }: StepLayoutProps) {
    return (
        <div
            className={
                centered
                    ? "w-full max-w-[420px] flex flex-col gap-6 items-center text-center"
                    : "w-full max-w-[420px] flex flex-col gap-6"
            }
        >
            {children}
        </div>
    );
}

// ─── Step header (eyebrow + title + body) ──────────────────────────────────

interface StepHeaderProps {
    eyebrow?: ReactNode;
    title: ReactNode;
    body?: ReactNode;
    /** "info" (default) gives a blue eyebrow; "destructive" gives the red one. */
    tone?: "info" | "destructive";
}

export function StepHeader({ eyebrow, title, body, tone = "info" }: StepHeaderProps) {
    const eyebrowColor = tone === "destructive" ? "text-destructive" : "text-info";
    return (
        <div>
            {eyebrow && (
                <div className={`${eyebrowColor} text-[12.5px] font-medium mb-2`}>{eyebrow}</div>
            )}
            <h1 className="text-foreground text-[22px] font-semibold tracking-tight leading-tight mb-1.5">
                {title}
            </h1>
            {body && <p className="text-muted text-sm leading-relaxed">{body}</p>}
        </div>
    );
}

// ─── Buttons ────────────────────────────────────────────────────────────────

const PRIMARY_BUTTON_CLASS =
    "cursor-pointer h-[42px] inline-flex items-center justify-center gap-2.5 rounded-md " +
    "bg-foreground text-background text-sm font-medium transition hover:opacity-90 " +
    "disabled:opacity-50 disabled:cursor-not-allowed";

/**
 * Filled dark CTA used as the screen's primary action.
 * (EmailStep submit, TenantStep continue, ReturningStep primary.)
 */
export function PrimaryButton({
    className = "",
    type = "button",
    ...rest
}: ButtonHTMLAttributes<HTMLButtonElement>) {
    return (
        <button
            type={type}
            className={className ? `${PRIMARY_BUTTON_CLASS} ${className}` : PRIMARY_BUTTON_CLASS}
            {...rest}
        />
    );
}

const GHOST_BUTTON_CLASS =
    "cursor-pointer h-[36px] inline-flex items-center justify-center gap-2 rounded-md " +
    "bg-transparent text-sm font-medium text-muted transition hover:bg-muted-background " +
    "hover:text-foreground";

/**
 * Transparent secondary action with subtle hover background.
 * (TenantStep "Not part of …?", TenantBlockedStep "Use a different email".)
 */
export function GhostButton({
    className = "",
    type = "button",
    ...rest
}: ButtonHTMLAttributes<HTMLButtonElement>) {
    return (
        <button
            type={type}
            className={className ? `${GHOST_BUTTON_CLASS} ${className}` : GHOST_BUTTON_CLASS}
            {...rest}
        />
    );
}

interface OutlinedProviderButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
    provider: ProviderId;
    label: ReactNode;
    /** Slide the trailing arrow on hover. ProvidersStep uses this; ReturningStep opts out. */
    arrowSlide?: boolean;
}

/**
 * Bordered provider option with brand icon on the left and a hover-revealed
 * arrow on the right. (ProvidersStep options, ReturningStep "other ways".)
 */
export function OutlinedProviderButton({
    provider,
    label,
    arrowSlide = false,
    className = "",
    type = "button",
    ...rest
}: OutlinedProviderButtonProps) {
    const Icon = providerIcon(provider);
    const base =
        "cursor-pointer group h-[42px] inline-flex items-center gap-3 pl-3.5 pr-3 rounded-md " +
        "border border-border bg-background text-sm font-medium text-foreground transition " +
        "hover:bg-muted-background";
    const arrowClass = arrowSlide
        ? "size-3.5 text-muted opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition"
        : "size-3.5 text-muted opacity-0 group-hover:opacity-100 transition";
    return (
        <button type={type} className={className ? `${base} ${className}` : base} {...rest}>
            <Icon className="size-[18px] shrink-0" />
            <span className="flex-1 text-left">{label}</span>
            <ArrowRight className={arrowClass} />
        </button>
    );
}

interface InlineLinkButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    /**
     * "xs" → text-xs (default); "smaller" → text-[11px] for the SSO-returning
     * bottom row where the email is also text-xs and the action needs to read
     * lighter still.
     */
    size?: "xs" | "smaller";
}

/**
 * Compact underline-on-hover action embedded in info rows.
 * (TenantStep / ProvidersStep "Change", ReturningStep "Not you?".)
 */
export function InlineLinkButton({
    size = "xs",
    className = "",
    type = "button",
    ...rest
}: InlineLinkButtonProps) {
    const sizeClass = size === "smaller" ? "text-[11px]" : "text-xs";
    const base =
        `cursor-pointer ${sizeClass} text-muted hover:text-foreground transition px-2 py-1 ` +
        "rounded underline decoration-transparent hover:decoration-current underline-offset-[3px]";
    return (
        <button type={type} className={className ? `${base} ${className}` : base} {...rest} />
    );
}
