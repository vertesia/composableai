import * as SliderPrimitive from '@radix-ui/react-slider';
import * as React from 'react';

import { cn } from '../libs/utils';

interface SliderProps extends React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root> {
    trackClassName?: string;
    rangeClassName?: string;
    thumbClassName?: string;
}

const Slider = React.forwardRef<React.ElementRef<typeof SliderPrimitive.Root>, SliderProps>(
    (
        {
            className,
            trackClassName,
            rangeClassName,
            thumbClassName,
            value,
            defaultValue,
            min = 0,
            max = 100,
            'aria-label': ariaLabel,
            ...props
        },
        ref,
    ) => {
        const id = React.useId();
        const thumbCount = Array.isArray(value) ? value.length : Array.isArray(defaultValue) ? defaultValue.length : 1;
        const thumbKeys = React.useMemo(
            () => Array.from({ length: Math.max(1, thumbCount) }, (_, thumbIndex) => `${id}-thumb-${thumbIndex}`),
            [id, thumbCount],
        );

        return (
            <SliderPrimitive.Root
                ref={ref}
                data-slot="slider"
                value={value}
                defaultValue={defaultValue}
                min={min}
                max={max}
                {...props}
                className={cn(
                    'relative flex w-full touch-none select-none items-center data-[disabled]:opacity-50 data-[orientation=vertical]:h-full data-[orientation=vertical]:min-h-44 data-[orientation=vertical]:w-auto data-[orientation=vertical]:flex-col',
                    className,
                )}
            >
                <SliderPrimitive.Track
                    data-slot="slider-track"
                    className={cn(
                        'relative h-1.5 w-full grow overflow-hidden rounded-full bg-muted data-[orientation=vertical]:h-full data-[orientation=vertical]:w-1.5',
                        trackClassName,
                    )}
                >
                    <SliderPrimitive.Range
                        data-slot="slider-range"
                        className={cn('absolute h-full bg-primary data-[orientation=vertical]:w-full', rangeClassName)}
                    />
                </SliderPrimitive.Track>
                {thumbKeys.map((thumbKey) => (
                    <SliderPrimitive.Thumb
                        key={thumbKey}
                        data-slot="slider-thumb"
                        aria-label={ariaLabel}
                        className={cn(
                            'block size-3.5 rounded-full border border-primary bg-background shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
                            thumbClassName,
                        )}
                    />
                ))}
            </SliderPrimitive.Root>
        );
    },
);
Slider.displayName = SliderPrimitive.Root.displayName;

export { Slider };
