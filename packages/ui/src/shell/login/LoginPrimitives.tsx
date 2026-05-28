// Shared visual primitives for the sign-in flow. Each step (EmailStep,
// TenantStep, ReturningStep, ProvidersStep, TenantBlockedStep, AuthPending)
// is composed from the building blocks below. Keep these dumb — no state,
// no business logic — so the steps stay easy to read and consistent.
import { Button } from '@vertesia/ui/core';
import { ArrowRight } from 'lucide-react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { providerIcon } from './LoginIcons';
import type { ProviderId } from './loginUtils';

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
                    ? 'w-full max-w-[420px] flex flex-col gap-6 items-center text-center'
                    : 'w-full max-w-[420px] flex flex-col gap-6'
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
    tone?: 'info' | 'destructive';
}

export function StepHeader({ eyebrow, title, body, tone = 'info' }: StepHeaderProps) {
    const eyebrowColor = tone === 'destructive' ? 'text-destructive' : 'text-info';
    return (
        <div>
            {eyebrow && <div className={`${eyebrowColor} text-[12.5px] font-medium mb-2`}>{eyebrow}</div>}
            <h1 className="text-foreground text-[22px] font-semibold tracking-tight leading-tight mb-1.5">{title}</h1>
            {body && <p className="text-muted text-sm leading-relaxed">{body}</p>}
        </div>
    );
}

// ─── Buttons ────────────────────────────────────────────────────────────────

const PRIMARY_BUTTON_BASE =
    'cursor-pointer h-[42px] inline-flex items-center justify-center gap-2.5 rounded-md ' +
    'bg-foreground text-background text-sm font-medium transition hover:opacity-90';

interface PrimaryButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    /**
     * When true, the button is disabled but stays at full visual opacity —
     * used for permanent "in-flight" states (e.g., AuthPending's
     * "Authenticating…" spinner). Without `loading`, the standard disabled
     * style applies (50% opacity).
     */
    loading?: boolean;
}

/**
 * Filled dark CTA used as the screen's primary action.
 * (EmailStep submit; previously TenantStep/ReturningStep, now via ProviderButton.)
 */
export function PrimaryButton({
    className = '',
    type = 'button',
    loading = false,
    disabled,
    ...rest
}: PrimaryButtonProps) {
    const stateClass = loading ? 'opacity-90' : 'disabled:opacity-50 disabled:cursor-not-allowed';
    return (
        <Button
            variant="unstyled"
            size="none"
            type={type}
            disabled={loading || disabled}
            className={`${PRIMARY_BUTTON_BASE} ${stateClass} ${className}`.trim()}
            {...rest}
        />
    );
}

const GHOST_BUTTON_CLASS =
    'cursor-pointer h-[36px] inline-flex items-center justify-center gap-2 rounded-md ' +
    'bg-transparent text-sm font-medium text-muted transition hover:bg-muted-background ' +
    'hover:text-foreground';

/**
 * Transparent secondary action with subtle hover background.
 * (TenantStep "Not part of …?", TenantBlockedStep "Use a different email".)
 */
export function GhostButton({ className = '', type = 'button', ...rest }: ButtonHTMLAttributes<HTMLButtonElement>) {
    return (
        <Button
            variant="unstyled"
            size="none"
            type={type}
            className={className ? `${GHOST_BUTTON_CLASS} ${className}` : GHOST_BUTTON_CLASS}
            {...rest}
        />
    );
}

const PLAIN_LINK_BUTTON_CLASS =
    'cursor-pointer h-9 inline-flex items-center justify-center text-sm font-medium ' +
    'text-muted hover:text-foreground transition';

/**
 * Small unadorned text-link (no bg, no underline, no border) used to reveal
 * alternate flows. (ReturningStep "Use a different sign-in method",
 * AuthPending "Cancel".)
 */
export function PlainLinkButton({ className = '', type = 'button', ...rest }: ButtonHTMLAttributes<HTMLButtonElement>) {
    return (
        <Button
            variant="unstyled"
            size="none"
            type={type}
            className={className ? `${PLAIN_LINK_BUTTON_CLASS} ${className}` : PLAIN_LINK_BUTTON_CLASS}
            {...rest}
        />
    );
}

interface OutlinedProviderButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
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
    className = '',
    type = 'button',
    ...rest
}: OutlinedProviderButtonProps) {
    const Icon = providerIcon(provider);
    const base =
        'cursor-pointer group h-[42px] inline-flex items-center gap-3 pl-3.5 pr-3 rounded-md ' +
        'border border-border bg-background text-sm font-medium text-foreground transition ' +
        'hover:bg-muted-background';
    // !size-X defeats Button base's `[&_svg]:size-4` descendant rule.
    const arrowClass = arrowSlide
        ? '!size-3.5 text-muted opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition'
        : '!size-3.5 text-muted opacity-0 group-hover:opacity-100 transition';
    return (
        <Button
            variant="unstyled"
            size="none"
            type={type}
            className={className ? `${base} ${className}` : base}
            {...rest}
        >
            <Icon className="!size-[18px] shrink-0" />
            <span className="flex-1 text-left">{label}</span>
            <ArrowRight className={arrowClass} />
        </Button>
    );
}

interface InlineLinkButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    /**
     * "xs" → text-xs (default); "smaller" → text-[11px] for the SSO-returning
     * bottom row where the email is also text-xs and the action needs to read
     * lighter still.
     */
    size?: 'xs' | 'smaller';
}

/**
 * Compact underline-on-hover action embedded in info rows.
 * (TenantStep / ProvidersStep "Change", ReturningStep "Not you?".)
 */
export function InlineLinkButton({ size = 'xs', className = '', type = 'button', ...rest }: InlineLinkButtonProps) {
    // `!`-prefixed text/rounded overrides defeat the Button base's
    // `text-sm font-medium rounded-md` so the smaller `text-xs`/`text-[11px]`
    // and `rounded` (not `rounded-md`) actually win.
    const sizeClass = size === 'smaller' ? '!text-[11px]' : '!text-xs';
    const base =
        `cursor-pointer ${sizeClass} text-muted hover:text-foreground !transition px-2 py-1 ` +
        '!rounded underline decoration-transparent hover:decoration-current underline-offset-[3px]';
    return (
        <Button
            variant="unstyled"
            size="none"
            type={type}
            className={className ? `${base} ${className}` : base}
            {...rest}
        />
    );
}

// ─── Provider CTA ──────────────────────────────────────────────────────────

interface ProviderButtonProps {
    provider: ProviderId;
    label: ReactNode;
    onClick?: () => void;
    /**
     * "outline" (default) renders the tall outlined card; "filled" inverts to
     * a dark, theme-tracking CTA using `bg-foreground` / `text-background` so
     * the colors flip naturally in dark mode.
     */
    variant?: 'outline' | 'filled';
    /**
     * "center" (default) centers the icon + label; "start" left-aligns them
     * like a list option (matches the OutlinedProviderButton rhythm).
     */
    align?: 'center' | 'start';
}

/**
 * Canonical "Continue with <provider>" button — tall (py-5) rounded-lg shell
 * with the local provider SVG at 18px and a `font-medium` label.
 *
 * Use this for any "Continue with X" CTA outside the providers-list step. The
 * providers list itself uses `OutlinedProviderButton` (a shorter h-42 row
 * tuned for vertical stacks of options).
 */
export function ProviderButton({
    provider,
    label,
    onClick,
    variant = 'outline',
    align = 'center',
}: ProviderButtonProps) {
    const Icon = providerIcon(provider);
    const variantClass =
        variant === 'filled' ? '!bg-foreground text-background hover:!bg-foreground/90' : 'hover:shadow-sm';
    const alignClass = align === 'start' ? 'justify-start gap-3 pl-3.5 pr-3' : 'text-center';
    const labelClass = align === 'start' ? 'text-sm font-medium flex-1 text-left' : 'text-sm font-medium';
    return (
        <Button
            variant="outline"
            onClick={onClick}
            className={`w-full py-5 flex rounded-lg transition duration-150 ${variantClass} ${alignClass}`}
        >
            {/* !size-[18px] defeats Button's `[&_svg]:size-4` descendant rule. */}
            <Icon className="!size-[18px]" />
            <span className={labelClass}>{label}</span>
        </Button>
    );
}
