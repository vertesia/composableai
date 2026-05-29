// Shared visual primitives for the sign-in flow. Each step (LoginEmailStep,
// LoginTenantStep, LoginReturningStep, LoginProvidersStep, LoginTenantBlockedStep, LoginAuthPending)
// is composed from the building blocks below. Keep these dumb — no state,
// no business logic — so the steps stay easy to read and consistent.
import { Button } from '@vertesia/ui/core';
import { ArrowRight } from 'lucide-react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { providerIcon } from './LoginIcons';
import type { ProviderId } from './loginUtils';

// ─── Layout ─────────────────────────────────────────────────────────────────

interface LoginStepLayoutProps {
    children: ReactNode;
    /** Centers content (icon-above-title screens like LoginAuthPending). */
    centered?: boolean;
}

export function LoginStepLayout({ children, centered = false }: LoginStepLayoutProps) {
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

interface LoginStepHeaderProps {
    eyebrow?: ReactNode;
    title: ReactNode;
    body?: ReactNode;
    /** "info" (default) gives a blue eyebrow; "destructive" gives the red one. */
    variant?: 'info' | 'destructive';
}

export function LoginStepHeader({ eyebrow, title, body, variant = 'info' }: LoginStepHeaderProps) {
    const eyebrowColor = variant === 'destructive' ? 'text-destructive' : 'text-info';
    return (
        <div>
            {eyebrow && <div className={`${eyebrowColor} text-[12.5px] font-medium mb-2`}>{eyebrow}</div>}
            <h1 className="text-foreground text-[22px] font-semibold tracking-tight leading-tight mb-1.5">{title}</h1>
            {body && <p className="text-muted text-sm leading-relaxed">{body}</p>}
        </div>
    );
}

// ─── Buttons ────────────────────────────────────────────────────────────────

const LOGIN_STEP_BUTTON_BASE = 'cursor-pointer inline-flex items-center justify-center text-sm font-medium transition';

const LOGIN_STEP_BUTTON_VARIANTS = {
    // Filled dark primary CTA. Honors native `disabled` (greys to 50%) for
    // transient in-flight submits, e.g. LoginEmailStep while resolving the tenant.
    primary:
        'h-[42px] gap-2.5 rounded-md bg-foreground text-background hover:opacity-90 ' +
        'disabled:opacity-50 disabled:cursor-not-allowed',
    // Primary look but permanently non-interactive, held near full opacity so a
    // spinner reads as active rather than greyed-out. For always-in-flight
    // screens (LoginAuthPending) — forces `disabled` internally, so there's no toggle.
    loading: 'h-[42px] gap-2.5 rounded-md bg-foreground text-background opacity-90',
    // Flat low-emphasis text link (no bg, border, or underline) for backing out
    // or revealing alternate flows.
    ghost: 'h-9 text-muted hover:text-foreground',
} as const;

interface LoginStepButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    /**
     * "primary" (default) — filled CTA; "loading" — the permanently in-flight
     * primary (non-interactive, spinner-friendly opacity); "ghost" — flat text
     * link.
     */
    variant?: keyof typeof LOGIN_STEP_BUTTON_VARIANTS;
}

/**
 * The button used across every SignInScreen step. `variant` picks the role: the
 * filled `primary` action, its permanently-in-flight `loading` form, or the
 * low-emphasis `ghost` text link.
 */
export function LoginStepButton({
    variant = 'primary',
    className = '',
    type = 'button',
    disabled,
    ...rest
}: LoginStepButtonProps) {
    return (
        <Button
            variant="unstyled"
            size="none"
            type={type}
            // "loading" is inherently non-interactive; other variants honor the prop.
            disabled={variant === 'loading' ? true : disabled}
            className={`${LOGIN_STEP_BUTTON_BASE} ${LOGIN_STEP_BUTTON_VARIANTS[variant]} ${className}`.trim()}
            {...rest}
        />
    );
}

interface LoginInlineLinkButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    /**
     * "xs" → text-xs (default); "smaller" → text-[11px] for the SSO-returning
     * bottom row where the email is also text-xs and the action needs to read
     * lighter still.
     */
    size?: 'xs' | 'smaller';
}

/**
 * Compact underline-on-hover action embedded in info rows.
 * (LoginTenantStep / LoginProvidersStep "Change", LoginReturningStep "Not you?".)
 */
export function LoginInlineLinkButton({
    size = 'xs',
    className = '',
    type = 'button',
    ...rest
}: LoginInlineLinkButtonProps) {
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

interface LoginProviderButtonProps {
    provider: ProviderId;
    label: ReactNode;
    onClick?: () => void;
    /**
     * "outline" (default) renders the tall centered outlined CTA; "filled"
     * inverts it to a dark, theme-tracking CTA using `bg-foreground` /
     * `text-background` so the colors flip naturally in dark mode; "arrow" is
     * the left-aligned bordered list row with a hover-revealed trailing arrow
     * (providers list, "other ways").
     */
    variant?: 'outline' | 'filled' | 'arrow';
    /** Slide the trailing arrow on hover. Only meaningful when variant="arrow". */
    arrowSlide?: boolean;
}

/**
 * Canonical "Continue with <provider>" button with the local provider SVG at
 * 18px and a `font-medium` label. `variant` picks the shell: the centered
 * `outline`/`filled` CTAs (tall, rounded-lg) or the left-aligned `arrow` list
 * row used for stacked provider options.
 */
export function LoginProviderButton({
    provider,
    label,
    onClick,
    variant = 'outline',
    arrowSlide = false,
}: LoginProviderButtonProps) {
    const Icon = providerIcon(provider);

    if (variant === 'arrow') {
        // !size-X defeats Button base's `[&_svg]:size-4` descendant rule.
        const arrowClass = arrowSlide
            ? '!size-3.5 text-muted opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition'
            : '!size-3.5 text-muted opacity-0 group-hover:opacity-100 transition';
        return (
            <Button
                variant="unstyled"
                size="none"
                onClick={onClick}
                className="cursor-pointer group h-[42px] w-full inline-flex items-center gap-3 pl-3.5 pr-3 rounded-md border border-border bg-background text-sm font-medium text-foreground transition hover:bg-muted-background"
            >
                <Icon className="!size-[18px] shrink-0" />
                <span className="flex-1 text-left">{label}</span>
                <ArrowRight className={arrowClass} />
            </Button>
        );
    }

    const variantClass =
        variant === 'filled' ? '!bg-foreground text-background hover:!bg-foreground/90' : 'hover:shadow-sm';
    return (
        <Button
            variant="outline"
            onClick={onClick}
            className={`w-full py-5 flex rounded-lg transition duration-150 text-center ${variantClass}`}
        >
            {/* !size-[18px] defeats Button's `[&_svg]:size-4` descendant rule. */}
            <Icon className="!size-[18px]" />
            <span className="text-sm font-medium">{label}</span>
        </Button>
    );
}
