import { cva, type VariantProps } from 'class-variance-authority';
import { forwardRef, type HTMLAttributes } from 'react';
import { cn } from '../libs/utils';

// Update the text variants to match the new sizing requirements
const textVariants = cva('text-foreground', {
    variants: {
        size: {
            xl: 'text-base md:text-lg leading-relaxed',
            lg: 'text-base leading-relaxed',
            default: 'text-sm leading-normal',
            sm: 'text-sm leading-normal',
            xs: 'text-xs leading-normal',
        },
        weight: {
            normal: 'font-normal',
            medium: 'font-medium',
            semibold: 'font-semibold',
        },
    },
    defaultVariants: {
        size: 'default',
        weight: 'normal',
    },
});

export interface TextProps extends HTMLAttributes<HTMLParagraphElement>, VariantProps<typeof textVariants> {}

export const Text = forwardRef<HTMLParagraphElement, TextProps>(({ className, size, weight, ...props }, ref) => {
    return <p ref={ref} className={cn(textVariants({ size, weight, className }))} {...props} />;
});

Text.displayName = 'Text';
