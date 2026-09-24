import clsx from 'clsx';

function getRealSize(size: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl') {
    switch (size) {
        case 'xs':
            return 'size-2';
        case 'sm':
            return 'size-3';
        case 'md':
            return 'size-4';
        case 'lg':
            return 'size-5';
        case 'xl':
            return 'size-7';
        case '2xl':
            return 'size-10';
        default:
            throw new Error(`Unexpected size: ${size}`);
    }
}

interface SpinnerProps {
    size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
    className?: string;
}
export function Spinner({ size, className }: SpinnerProps) {
    const sizeClass = getRealSize(size || 'md');
    return (
        <svg
            className={clsx('nable-spinner text-info', sizeClass, className)}
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 500 369.3"
            role="img"
            aria-label="Loading"
        >
            <title>Loading</title>
            <path
                fill="currentColor"
                d="M0,0h108.1l261.3,261.2v108.1h-108.1l-130.7-130.6v130.6H0V0ZM238.4,130.6h130.6V0h-130.6v130.6Z"
            />
            <path className="opacity-60" fill="currentColor" d="M369.4 261.2 238.7 130.6 500 130.6 500 261.2Z" />
        </svg>
    );
}
