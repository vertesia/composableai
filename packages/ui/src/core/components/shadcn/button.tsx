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
     * @deprecated Use `aria-label` for the accessible name and wrap in `<VTooltip>` for a visual tooltip.
     * For backward compatibility, `alt` is forwarded to `aria-label` (when not set) AND still
     * triggers the legacy VTooltip wrap. Slated for removal in the next major.
     */
    alt?: string;
    title?: string;
    isDisabled?: boolean;
    isLoading?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    (
        { className, variant, size, asChild = false, alt, isDisabled, isLoading, title, onClick, type, ...props },
        ref,
    ) => {
        useDeprecationWarning(
            'Button.alt',
            alt !== undefined,
            'use aria-label for the accessible name and wrap in <VTooltip> for a visual tooltip. ' +
                '`alt` is forwarded to both for one release.',
        );

        const Comp = asChild ? Slot : 'button';
        // Default type="button" only when rendering an actual <button>. With asChild,
        // the rendered element may be an <a> or other tag where injecting `type` is wrong.
        const resolvedType = asChild ? type : (type ?? 'button');
        // Back-fill aria-label from alt during the deprecation window so existing call
        // sites keep their accessible name without code changes.
        const ariaLabel = props['aria-label'] ?? alt;

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

        if (alt || title) {
            return (
                <VTooltip description={alt || title} asChild className="cursor-pointer" size="xs" placement="top">
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
                aria-label={label}
                title={label}
            >
                {isCopied ? <Check className="text-success" /> : <CopyIcon className="size-4" />}
            </Button>
        );
    },
);
CopyButton.displayName = 'CopyButton';

export { Button, CopyButton, buttonVariants };
