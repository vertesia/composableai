import { DotBadge } from '@vertesia/ui/core';

export function SummaryBadge({ count, label }: { count: number; label: string }) {
    if (count === 0) return null;
    return (
        <DotBadge variant="success">
            {count} {label}{count !== 1 ? 's' : ''}
        </DotBadge>
    );
}
