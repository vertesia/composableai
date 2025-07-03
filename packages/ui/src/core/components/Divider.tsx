import clsx from "clsx";


interface DividerProps {
    className?: string;
}
export function Divider({ className }: DividerProps) {
    return (
        <hr className={clsx("w-full h-0.5 border-t-0 bg-border", className)} />
    )
}
