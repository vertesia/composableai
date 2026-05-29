// Stateless visual primitives shared by the sign-in steps.
import { Button } from '@vertesia/ui/core';
import { ArrowRight, Mail } from 'lucide-react';
import type { ButtonHTMLAttributes, ComponentType, ReactNode, Ref } from 'react';
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

// ─── Badges & avatars ────────────────────────────────────────────────────────

const INITIALS_BADGE_SHAPES = {
    // Round user avatar, with a ring.
    circle: 'size-9 rounded-full text-sm ring-4 ring-background ring-offset-1 ring-offset-border',
    // Square org chip.
    square: 'size-[30px] rounded-md text-[11px]',
} as const;

interface LoginInitialsBadgeProps {
    initials: string;
    shape?: keyof typeof INITIALS_BADGE_SHAPES;
}

/** Initials in a colored chip — a round user avatar or a square org chip. */
export function LoginInitialsBadge({ initials, shape = 'circle' }: LoginInitialsBadgeProps) {
    return (
        <span
            className={`bg-info text-info-foreground grid place-items-center font-semibold shrink-0 ${INITIALS_BADGE_SHAPES[shape]}`}
        >
            {initials}
        </span>
    );
}

/** Rounded tile framing a provider/status icon. */
export function LoginIconBadge({ children }: { children: ReactNode }) {
    return (
        <div className="inline-grid place-items-center size-14 rounded-xl bg-info-background border border-info/15 mb-3.5">
            {children}
        </div>
    );
}

// ─── Account card ────────────────────────────────────────────────────────────

interface LoginIdentityLinesProps {
    title: ReactNode;
    subtitle: ReactNode;
    titleClass: string;
    subtitleClass: string;
}

/** Title over a secondary line; fills the row beside a badge or avatar. */
export function LoginIdentityLines({ title, subtitle, titleClass, subtitleClass }: LoginIdentityLinesProps) {
    return (
        <div className="flex-1 min-w-0">
            <div className={titleClass}>{title}</div>
            <div className={subtitleClass}>{subtitle}</div>
        </div>
    );
}

// Two-row panel layout, tuned per usage. `tenant`: org card with a square badge;
// `returning`: smaller returning-user card with a round avatar.
const ACCOUNT_CARD_VARIANTS = {
    tenant: {
        topRow: 'flex items-center gap-2.5 px-3 py-2.5',
        title: 'text-[13.5px] font-semibold text-foreground leading-tight',
        subtitle: 'text-[11.5px] text-muted leading-tight mt-0.5',
        bottomRow: 'flex items-center gap-2.5 px-3 py-1.5 border-t border-border bg-muted-background',
        mailBox: 'size-[30px] grid place-items-center shrink-0',
        mailIcon: 'size-4 text-muted',
        email: 'text-sm text-foreground/80 flex-1 truncate',
        actionSize: 'xs',
    },
    returning: {
        topRow: 'flex items-center gap-3 px-3.5 py-2.5',
        title: 'text-sm font-semibold text-foreground truncate',
        subtitle: 'text-xs text-foreground/80 truncate',
        bottomRow: 'flex items-center gap-3 px-3.5 py-1 border-t border-border bg-muted-background',
        mailBox: 'w-9 h-6 grid place-items-center shrink-0',
        mailIcon: 'size-3.5 text-muted',
        email: 'text-xs text-foreground/80 flex-1 truncate',
        actionSize: 'smaller',
    },
} as const;

interface LoginAccountCardProps {
    variant?: keyof typeof ACCOUNT_CARD_VARIANTS;
    /** Leading badge — a square initials chip or a round avatar. */
    badge: ReactNode;
    title: ReactNode;
    subtitle: ReactNode;
    email: string;
    actionLabel: ReactNode;
    onAction: () => void;
}

/** Identity (badge + title + subtitle) over an email row with a trailing action link. */
export function LoginAccountCard({
    variant = 'returning',
    badge,
    title,
    subtitle,
    email,
    actionLabel,
    onAction,
}: LoginAccountCardProps) {
    const v = ACCOUNT_CARD_VARIANTS[variant];
    return (
        <div className="rounded-md border border-border bg-background overflow-hidden">
            <div className={v.topRow}>
                {badge}
                <LoginIdentityLines title={title} subtitle={subtitle} titleClass={v.title} subtitleClass={v.subtitle} />
            </div>
            <div className={v.bottomRow}>
                <div className={v.mailBox}>
                    <Mail className={v.mailIcon} />
                </div>
                <span className={v.email}>{email}</span>
                <LoginInlineLinkButton size={v.actionSize} onClick={onAction}>
                    {actionLabel}
                </LoginInlineLinkButton>
            </div>
        </div>
    );
}

interface LoginAccountRowProps {
    /** Leading badge — typically a round avatar. */
    badge: ReactNode;
    title: ReactNode;
    subtitle: ReactNode;
    actionLabel: ReactNode;
    onAction: () => void;
}

/** Single-row identity card: badge + title/subtitle + a trailing action link. */
export function LoginAccountRow({ badge, title, subtitle, actionLabel, onAction }: LoginAccountRowProps) {
    return (
        <div className="flex items-center gap-3 px-3.5 py-2.5 rounded-md border border-border bg-muted-background">
            {badge}
            <LoginIdentityLines
                title={title}
                subtitle={subtitle}
                titleClass="text-sm font-semibold text-foreground truncate"
                subtitleClass="text-xs text-muted truncate"
            />
            <LoginInlineLinkButton onClick={onAction}>{actionLabel}</LoginInlineLinkButton>
        </div>
    );
}

interface LoginEmailRowProps {
    email: string;
    actionLabel: ReactNode;
    onAction: () => void;
}

/** Standalone bordered pill: mail icon + email + a trailing action link. */
export function LoginEmailRow({ email, actionLabel, onAction }: LoginEmailRowProps) {
    return (
        <div className="flex items-center gap-2 px-3 py-2 rounded-md border border-border bg-muted-background">
            <Mail className="size-4 text-muted shrink-0" />
            <span className="text-sm text-foreground/80 flex-1 truncate">{email}</span>
            <LoginInlineLinkButton onClick={onAction}>{actionLabel}</LoginInlineLinkButton>
        </div>
    );
}

// ─── Provider CTA ──────────────────────────────────────────────────────────

interface LoginProviderButtonProps {
    provider: ProviderId;
    label: ReactNode;
    onClick?: () => void;
    /** Centered `outline`/`filled` CTA, or `arrow` list row. */
    variant?: 'outline' | 'filled' | 'arrow';
}

/** "Continue with <provider>" button. */
export function LoginProviderButton({ provider, label, onClick, variant = 'outline' }: LoginProviderButtonProps) {
    const Icon = providerIcon(provider);

    if (variant === 'arrow') {
        // !size beats Button's [&_svg]:size-4 rule. Arrow fades in and nudges right on hover.
        const arrowClass =
            '!size-3.5 text-muted opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition';
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

// ─── Callout / divider / field ───────────────────────────────────────────────

interface LoginCalloutProps {
    icon: ComponentType<{ className?: string }>;
    title: ReactNode;
    meta: ReactNode;
}

/** Destructive notice: icon + bold title over a muted meta line. */
export function LoginCallout({ icon: Icon, title, meta }: LoginCalloutProps) {
    return (
        <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-md bg-destructive-background border border-destructive/20">
            <Icon className="size-5 text-destructive shrink-0" />
            <div className="flex-1 min-w-0 text-sm">
                <div className="font-semibold text-destructive">{title}</div>
                <div className="text-xs text-destructive/80">{meta}</div>
            </div>
        </div>
    );
}

/** Horizontal rule with a centered label. */
export function LoginOrDivider({ children }: { children: ReactNode }) {
    return (
        <div className="flex items-center gap-3 my-2 text-muted-foreground text-[10.5px] uppercase tracking-widest">
            <div className="flex-1 h-px bg-border" />
            <span>{children}</span>
            <div className="flex-1 h-px bg-border" />
        </div>
    );
}

interface LoginEmailFieldProps {
    inputRef?: Ref<HTMLInputElement>;
    label: ReactNode;
    placeholder?: string;
    value: string;
    onChange: (value: string) => void;
    invalid?: boolean;
    error?: ReactNode;
}

/** Labeled email input with an inline validation message. */
export function LoginEmailField({
    inputRef,
    label,
    placeholder,
    value,
    onChange,
    invalid = false,
    error,
}: LoginEmailFieldProps) {
    return (
        <div className="flex flex-col gap-1.5">
            <label htmlFor="vt-login-email" className="text-xs font-medium text-foreground/80">
                {label}
            </label>
            <input
                ref={inputRef}
                id="vt-login-email"
                name="vt-login-email"
                type="email"
                className="h-[42px] px-3.5 rounded-md border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground outline-none transition focus:border-info focus:ring-4 focus:ring-info/15 aria-[invalid=true]:border-destructive aria-[invalid=true]:ring-destructive/15"
                placeholder={placeholder}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                aria-invalid={invalid}
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                data-1p-ignore
                data-lpignore="true"
                data-form-type="other"
            />
            {error && (
                <div role="alert" className="text-xs text-destructive">
                    {error}
                </div>
            )}
        </div>
    );
}
