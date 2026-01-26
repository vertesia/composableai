/**
 * Navigation Renderer
 *
 * Main component for rendering the complete navigation structure.
 */

import { useState } from 'react';
import type { NavigationRendererProps } from './types.js';
import { NavigationProvider } from './NavigationContext.js';
import { SidebarNavigation } from './SidebarNavigation.js';
import { TopbarNavigation } from './TopbarNavigation.js';
import { NavigationItem } from './NavigationItem.js';

/**
 * Main navigation renderer component.
 *
 * Renders the complete navigation structure including sidebar,
 * topbar, and footer navigation.
 *
 * @example
 * ```tsx
 * <NavigationRenderer
 *   navigation={app.navigation}
 *   activePath={router.pathname}
 *   data={resolvedData}
 *   onNavigate={(href) => router.push(href)}
 *   onAction={(action, config) => handleAction(action, config)}
 * />
 * ```
 */
export function NavigationRenderer({
    navigation,
    activePath = '',
    data = {},
    context,
    onNavigate,
    onAction,
    className,
}: NavigationRendererProps) {
    const [sidebarCollapsed, setSidebarCollapsed] = useState(
        navigation.settings?.sidebarDefaultCollapsed ?? false
    );

    const toggleSidebar = () => {
        setSidebarCollapsed(!sidebarCollapsed);
    };

    const classNames = [
        'fusion-navigation',
        sidebarCollapsed ? 'fusion-navigation-sidebar-collapsed' : '',
        className || '',
    ]
        .filter(Boolean)
        .join(' ');

    return (
        <NavigationProvider
            activePath={activePath}
            initialCollapsed={sidebarCollapsed}
            data={data}
            onNavigate={onNavigate}
        >
            <div className={classNames}>
                {/* Topbar Navigation */}
                {navigation.topbar && navigation.topbar.length > 0 && (
                    <TopbarNavigation
                        items={navigation.topbar}
                        activePath={activePath}
                        data={data}
                        onNavigate={onNavigate}
                        onAction={onAction}
                    />
                )}

                {/* Sidebar Navigation */}
                {navigation.sidebar && navigation.sidebar.length > 0 && (
                    <SidebarNavigation
                        sections={navigation.sidebar}
                        dynamic={navigation.dynamic}
                        activePath={activePath}
                        collapsed={sidebarCollapsed}
                        onToggleCollapse={toggleSidebar}
                        data={data}
                        context={context}
                        onNavigate={onNavigate}
                        onAction={onAction}
                    />
                )}

                {/* Footer Navigation */}
                {navigation.footer && navigation.footer.length > 0 && (
                    <footer className="fusion-footer-nav">
                        {navigation.footer.map((item, index) => (
                            <NavigationItem
                                key={item.type === 'divider' ? `divider-${index}` : (item as { id: string }).id}
                                item={item}
                                activePath={activePath}
                                data={data}
                                onNavigate={onNavigate}
                                onAction={onAction}
                            />
                        ))}
                    </footer>
                )}
            </div>
        </NavigationProvider>
    );
}

/**
 * Simple sidebar-only navigation.
 * Use this when you only need sidebar navigation without topbar/footer.
 */
export function SimpleSidebarNavigation({
    navigation,
    activePath,
    data,
    context,
    onNavigate,
    onAction,
    className,
}: NavigationRendererProps) {
    const [collapsed, setCollapsed] = useState(
        navigation.settings?.sidebarDefaultCollapsed ?? false
    );

    if (!navigation.sidebar) {
        return null;
    }

    return (
        <SidebarNavigation
            sections={navigation.sidebar}
            dynamic={navigation.dynamic}
            activePath={activePath}
            collapsed={collapsed}
            onToggleCollapse={() => setCollapsed(!collapsed)}
            data={data}
            context={context}
            onNavigate={onNavigate}
            onAction={onAction}
            className={className}
        />
    );
}
