import { cn } from '@vertesia/ui/core';
import { Env } from '@vertesia/ui/env';

const regionLabels: Record<string, string> = {
    eu: 'EU',
    jp: 'JP',
};

export function RegionTag({ className }: { className?: string }) {
    const region = Env.region;
    // Only show for non-US regions (US is default, no need to display)
    if (!region || region === 'us') return null;

    return (
        <div
            className={cn(
                'text-[0.6rem] font-semibold px-1.5 rounded-3xl leading-4',
                'bg-info text-white',
                className,
            )}
        >
            {regionLabels[region] ?? region.toUpperCase()}
        </div>
    );
}
