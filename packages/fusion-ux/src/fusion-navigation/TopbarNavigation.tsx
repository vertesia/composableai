/**
 * Topbar Navigation
 *
 * Renders a horizontal navigation bar.
 */

import type { TopbarNavigationProps } from './types.js';
import { NavigationItem } from './NavigationItem.js';

/**
 * Topbar navigation component.
 *
 * @example
 * ```tsx
 * <TopbarNavigation
 *   items={navigation.topbar}
 *   activePath={router.pathname}
 *   onNavigate={(href) => router.push(href)}
 * />
 * ```
 */
export function TopbarNavigation({
    items,
    activePath = '',
    data = {},
    onNavigate,
    onAction,
    className,
}: TopbarNavigationProps) {
    const classNames = [
        'fusion-topbar',
        className || '',
    ]
        .filter(Boolean)
        .join(' ');

    return (
        <nav className={classNames}>
            <div className="fusion-topbar-items">
                {items.map((item, index) => (
                    <NavigationItem
                        key={item.type === 'divider' ? `divider-${index}` : (item as { id: string }).id}
                        item={item}
                        activePath={activePath}
                        data={data}
                        onNavigate={onNavigate}
                        onAction={onAction}
                    />
                ))}
            </div>
        </nav>
    );
}
