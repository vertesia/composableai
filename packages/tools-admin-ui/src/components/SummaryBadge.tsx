export function SummaryBadge({ count, label }: { count: number; label: string }) {
    if (count === 0) return null;
    return (
        <span className="vta-badge">
            <span className="vta-badge-dot" />
            {count} {label}{count !== 1 ? 's' : ''}
        </span>
    );
}
