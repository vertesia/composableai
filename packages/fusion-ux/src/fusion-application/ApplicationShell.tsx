/**
 * Application Shell
 *
 * Layout component that wraps the application with navigation and chrome.
 */

import type { ApplicationShellProps, ThemeProviderProps } from './types.js';
import { SidebarNavigation } from '../fusion-navigation/SidebarNavigation.js';
import { TopbarNavigation } from '../fusion-navigation/TopbarNavigation.js';
import { NavigationItem } from '../fusion-navigation/NavigationItem.js';

/**
 * Theme provider component.
 *
 * Injects CSS custom properties based on the theme specification.
 */
export function ThemeProvider({ theme, children }: ThemeProviderProps) {
    if (!theme) {
        return <>{children}</>;
    }

    // Build CSS custom properties
    const cssVars: Record<string, string> = {};

    if (theme.primaryColor) {
        cssVars['--fusion-primary'] = theme.primaryColor;
    }
    if (theme.accentColor) {
        cssVars['--fusion-accent'] = theme.accentColor;
    }
    if (theme.backgroundColor) {
        cssVars['--fusion-bg'] = theme.backgroundColor;
    }
    if (theme.textColor) {
        cssVars['--fusion-text'] = theme.textColor;
    }
    if (theme.fontFamily) {
        cssVars['--fusion-font-family'] = theme.fontFamily;
    }

    // Border radius mapping
    const radiusMap: Record<string, string> = {
        none: '0',
        sm: '0.125rem',
        md: '0.375rem',
        lg: '0.5rem',
        full: '9999px',
    };
    if (theme.borderRadius && radiusMap[theme.borderRadius]) {
        cssVars['--fusion-radius'] = radiusMap[theme.borderRadius];
    }

    return (
        <div className="fusion-theme-provider" style={cssVars as React.CSSProperties}>
            {theme.customCss && (
                <style dangerouslySetInnerHTML={{ __html: theme.customCss }} />
            )}
            {children}
        </div>
    );
}

/**
 * Application header component.
 */
function ApplicationHeader({
    application,
    sidebarCollapsed: _sidebarCollapsed,
    onToggleSidebar,
    onNavigate,
}: {
    application: ApplicationShellProps['application'];
    sidebarCollapsed?: boolean;
    onToggleSidebar?: () => void;
    onNavigate?: (href: string, newTab?: boolean) => void;
}) {
    const logo = application.theme?.logo;

    return (
        <header className="fusion-app-header">
            {/* Sidebar toggle for mobile */}
            {onToggleSidebar && (
                <button
                    className="fusion-app-header-menu"
                    onClick={onToggleSidebar}
                    aria-label="Toggle navigation"
                >
                    <span className="fusion-menu-icon">☰</span>
                </button>
            )}

            {/* Logo */}
            <a
                href={application.defaultRoute}
                className="fusion-app-header-logo"
                onClick={(e) => {
                    if (onNavigate) {
                        e.preventDefault();
                        onNavigate(application.defaultRoute);
                    }
                }}
            >
                {logo?.light && (
                    <img
                        src={logo.light}
                        alt={logo.alt || application.title}
                        className="fusion-logo fusion-logo-light"
                        width={logo.width}
                        height={logo.height}
                    />
                )}
                {logo?.dark && (
                    <img
                        src={logo.dark}
                        alt={logo.alt || application.title}
                        className="fusion-logo fusion-logo-dark"
                        width={logo.width}
                        height={logo.height}
                    />
                )}
                {!logo?.light && !logo?.dark && (
                    <span className="fusion-app-header-title">{application.title}</span>
                )}
            </a>

            {/* Spacer */}
            <div className="fusion-app-header-spacer" />

            {/* Topbar navigation */}
            {application.navigation.topbar && application.navigation.topbar.length > 0 && (
                <TopbarNavigation
                    items={application.navigation.topbar}
                    onNavigate={onNavigate}
                />
            )}
        </header>
    );
}

/**
 * Application shell component.
 *
 * Provides the layout structure with header, sidebar, and main content area.
 *
 * @example
 * ```tsx
 * <ApplicationShell
 *   application={app}
 *   currentPath="/dashboard"
 *   globalData={globalData}
 *   context={context}
 *   onNavigate={(href) => router.push(href)}
 * >
 *   <ApplicationRouter ... />
 * </ApplicationShell>
 * ```
 */
export function ApplicationShell({
    application,
    currentPath,
    globalData,
    context,
    sidebarCollapsed = false,
    onToggleSidebar,
    onNavigate,
    onAction,
    children,
    className,
}: ApplicationShellProps) {
    const hasSidebar = application.navigation.sidebar && application.navigation.sidebar.length > 0;
    const hasFooter = application.navigation.footer && application.navigation.footer.length > 0;

    const classNames = [
        'fusion-app-shell',
        hasSidebar ? 'fusion-app-has-sidebar' : '',
        sidebarCollapsed ? 'fusion-app-sidebar-collapsed' : '',
        className || '',
    ]
        .filter(Boolean)
        .join(' ');

    return (
        <ThemeProvider theme={application.theme}>
            <div className={classNames}>
                {/* Header */}
                <ApplicationHeader
                    application={application}
                    sidebarCollapsed={sidebarCollapsed}
                    onToggleSidebar={hasSidebar ? onToggleSidebar : undefined}
                    onNavigate={onNavigate}
                />

                {/* Body */}
                <div className="fusion-app-body">
                    {/* Sidebar */}
                    {hasSidebar && (
                        <SidebarNavigation
                            sections={application.navigation.sidebar!}
                            dynamic={application.navigation.dynamic}
                            activePath={currentPath}
                            collapsed={sidebarCollapsed}
                            onToggleCollapse={onToggleSidebar}
                            data={globalData}
                            context={context}
                            onNavigate={onNavigate}
                            onAction={onAction}
                        />
                    )}

                    {/* Main content */}
                    <main className="fusion-app-main">
                        {children}
                    </main>
                </div>

                {/* Footer */}
                {hasFooter && (
                    <footer className="fusion-app-footer">
                        <nav className="fusion-app-footer-nav">
                            {application.navigation.footer!.map((item, index) => (
                                <NavigationItem
                                    key={item.type === 'divider' ? `divider-${index}` : (item as { id: string }).id}
                                    item={item}
                                    activePath={currentPath}
                                    data={globalData}
                                    onNavigate={onNavigate}
                                    onAction={onAction}
                                />
                            ))}
                        </nav>
                    </footer>
                )}
            </div>
        </ThemeProvider>
    );
}
