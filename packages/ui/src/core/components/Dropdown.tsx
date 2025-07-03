import { Menu, MenuButton, MenuItems, MenuItem as _MenuItem, Transition } from '@headlessui/react';
import clsx from 'clsx';
import { Fragment } from 'react';

interface DropdownProps {
    trigger: React.ReactNode;
    children: React.ReactNode | React.ReactNode[];
}
export function Dropdown({ trigger, children }: DropdownProps) {
    return (
        <Menu as="div" className="relative">
            <MenuButton as="span" className="-m-1.5 flex items-center p-1.5">
                {trigger}
            </MenuButton>
            <Transition
                as={Fragment}
                enter="transition ease-out duration-100"
                enterFrom="transform opacity-0 scale-95"
                enterTo="transform opacity-100 scale-100"
                leave="transition ease-in duration-75"
                leaveFrom="transform opacity-100 scale-100"
                leaveTo="transform opacity-0 scale-95"
            >
                <MenuItems className="absolute right-0 z-10 mt-2.5 w-48 origin-top-right rounded-md bg-white dark:bg-slate-900 dark:border-slate-800 dark:border py-2 shadow-lg ring-1 ring-gray-900/5 dark:ring-slate-200/5 focus:outline-hidden">
                    {children}
                </MenuItems>
            </Transition>
        </Menu>
    )
}

interface MenuItemProps {
    children: React.ReactNode | React.ReactNode[]
    onClick?: (ev: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => void;
    href?: string
    closeOnClick?: boolean
    isDisabled?: boolean
}
export function MenuItem({ children, href = '#', onClick, closeOnClick = true, isDisabled = false }: MenuItemProps) {
    return (
        <_MenuItem disabled={isDisabled}>
            {
                ({ active, close }) => (
                    <a
                        href={href}
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            onClick && onClick(e);
                            closeOnClick && close();
                        }}
                        className={clsx(
                            active ? 'bg-gray-50 dark:bg-slate-800' : '',
                            isDisabled ? 'opacity-50 cursor-not-allowed' : '',
                            'block px-3 py-1 text-sm leading-6 text-gray-900 dark:text-gray-200'
                        )}
                    >
                        {children}
                    </a>
                )}
        </_MenuItem>
    )
}
