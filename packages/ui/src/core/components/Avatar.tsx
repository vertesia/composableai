
function getRealSize(size: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl') {
    switch (size) {
        case 'xs': return 'size-4';
        case 'sm': return 'size-6';
        case 'md': return 'size-8';
        case 'lg': return 'size-10';
        case 'xl': return 'size-12';
        case '2xl': return 'size-14';
        default: throw new Error('Unexpected size: ' + size);
    }
}

interface AvatarProps {
    shape?: "circle" | "rect"
    src?: string
    name?: string
    size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl'
    color?: string; // the color class
    className?: string
}
export function Avatar({ size, src, name, shape = "circle", color = 'bg-gray-500', className }: AvatarProps) {
    const rounded = shape === 'circle' ? 'rounded-full' : 'rounded-md';
    const sizeClass = getRealSize(size || 'md');

    if (src) {
        return (
            <img
                className={`inline-block ${sizeClass} ${rounded} ${color} ${className}`}
                src={src}
                alt={name || src}
                title={name}
            />
        )
    }

    if (name) {
        const [first, second] = name.split(' ');
        let text = second ? `${first[0]}${second[0]}` : `${first[0]}${first[1]}`;
        return (
            <span className={`inline-flex ${sizeClass} items-center justify-center ${rounded} ${color} ${className}`} title={name}>
                <span className={`${(size != 'xs') ? 'text-xs' : 'text-[0.6rem]'} font-medium leading-none text-white`}>{text}</span>
            </span>
        )
    }

    return (
        <span className={`inline-block ${sizeClass} overflow-hidden ${rounded} ${color}`}>
            <svg className="h-full w-full text-gray-300" fill="currentColor" viewBox="0 0 24 24">
                <path d="M24 20.993V24H0v-2.996A14.977 14.977 0 0112.004 15c4.904 0 9.26 2.354 11.996 5.993zM16.002 8.999a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
        </span>
    )
}
interface SvgAvatarProps extends Omit<AvatarProps, 'src' | 'name'> {
    children?: React.ReactNode
    className?: string
}
export function SvgAvatar({ size, shape = "circle", color = 'bg-gray-500', className, children }: SvgAvatarProps) {
    const rounded = shape === 'circle' ? 'rounded-full' : 'rounded-md';
    const sizeClass = getRealSize(size || 'md');
    return (
        <span className={`inline-block ${sizeClass} overflow-hidden ${rounded} ${color} ${className}`}>
            {children}
        </span>
    )
}