import * as SwitchPrimitive from '@radix-ui/react-switch';
import type * as React from 'react';

import { cn } from '../libs/utils';

// Thumb slide distance — physical translate-x in LTR, mirrored in RTL so the
// thumb slides toward the start of the track in both directions.
const sizes = {
    sm: ['h-5 w-8', 'size-3', 'translate-x-4 rtl:-translate-x-4'], // rtl-ok: mirrored thumb movement
    md: ['h-6 w-11', 'size-4', 'translate-x-6 rtl:-translate-x-6'], // rtl-ok: mirrored thumb movement
    lg: ['h-8 w-16', 'size-6', 'translate-x-9 rtl:-translate-x-9'], // rtl-ok: mirrored thumb movement
};

interface SwitchProps
    extends Pick<
        React.ComponentProps<typeof SwitchPrimitive.Root>,
        'id' | 'name' | 'required' | 'aria-label' | 'aria-labelledby' | 'aria-describedby' | 'aria-invalid'
    > {
    size?: 'sm' | 'md' | 'lg';
    value: boolean;
    onChange: (value: boolean) => void;
    children?: React.ReactNode;
    className?: string;
    disabled?: boolean;
}

function Switch({ className, size = 'md', value, onChange, children, disabled, ...ariaProps }: SwitchProps) {
    const [trackSize, thumbSize, thumbTranslate] = sizes[size];
    const switchEl = (
        <SwitchPrimitive.Root
            data-slot="switch"
            checked={value}
            onCheckedChange={onChange}
            disabled={disabled}
            {...ariaProps}
            className={cn(
                'data-[state=checked]:bg-primary data-[state=unchecked]:bg-muted focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:aria-invalid:border-destructive/50 shrink-0 rounded-full border focus-visible:ring-3 aria-invalid:ring-3 peer group/switch relative inline-flex items-center transition-all outline-none after:absolute after:-inset-x-3 after:-inset-y-2 data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50',
                trackSize,
                !children && className,
            )}
        >
            <SwitchPrimitive.Thumb
                data-slot="switch-thumb"
                className={cn(
                    'bg-white rounded-full pointer-events-none block ring-0 transition-transform',
                    thumbSize,
                    value ? thumbTranslate : 'translate-x-1 rtl:-translate-x-1', // rtl-ok: mirrored thumb inset
                )}
            />
        </SwitchPrimitive.Root>
    );

    if (children) {
        return (
            <div className={cn('flex items-center', className)}>
                {switchEl}
                <span className="px-2">{children}</span>
            </div>
        );
    }

    return switchEl;
}

export { Switch };
