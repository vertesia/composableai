import { Dialog, DialogPanel, Transition, TransitionChild } from '@headlessui/react'
import { X } from 'lucide-react'
import clsx from 'clsx'
import { Fragment, useEffect, useState } from 'react'
// import { FullHeightLayout } from './FullHeightLayout.js'
import { Navbar } from './Navbar.js'
import { Sidebar } from './Sidebar.js'
import { SidebarContext } from './SidebarContext.js'

interface AppLayoutProps {
    title?: string;
    children: React.ReactNode | React.ReactNode[]
    logo?: React.ReactNode
    navbar?: React.ReactNode | React.ReactNode[]
    sidebar?: React.ReactNode | React.ReactNode[]
    mainNav?: React.ReactNode
    className?: string // will be forwarded to the main page element
    sidebarClassName?: string // will be forwarded to the sidebar element
}
export function AppLayout({ sidebarClassName, className, title, children, logo, navbar, sidebar, mainNav }: AppLayoutProps) {

    if (localStorage.getItem('desktopSidebarOpen') === null) {
        localStorage.setItem('desktopSidebarOpen', 'true');
    }

    const [sidebarOpen, setSidebarOpen] = useState(false)
    const [desktopSidebarOpen, setDesktopSidebarOpen] = useState(localStorage.getItem('desktopSidebarOpen') === 'true')
    const [isLargeScreen, setIsLargeScreen] = useState(window.innerWidth >= 1024)

    useEffect(() => {
        const handleResize = () => {
            setIsLargeScreen(window.innerWidth >= 1024)
        }

        window.addEventListener('resize', handleResize)
        return () => window.removeEventListener('resize', handleResize)
    }, [])

    const sidebarContextValue = {
        isOpen: isLargeScreen ? desktopSidebarOpen : sidebarOpen,
        toggleDesktop: (value?: boolean) => {
            if (value === undefined) {
                setDesktopSidebarOpen(!desktopSidebarOpen)
            } else {
                setDesktopSidebarOpen(value)
            }
            localStorage.setItem('desktopSidebarOpen', JSON.stringify(!desktopSidebarOpen))
        },
        toggleMobile: (value?: boolean) => {
            if (value === undefined) {
                setSidebarOpen(!sidebarOpen)
            } else {
                setSidebarOpen(value)
            }
        },
    }

    return (
        <>
            <div className='flex flex-col h-screen overflow-y-hidden'>

                <SidebarContext.Provider value={sidebarContextValue}>
                    <div className='w-full'>
                        {mainNav}
                    </div>

                    <div className='flex h-full overflow-y-auto w-full'>

                        <Transition show={sidebarOpen} as={Fragment}>
                            <Dialog as="div" className="relative z-50 lg:hidden" onClose={setSidebarOpen}>
                                {/* Backdrop layer for the semi-transparent */}
                                <TransitionChild
                                    as={Fragment}
                                    enter="transition-opacity ease-linear duration-300"
                                    enterFrom="opacity-0"
                                    enterTo="opacity-100"
                                    leave="transition-opacity ease-linear duration-300"
                                    leaveFrom="opacity-100"
                                    leaveTo="opacity-0"
                                >
                                    <div className="fixed inset-0 bg-gray-900/80" />
                                </TransitionChild>

                                <div className="fixed inset-0 flex">
                                    <TransitionChild
                                        as={Fragment}
                                        enter="transition ease-in-out duration-300 transform"
                                        enterFrom="-translate-x-full"
                                        enterTo="translate-x-0"
                                        leave="transition ease-in-out duration-300 transform"
                                        leaveFrom="translate-x-0"
                                        leaveTo="-translate-x-full"
                                    >
                                        <DialogPanel className="relative flex w-full max-w-xs flex-1">
                                            {/* Sidebar component, swap this element with another sidebar if you like */}
                                            <Sidebar logo={logo} className={sidebarClassName}>{sidebar}</Sidebar>

                                            {/* close button */}
                                            <div className="flex w-16 justify-center pt-5 items-start">
                                                <button type="button" className="-m-2.5 p-2.5" onClick={() => setSidebarOpen(false)}>
                                                    <span className="sr-only">Close sidebar</span>
                                                    <X className="size-6 text-white" aria-hidden="true" />
                                                </button>
                                            </div>
                                        </DialogPanel>
                                    </TransitionChild>
                                </div>
                            </Dialog>
                        </Transition>

                        {/* Static sidebar for desktop */}
                        <div className={`hidden lg:block relative transition-all duration-300 ${desktopSidebarOpen ? 'w-72' : 'w-12'}`}>
                            {/* Sidebar component, swap this element with another sidebar if you like */}
                            <Sidebar logo={logo} className={sidebarClassName}>{sidebar}</Sidebar>
                        </div>

                        <div className="w-full h-full overflow-y-hidden">
                            {navbar ? (
                                <Navbar title={title} logo={logo}>
                                    {navbar}
                                </Navbar>
                            ) : null}
                            <main className={clsx("flex-1 h-full w-full relative flex flex-col", className)}>
                                {children}
                            </main>
                        </div>
                    </div>
                </SidebarContext.Provider>
            </div>
        </>
    )
}
