import clsx from "clsx";
import { AnchorHTMLAttributes, forwardRef } from "react";

interface MenuListProps {
    children: React.ReactNode | React.ReactNode[]
    className?: string
}
export function MenuList({ className, children }: MenuListProps) {
    return (
        <ul className={`${className} space-y-1 flex flex-col items-start`}>
            {children}
        </ul>
    )
}


interface MenuListItemProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
    current?: boolean
}

const MenuListItem = forwardRef<HTMLAnchorElement, MenuListItemProps>(function _MenuListItem(props, ref) {
    const { current, children, className, href = '#', onClick, ...others } = props;
    return (
        <li className={clsx(className, current ? 'bg-muted' : '',
            'w-full p-2 pl-3 text-sm leading-6 font-semibold hover:bg-muted')}>
            <a ref={ref} href={href} onClick={(e) => {
                if (onClick) {
                    e.preventDefault();
                    onClick(e);
                } else if (href === '#') {
                    e.preventDefault();
                }
            }}
                className='w-full flex items-center gap-x-3'
                {...others}
            >{children}</a>
        </li>
    )
});

MenuList.Item = MenuListItem;
