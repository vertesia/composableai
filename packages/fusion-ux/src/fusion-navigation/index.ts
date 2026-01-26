/**
 * Fusion Navigation Module
 *
 * Components for rendering navigation structures in fusion applications.
 *
 * @example
 * ```tsx
 * import {
 *   NavigationRenderer,
 *   SidebarNavigation,
 *   NavigationProvider,
 *   useNavigationContext,
 * } from '@vertesia/fusion-ux';
 *
 * // Render complete navigation
 * <NavigationRenderer
 *   navigation={app.navigation}
 *   activePath={router.pathname}
 *   onNavigate={(href) => router.push(href)}
 * />
 *
 * // Or just sidebar
 * <SidebarNavigation
 *   sections={navigation.sidebar}
 *   activePath={router.pathname}
 *   onNavigate={(href) => router.push(href)}
 * />
 * ```
 *
 * @packageDocumentation
 */

// Types
export type {
    NavigationRendererProps,
    SidebarNavigationProps,
    TopbarNavigationProps,
    NavigationSectionProps,
    NavigationItemProps,
    NavigationLinkProps,
    NavigationGroupProps,
    DynamicNavigationProps,
    NavigationContextValue,
} from './types.js';

// Context
export {
    NavigationContext,
    NavigationProvider,
    useNavigationContext,
    useNavigationContextSafe,
    type NavigationProviderProps,
} from './NavigationContext.js';

// Main Renderers
export {
    NavigationRenderer,
    SimpleSidebarNavigation,
} from './NavigationRenderer.js';

// Sidebar Navigation
export {
    SidebarNavigation,
    NavigationSection,
} from './SidebarNavigation.js';

// Topbar Navigation
export { TopbarNavigation } from './TopbarNavigation.js';

// Navigation Items
export {
    NavigationItem,
    NavigationLink,
    NavigationGroup,
} from './NavigationItem.js';

// Dynamic Navigation
export { DynamicNavigation } from './DynamicNavigation.js';
