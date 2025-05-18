
interface TitleBarProps {
    title?: string;
}
export function TitleBar({ title }: TitleBarProps) {
    return <div className='self-center text-lg font-semibold'>{title}</div>
}
