import { cn } from '@vertesia/ui/core';

interface JumpingDotsProps {
    className?: string;
    inline?: boolean;
}

export function JumpingDots({ className, inline = false }: JumpingDotsProps) {
    return (
        <div className={cn('flex items-center gap-1', inline ? 'inline-flex' : '', className)}>
            <div
                className="w-2 h-2 bg-primary rounded-full animate-[jumping_1s_infinite_ease-in-out] hover:bg-primary"
                style={{ transform: 'translateY(0)', animationRange: '0px -8px' }}
            />
            <div
                className="w-2 h-2 bg-primary rounded-full animate-[jumping_1s_0.3s_infinite_ease-in-out] hover:bg-primary"
                style={{ transform: 'translateY(0)', animationRange: '0px -8px' }}
            />
            <div
                className="w-2 h-2 bg-primary rounded-full animate-[jumping_1s_0.6s_infinite_ease-in-out] hover:bg-primary"
                style={{ transform: 'translateY(0)', animationRange: '0px -8px' }}
            />
        </div>
    );
}
