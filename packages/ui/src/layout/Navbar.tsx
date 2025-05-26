import React from 'react'
import { Menu, Search } from 'lucide-react'
import { Button, HeroIcon } from '@vertesia/ui/core'
import { useSidebarToggle } from './SidebarContext.js'
import { TitleBar } from './TitleBar.js'

interface NavbarProps {
    title?: string
    onSearch?: (query: string) => void
    logo?: React.ReactNode
    children: React.ReactNode | React.ReactNode[]
}
export function Navbar({ children, logo, onSearch, title }: NavbarProps) {
    return (
        <div className="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-x-4 border-b px-4 shadow-2xs sm:gap-x-6 sm:px-6 lg:px-8">
            <HamburgerButton />

            <div className="lg:hidden">{logo}</div>

            {/* Separator shown only if search is displayed in mobile */}
            {onSearch && <NavbarSeparator visible='mobile' />}

            <div className="flex flex-1 gap-x-4 self-stretch lg:gap-x-6">
                <TitleBar title={title} />
                {onSearch && <SearchBox onSearch={onSearch} />}

                <div className="flex items-center gap-x-4 lg:gap-x-6 ml-auto">
                    {children}
                </div>
            </div>
        </div>

    )
}


interface SearchBoxProps {
    onSearch?: (query: string) => void
}
function SearchBox({ }: SearchBoxProps) {
    return (
        <form className="relative flex flex-1" action="#" method="GET">
            <label htmlFor="search-field" className="sr-only">
                Search
            </label>
            <Search
                className="pointer-events-none absolute inset-y-0 left-0 h-full w-5 text-gray-400"
                aria-hidden="true"
            />
            <input
                id="search-field"
                className="block h-full w-full border-0 py-0 pl-8 pr-0 text-gray-900 placeholder:text-gray-400 focus:ring-0 sm:text-sm"
                placeholder="Search..."
                type="search"
                name="search"
            />
        </form>
    )
}


export function HamburgerButton() {
    const { toggleDesktop, toggleMobile } = useSidebarToggle();
    const toggle = () => {
        if (window.innerWidth < 1024) {
            toggleMobile();
        } else {
            toggleDesktop();
        }
    }
    return (
        <>
            <Button variant='ghost' size='icon' onClick={() => toggle()} //alt='sidebar toggle'
                className="p-2 rounded-full transition-colors w-full text-center ">
                <Menu aria-hidden="true" size={24} />
            </Button>
        </>
    )
}


interface NavbarSeparatorProps {
    visible?: "mobile" | "desktop"
}
export function NavbarSeparator({ visible }: NavbarSeparatorProps) {
    let visibility = "";
    if (visible) {
        visibility = visible === "mobile" ? "lg:hidden" : "hidden lg:block"
    }
    return (
        <div className={`h-6 w-px bg-gray-900/10 dark:bg-slate-900/0.1 ${visibility}`} aria-hidden="true" />
    )
}

interface NavbarIconButtonProps {
    title: string,
    icon: HeroIcon,
    onClick?: (ev: React.MouseEvent<HTMLButtonElement, MouseEvent>) => void;
}
export function NavbarIconButton({ title, icon: Icon, onClick }: NavbarIconButtonProps) {
    return (
        <button type="button" className="-m-2.5 p-2.5 text-gray-400 dark:text-slate-50 hover:text-gray-500" onClick={onClick}>
            <span className="sr-only">{title}</span>
            <Icon className="size-6" aria-hidden="true" title={title} />
        </button>
    )
}

interface NavbarButtonProps {
    children: React.ReactNode | React.ReactNode[]
    onClick?: (ev: React.MouseEvent<HTMLButtonElement, MouseEvent>) => void;
}
export function NavbarButton({ children, onClick }: NavbarButtonProps) {
    return (
        <Button onClick={onClick}>{children}</Button>
    )
}
interface NavbarLinkProps {
    href: string
    children: React.ReactNode | React.ReactNode[]
    onClick?: (ev: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => void;
}
export function NavbarLink({ href, onClick, children }: NavbarLinkProps) {
    return (
        <a className="dark:text-slate-50" href={href} onClick={onClick}>{children}</a>
    )
}
