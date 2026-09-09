interface ProgressProps {
    percent: number; // progress percent value
}
export function Progress({ percent }: ProgressProps) {
    return (
        <div className="w-full bg-muted rounded-full h-2.5">
            <div className="bg-primary h-2.5 rounded-full" style={{ width: `${percent}%` }}></div>
        </div>
    );
}
