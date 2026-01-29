import clsx from 'clsx'
import { useEffect, useState } from 'react'
import { SidePanel } from '../core/components/SidePanel.js'
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

                        {/* Mobile sidebar */}
                        <div className="lg:hidden">
                            <SidePanel
                                className='bg-sidebar'
                                isOpen={sidebarOpen}
                                onClose={() => setSidebarOpen(false)}
                                side="left"
                                panelWidth={288}
                                resizable={false}
                                backdrop={true}
                            >
                                <Sidebar logo={logo} className={sidebarClassName}>{sidebar}</Sidebar>
                            </SidePanel>
                        </div>

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
