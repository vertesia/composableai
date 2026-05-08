import { Filter as FilterIcon } from 'lucide-react';
import { Button, VTooltip } from '@vertesia/ui/core';

interface InlineFilterButtonProps {
    tooltip: string;
    hoverClass: string;
    onClick: () => void;
}

export function InlineFilterButton({ tooltip, hoverClass, onClick }: InlineFilterButtonProps) {
    return (
        <VTooltip description={tooltip} asChild>
            <Button
                variant="ghost"
                size="sm"
                aria-label={tooltip}
                className={`h-6 w-6 p-0 opacity-0 transition-opacity focus-visible:opacity-100 ${hoverClass}`}
                onClick={(event) => {
                    event.stopPropagation();
                    onClick();
                }}
            >
                <FilterIcon className="size-4" />
            </Button>
        </VTooltip>
    );
}
