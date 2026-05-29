// Stateless visual primitives shared by the sign-in steps.
import { Button } from '@vertesia/ui/core';
import { ArrowRight } from 'lucide-react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { providerIcon } from './LoginIcons';
import type { ProviderId } from './loginUtils';

// ─── Layout ─────────────────────────────────────────────────────────────────

interface LoginStepLayoutProps {
    children: ReactNode;
    /** Center-align content. */
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
    /** Eyebrow color: blue (info) or red (destructive). */
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
    // Filled CTA; greys out when disabled.
    primary:
        'h-[42px] gap-2.5 rounded-md bg-foreground text-background hover:opacity-90 ' +
        'disabled:opacity-50 disabled:cursor-not-allowed',
    // Non-interactive primary kept at full opacity (spinner reads as active).
    loading: 'h-[42px] gap-2.5 rounded-md bg-foreground text-background opacity-90',
    // Flat text link.
    ghost: 'h-9 text-muted hover:text-foreground',
} as const;

interface LoginStepButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: keyof typeof LOGIN_STEP_BUTTON_VARIANTS;
}

/** Button used across the sign-in steps. */
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
            // loading is always non-interactive.
            disabled={variant === 'loading' ? true : disabled}
            className={`${LOGIN_STEP_BUTTON_BASE} ${LOGIN_STEP_BUTTON_VARIANTS[variant]} ${className}`.trim()}
            {...rest}
        />
    );
}

interface LoginInlineLinkButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    /** Text size: xs (default) or smaller. */
    size?: 'xs' | 'smaller';
}

/** Compact inline text link for info rows ("Change", "Not you?"). */
export function LoginInlineLinkButton({
    size = 'xs',
    className = '',
    type = 'button',
    ...rest
}: LoginInlineLinkButtonProps) {
    // `!` overrides beat the Button base's text-sm/rounded-md defaults.
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
    /** Centered `outline`/`filled` CTA, or `arrow` list row. */
    variant?: 'outline' | 'filled' | 'arrow';
    /** Slide the arrow on hover (arrow variant only). */
    arrowSlide?: boolean;
}

/** "Continue with <provider>" button. */
export function LoginProviderButton({
    provider,
    label,
    onClick,
    variant = 'outline',
    arrowSlide = false,
}: LoginProviderButtonProps) {
    const Icon = providerIcon(provider);

    if (variant === 'arrow') {
        // !size beats Button's [&_svg]:size-4 rule.
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
            {/* !size beats Button's [&_svg]:size-4 rule. */}
            <Icon className="!size-[18px]" />
            <span className="text-sm font-medium">{label}</span>
        </Button>
    );
}
