import clsx from "clsx";

function getRealSize(size: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl') {
    switch (size) {
        case 'xs': return 'size-2';
        case 'sm': return 'size-3';
        case 'md': return 'size-4';
        case 'lg': return 'size-5';
        case 'xl': return 'size-7';
        case '2xl': return 'size-10';
        default: throw new Error('Unexpected size: ' + size);
    }
}

interface SpinnerProps {
    size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl',
    className?: string
}
export function Spinner({ size, className }: SpinnerProps) {
    const sizeClass = getRealSize(size || 'md');
    return (
        <>
            <svg className={clsx(
                "animate-[spin_0.8s_linear_infinite] text-indigo-500",
                sizeClass,
                className)} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
        </>
    )

}
