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

const SIGN_IN_STEP_BUTTON_BASE =
    'cursor-pointer inline-flex items-center justify-center text-sm font-medium transition';

const SIGN_IN_STEP_BUTTON_VARIANTS = {
    // Filled dark primary CTA. Honors native `disabled` (greys to 50%) for
    // transient in-flight submits, e.g. EmailStep while resolving the tenant.
    primary:
        'h-[42px] gap-2.5 rounded-md bg-foreground text-background hover:opacity-90 ' +
        'disabled:opacity-50 disabled:cursor-not-allowed',
    // Primary look but permanently non-interactive, held near full opacity so a
    // spinner reads as active rather than greyed-out. For always-in-flight
    // screens (AuthPending) — forces `disabled` internally, so there's no toggle.
    loading: 'h-[42px] gap-2.5 rounded-md bg-foreground text-background opacity-90',
    // Flat low-emphasis text link (no bg, border, or underline) for backing out
    // or revealing alternate flows.
    ghost: 'h-9 text-muted hover:text-foreground',
} as const;

interface SignInStepButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    /**
     * "primary" (default) — filled CTA; "loading" — the permanently in-flight
     * primary (non-interactive, spinner-friendly opacity); "ghost" — flat text
     * link.
     */
    variant?: keyof typeof SIGN_IN_STEP_BUTTON_VARIANTS;
}

/**
 * The button used across every SignInScreen step. `variant` picks the role: the
 * filled `primary` action, its permanently-in-flight `loading` form, or the
 * low-emphasis `ghost` text link.
 */
export function SignInStepButton({
    variant = 'primary',
    className = '',
    type = 'button',
    disabled,
    ...rest
}: SignInStepButtonProps) {
    return (
        <Button
            variant="unstyled"
            size="none"
            type={type}
            // "loading" is inherently non-interactive; other variants honor the prop.
            disabled={variant === 'loading' ? true : disabled}
            className={`${SIGN_IN_STEP_BUTTON_BASE} ${SIGN_IN_STEP_BUTTON_VARIANTS[variant]} ${className}`.trim()}
            {...rest}
        />
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

interface SignInProviderButtonProps {
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
export function SignInProviderButton({
    provider,
    label,
    onClick,
    variant = 'outline',
    arrowSlide = false,
}: SignInProviderButtonProps) {
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
