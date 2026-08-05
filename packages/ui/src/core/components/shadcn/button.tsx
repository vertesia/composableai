import { Slot } from '@radix-ui/react-slot';
// IMPORTANT: must import via the @vertesia/ui/i18n subpath (not relative)
// so Rollup externalizes it. A relative path bundles the i18n module — and
// its i18nInstance — into vertesia-ui-core.js, creating a copy that stays
// pinned to the fallback language regardless of LanguageProvider changes.
import { useUITranslation } from '@vertesia/ui/i18n';
import { cva, type VariantProps } from 'class-variance-authority';
import clsx from 'clsx';
import { Check, CopyIcon, Loader2 } from 'lucide-react';
import * as React from 'react';
import { useEffect, useState } from 'react';
import { cn } from '../libs/utils';
import { VTooltip } from './tooltip';

// Deduped per-session deprecation warnings. Keyed by prop path so each is logged once.
const warnedDeprecatedProps = new Set<string>();
function useDeprecationWarning(propName: string, isUsed: boolean, message: string) {
    useEffect(() => {
        if (isUsed && !warnedDeprecatedProps.has(propName)) {
            warnedDeprecatedProps.add(propName);
            console.warn(`[@vertesia/ui] ${propName} is deprecated: ${message}`);
        }
    }, [isUsed, message, propName]);
}

// Does this subtree contribute any text to the accessible name? Used to decide whether `title`
// may supply that name. Icons (lucide elements) have no string children and return false, and
// `aria-hidden` subtrees are skipped because they are excluded from the name computation.
function hasVisibleText(node: React.ReactNode): boolean {
    return React.Children.toArray(node).some((child) => {
        if (typeof child === 'string') return child.trim().length > 0;
        if (typeof child === 'number') return true;
        if (React.isValidElement(child)) {
            const props = child.props as { children?: React.ReactNode; 'aria-hidden'?: boolean | string };
            if (props['aria-hidden'] === true || props['aria-hidden'] === 'true') return false;
            return hasVisibleText(props.children);
        }
        return false;
    });
}

const buttonVariants = cva(
    'hover:cursor-pointer inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
    {
        variants: {
            variant: {
                destructive:
                    'bg-destructive dark:bg-destructive/10 text-destructive ring-1 ring-inset ring-destructive-muted/50 dark:ring-destructive-muted/50 shadow-xs hover:bg-destructive/50',
                outline: 'border border-input bg-background shadow-xs hover:bg-muted ring-inset',
                secondary:
                    'bg-primary/5 dark:bg-primary/10 text-primary shadow-xs hover:bg-primary/10 dark:hover:bg-primary/20 ring-inset',
                ghost: 'hover:bg-muted/50 dark:hover:bg-muted/20 ring-inset',
                link: 'text-foreground underline-offset-4 hover:underline ring-inset',
                primary: 'bg-primary text-white shadow-xs hover:bg-primary/90 ring-inset',
                unstyled: '',
            },
            size: {
                xs: 'h-7 rounded px-2 py-1 text-xs gap-x-1',
                sm: 'h-8 rounded px-3 text-xs',
                md: 'h-9 rounded-md px-4 py-2',
                lg: 'h-10 rounded-md px-3',
                xl: 'rounded-md px-3.5 py-2.5 text-sm gap-x-2',
                icon: 'p-0 m-0 rounded-full',
                none: '',
            },
        },
        defaultVariants: {
            variant: 'primary',
            size: 'md',
        },
    },
);

export interface ButtonProps
    extends React.ButtonHTMLAttributes<HTMLButtonElement>,
        VariantProps<typeof buttonVariants> {
    asChild?: boolean;
    /**
     * @deprecated Use `title` instead. `alt` drives the same tooltip but, unlike `title`, it
     * overrides the accessible name even when the button shows a text label — which usually
     * violates WCAG 2.5.3 (Label in Name). That legacy behavior is preserved so existing call
     * sites keep announcing what they always did. Slated for removal in the next major.
     */
    alt?: string;
    /**
     * Tooltip text. Renders a `<VTooltip>` around the button and doubles as the accessible name,
     * so icon-only buttons need nothing else. Pass `aria-label` to override the name independently.
     */
    title?: string;
    /** Which side the `title` tooltip opens on. Defaults to `top`. */
    tooltipPlacement?: 'top' | 'right' | 'bottom' | 'left';
    isDisabled?: boolean;
    isLoading?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    (
        {
            className,
            variant,
            size,
            asChild = false,
            alt,
            isDisabled,
            isLoading,
            title,
            tooltipPlacement = 'top',
            onClick,
            type,
            ...props
        },
        ref,
    ) => {
        useDeprecationWarning(
            'Button.alt',
            alt !== undefined,
            'use `title` instead — it drives the same tooltip and the accessible name. ' +
                '`alt` remains an alias for one release.',
        );

        const Comp = asChild ? Slot : 'button';
        // Default type="button" only when rendering an actual <button>. With asChild,
        // the rendered element may be an <a> or other tag where injecting `type` is wrong.
        const resolvedType = asChild ? type : (type ?? 'button');
        // `title` (or its deprecated alias `alt`) drives the VTooltip below. `title` also back-fills
        // the accessible name, so an icon-only <Button title="Refresh"> is labelled without any
        // extra props or a manual <VTooltip> wrap at the call site.
        //
        // That back-fill is skipped when the button already shows text: turning
        // <Button title="Show only installed apps">Installed</Button> into aria-label="Show only
        // installed apps" would replace the visible name with the tooltip, which breaks WCAG 2.5.3
        // (Label in Name) and makes the control unreachable by the label users actually see.
        //
        // `alt` deliberately does NOT get that treatment: it has always overridden the name
        // unconditionally, and callers rely on that. Preserving it keeps every existing call site
        // announcing exactly what it announced before, and confines the new rule to `title`.
        const tooltip = title ?? alt;
        const ariaLabel = props['aria-label'] ?? alt ?? (hasVisibleText(props.children) ? undefined : title);

        // asChild renders via Radix Slot, which requires exactly one React child.
        // Skip the loader wrap in that case — Slot would reject the multi-child array.
        const content = asChild ? (
            props.children
        ) : (
            <>
                {isLoading && <Loader2 className="animate-spin" />}
                {props.children}
            </>
        );

        const buttonElement = (
            <Comp
                className={clsx(cn(buttonVariants({ variant, size })), className)}
                disabled={isDisabled || isLoading || props.disabled}
                ref={ref}
                onClick={onClick}
                type={resolvedType}
                autoFocus={false}
                {...props}
                aria-label={ariaLabel}
            >
                {content}
            </Comp>
        );

        // Note: the native `title` attribute is deliberately NOT forwarded to the DOM — it would
        // stack a second, delayed browser tooltip on top of the VTooltip. `aria-label` above is
        // what exposes the text to screen readers and to getByRole('button', { name }).
        if (tooltip) {
            return (
                <VTooltip
                    description={tooltip}
                    asChild
                    className="cursor-pointer"
                    size="xs"
                    placement={tooltipPlacement}
                >
                    {buttonElement}
                </VTooltip>
            );
        }

        return buttonElement;
    },
);
Button.displayName = 'Button';

interface CopyButtonProps {
    content: string;
    /** @deprecated use `aria-label` */
    alt?: string;
    'aria-label'?: string;
    size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'icon';
    toast?: {
        toast: (options: { status: 'success' | 'error'; title: string; duration: number }) => void;
        message: string;
    };
    className?: string;
}

const CopyButton = React.forwardRef<HTMLButtonElement, CopyButtonProps>(
    ({ size, content, toast, className, alt, 'aria-label': ariaLabel, ...props }, ref) => {
        const [isCopied, setIsCopied] = useState(false);
        const { t } = useUITranslation();

        useDeprecationWarning(
            'CopyButton.alt',
            alt !== undefined,
            'use aria-label for the accessible name. ' + '`alt` is forwarded for one release.',
        );

        const handleCopy = (e: React.MouseEvent) => {
            e.stopPropagation();
            navigator.clipboard
                .writeText(content)
                .then(() => {
                    setIsCopied(true);
                    setTimeout(() => setIsCopied(false), 2000);
                    if (!toast?.toast) {
                        return;
                    }
                    toast.toast({
                        status: 'success',
                        title: toast.message || t('misc.copiedToClipboard'),
                        duration: 2000,
                    });
                })
                .catch((err) => {
                    console.error('Failed to copy text: ', err);
                    if (toast?.toast)
                        toast.toast({
                            status: 'error',
                            title: t('misc.failedToCopy'),
                            duration: 2000,
                        });
                });
        };

        const label = ariaLabel ?? alt ?? t('misc.copy');

        return (
            <Button
                ref={ref}
                className={cn(className)}
                variant={'unstyled'}
                size={size || 'sm'}
                onClick={handleCopy}
                {...props}
                title={label}
            >
                {isCopied ? <Check className="text-success" /> : <CopyIcon className="size-4" />}
            </Button>
        );
    },
);
CopyButton.displayName = 'CopyButton';

export { Button, buttonVariants, CopyButton };
