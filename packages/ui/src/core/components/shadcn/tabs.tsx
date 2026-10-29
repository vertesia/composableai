import * as TabsPrimitive from '@radix-ui/react-tabs';
import { useUITranslation } from '@vertesia/ui/i18n';
import { ChevronDownIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import * as React from 'react';

import { cn } from '../libs/utils';
import { DropdownMenuItem } from './dropdown';
import { OverflowMoreMenu, type OverflowTabsVariant, useOverflowTabs } from './overflowTabs';
import { SelectBox } from './selectBox';

export interface Tab {
    name: string;
    current?: boolean;
    href?: string;
    label: ReactNode;
    content: ReactNode;
    disabled?: boolean;
    is_allowed?: boolean;
}

/**
 * Guard consulted before switching to another tab. Return `false` to cancel the switch — the active
 * tab, the URL hash and the browser history are all left untouched, so the guard can hold the user
 * on a tab that has unsaved changes while a confirmation is shown.
 *
 * It is only called when the target tab differs from the active one, but it may be called more than
 * once for a single attempted switch (a click reaches both the trigger and the Radix root), so any
 * side effect it performs must be idempotent.
 */
export type CanChangeTab = (nextTab: string, currentTab?: string) => boolean;

const TabsContext = React.createContext<{
    orientation?: 'horizontal' | 'vertical';
    size?: number;
    tabs?: Tab[];
    current?: string;
    setTab?: (name: string) => void;
    responsive?: boolean;
    variant?: 'tabs' | 'pills';
    updateHash?: boolean;
    canChangeTab?: CanChangeTab;
}>({
    size: undefined,
    tabs: undefined,
    current: undefined,
    setTab: undefined,
    responsive: false,
    variant: 'tabs',
    updateHash: true,
});

interface TabsProps {
    orientation?: 'horizontal' | 'vertical';
    current?: string | (() => string);
    tabs: Tab[];
    defaultValue?: string;
    className?: string;
    fullWidth?: boolean;
    fullHeight?: boolean;
    children?: React.ReactNode;
    onTabChange?: (tabName: string) => void;
    responsive?: boolean;
    variant?: 'tabs' | 'pills';
    updateHash?: boolean;
    canChangeTab?: CanChangeTab;
}

const Tabs = ({
    orientation = 'horizontal',
    tabs,
    defaultValue,
    current,
    className,
    fullWidth,
    fullHeight,
    children,
    onTabChange,
    responsive = false,
    variant = 'tabs',
    updateHash = true,
    canChangeTab,
}: TabsProps) => {
    // Filter tabs based on is_allowed (undefined or true means visible)
    const visibleTabs = React.useMemo(
        () => tabs.filter((tab) => tab.is_allowed === undefined || tab.is_allowed === true),
        [tabs],
    );

    // Initialize value
    const [value, setValue] = React.useState(() => {
        // First check if current is provided
        const currentValue = typeof current === 'function' ? current() : current;
        if (currentValue) {
            return currentValue;
        }

        // Then check hash
        const hash = window.location.hash;
        const currentTab = hash ? hash.substring(1) : undefined;

        // Check if the tab from hash exists in visible tabs
        if (currentTab && visibleTabs.some((tab) => tab.name === currentTab)) {
            return currentTab;
        }

        // Fall back to default or first visible tab
        return defaultValue || visibleTabs[0]?.name;
    });

    // Update when current prop changes (but don't create a loop)
    React.useEffect(() => {
        const currentValue = typeof current === 'function' ? current() : current;
        if (currentValue && currentValue !== value) {
            setValue(currentValue);
        }
    }, [current, value]);

    // Listen to hash changes only when there's no current prop being controlled externally
    React.useEffect(() => {
        if (current) return; // Skip hash handling if controlled by parent

        const handleHashChange = () => {
            const hash = window.location.hash;
            const currentTab = hash ? hash.substring(1) : undefined;

            // Only update if the tab exists in visible tabs
            if (currentTab && visibleTabs.some((tab) => tab.name === currentTab)) {
                setValue(currentTab);
            } else if (!hash && defaultValue) {
                // If no hash, fall back to default
                setValue(defaultValue);
            }
        };

        // Check initial hash
        handleHashChange();

        window.addEventListener('hashchange', handleHashChange);
        return () => window.removeEventListener('hashchange', handleHashChange);
    }, [current, visibleTabs, defaultValue]);

    const handleValueChange = React.useCallback(
        (newValue: string) => {
            // Bail before touching the value or the history so a cancelled switch is a no-op.
            if (newValue !== value && canChangeTab && !canChangeTab(newValue, value)) return;

            setValue(newValue);

            // Update the URL hash when tab changes (only if updateHash is true and not controlled by parent)
            if (updateHash && !current) {
                // Preserve existing history state when changing hash
                const currentState = window.history.state;
                const newUrl = `${window.location.pathname + window.location.search}#${newValue}`;
                window.history.pushState(currentState, '', newUrl);
            }

            if (onTabChange) {
                onTabChange(newValue);
            }
        },
        [current, onTabChange, updateHash, canChangeTab, value],
    );

    const setTab = React.useCallback(
        (tabName: string) => {
            handleValueChange(tabName);
        },
        [handleValueChange],
    );

    return (
        <TabsContext.Provider
            value={{
                orientation,
                tabs: visibleTabs,
                size: fullWidth ? visibleTabs.length : 0,
                current: value,
                setTab,
                responsive: responsive,
                variant,
                updateHash,
                canChangeTab,
            }}
        >
            <TabsPrimitive.Root
                orientation={orientation}
                defaultValue={value || visibleTabs[0]?.name}
                value={value}
                onValueChange={handleValueChange}
                className={cn('flex-1 flex flex-col min-h-0 px-2', fullHeight && 'h-full', className)}
            >
                {children}
            </TabsPrimitive.Root>
        </TabsContext.Provider>
    );
};

interface TabsBarProps {
    className?: string;
    sticky?: boolean;
    direction?: 'vertical' | 'horizontal';
    /**
     * Collapse the tabs that don't fit into a trailing "More" dropdown instead of letting the row
     * scroll or wrap. Horizontal bars only; it replaces the `responsive` select, since the row
     * already fits any width.
     */
    overflow?: boolean;
}

const TabsBar = ({ className, sticky, direction, overflow }: TabsBarProps) => {
    const { tabs, size, current, setTab, responsive, variant, updateHash, canChangeTab, orientation } =
        React.useContext(TabsContext);
    const barDirection = direction ?? orientation ?? 'horizontal';

    const fullWidth = size !== 0;

    const handleTabChange = React.useCallback(
        (tabName: string) => {
            if (!tabs || !setTab) return;
            // Consulted here too: this path pushes the tab href before `setTab` reaches the guard in
            // `Tabs`, so a cancelled switch would otherwise leave the URL pointing at the other tab.
            if (tabName !== current && canChangeTab && !canChangeTab(tabName, current)) return;

            const tab = tabs.find((t) => t.name === tabName);

            if (tab?.href && updateHash) {
                // Preserve existing history state when changing tabs
                const currentState = window.history.state;
                window.history.pushState(currentState, '', tab.href);
            }

            setTab(tabName);
        },
        [tabs, setTab, updateHash, canChangeTab, current],
    );

    if (!tabs || !setTab) {
        console.warn('TabsBar: No tabs provided or setTab not available');
        return null;
    }

    if (overflow && barDirection === 'horizontal') {
        return (
            <OverflowTabsList
                tabs={tabs}
                current={current ?? ''}
                onTabChange={handleTabChange}
                variant={variant}
                className={cn(sticky && 'sticky top-0 bg-background z-10', className)}
            />
        );
    }

    return (
        <>
            {responsive && (
                <div className="px-2 block lg:hidden">
                    <SelectBox
                        label="Tab"
                        className={cn(sticky && 'sticky top-0 bg-background z-10', className)}
                        options={tabs}
                        optionLabel={(tab: Tab) => (typeof tab.label === 'string' ? tab.label : String(tab.label))}
                        value={tabs.find((tab) => tab.name === current)}
                        onChange={(tab: Tab) => {
                            handleTabChange(tab.name);
                        }}
                    />
                </div>
            )}
            <TabsList
                size={size}
                variant={variant}
                className={cn(
                    fullWidth ? 'w-full' : '',
                    sticky && 'sticky top-0 bg-background z-10',
                    // TabsList's `border-b -mb-px` is the rail under a ROW of tabs. In vertical
                    // mode it renders as a stray line beneath the column, so drop it here only.
                    barDirection === 'vertical' ? 'flex-col items-start border-b-0 mb-0' : 'flex-row',
                    responsive ? 'hidden lg:flex' : '',
                    className,
                )}
            >
                {tabs.map((tab) => (
                    <TabsTrigger
                        className={cn(barDirection === 'vertical' ? 'w-full text-start' : '')}
                        key={tab.name}
                        value={tab.name}
                        disabled={tab.disabled}
                        href={tab.href}
                        variant={variant}
                        onClick={() => handleTabChange(tab.name)}
                    >
                        {tab.label}
                    </TabsTrigger>
                ))}
            </TabsList>
        </>
    );
};

/** Overflow-row tab styling, matching the corresponding `TabsTrigger` variants. */
const OVERFLOW_VARIANT_CLASSES: Record<
    OverflowTabsVariant,
    { base: string; active: string; inactive: string; icon: string }
> = {
    tabs: {
        base: 'flex items-center border-b-2 px-2 py-1.5 text-sm font-medium whitespace-nowrap cursor-pointer shrink-0',
        inactive: 'border-transparent text-muted hover:border-border hover:text-foreground',
        active: 'border-primary text-info',
        icon: 'ms-1 size-4',
    },
    pills: {
        base: 'flex items-center rounded-md px-2 py-1 text-xs font-medium whitespace-nowrap cursor-pointer shrink-0',
        inactive: 'text-muted hover:bg-muted/60',
        active: 'bg-muted text-foreground',
        icon: 'ms-0.5 size-3.5',
    },
};

interface OverflowTabsListProps {
    tabs: Tab[];
    current: string;
    onTabChange: (name: string) => void;
    variant?: OverflowTabsVariant;
    className?: string;
}

/**
 * `TabsBar overflow` row: tabs that don't fit collapse into a trailing "More" dropdown. The
 * visible/overflow split is measured from a hidden full-width row.
 */
function OverflowTabsList({ tabs, current, onTabChange, variant = 'tabs', className }: OverflowTabsListProps) {
    const { t } = useUITranslation();
    const styles = OVERFLOW_VARIANT_CLASSES[variant];
    const { containerRef, setItemRef, setMoreRef, visible, overflow, activeInOverflow } = useOverflowTabs(
        tabs,
        (tab) => tab.name === current,
    );
    const moreLabel = t('agent.moreTabs');

    return (
        <div ref={containerRef} className={cn('relative', className)}>
            {/* Hidden measurement row: all tabs + More at natural width, kept separate
                from the visible row so measuring can't feed back into the layout. */}
            <div aria-hidden className="pointer-events-none invisible absolute start-0 top-0 flex w-max gap-1">
                {tabs.map((tab, i) => (
                    <button
                        type="button"
                        key={tab.name}
                        tabIndex={-1}
                        ref={setItemRef(i)}
                        className={cn(styles.base, styles.inactive)}
                    >
                        {tab.label}
                    </button>
                ))}
                <button type="button" tabIndex={-1} ref={setMoreRef} className={cn(styles.base, styles.inactive)}>
                    {moreLabel}
                    <ChevronDownIcon className={styles.icon} />
                </button>
            </div>

            {/* Visible row */}
            <div className={cn('flex gap-1 overflow-hidden', variant === 'tabs' && '-mb-px border-b')}>
                {visible.map((tab) => {
                    const isActive = tab.name === current;
                    return (
                        // Tab-bar primitive: raw button mirrors core TabsTrigger styling.
                        <button
                            type="button"
                            key={tab.name}
                            aria-current={isActive ? 'page' : undefined}
                            disabled={tab.disabled}
                            onClick={() => onTabChange(tab.name)}
                            className={cn(
                                styles.base,
                                isActive ? styles.active : styles.inactive,
                                'disabled:pointer-events-none disabled:opacity-50',
                            )}
                        >
                            {tab.label}
                        </button>
                    );
                })}

                {overflow.length > 0 && (
                    <OverflowMoreMenu
                        label={moreLabel}
                        triggerClassName={cn(styles.base, activeInOverflow ? styles.active : styles.inactive)}
                        icon={<ChevronDownIcon className={styles.icon} />}
                    >
                        {overflow.map((tab) => (
                            <DropdownMenuItem
                                key={tab.name}
                                disabled={tab.disabled}
                                onClick={() => onTabChange(tab.name)}
                                className={cn(tab.name === current && 'text-info')}
                            >
                                {tab.label}
                            </DropdownMenuItem>
                        ))}
                    </OverflowMoreMenu>
                )}
            </div>
        </div>
    );
}

const TabsPanel = ({ className }: { className?: string }) => {
    const { tabs } = React.useContext(TabsContext);

    if (!tabs) return null;

    return (
        <>
            {tabs.map((tab) => (
                <TabsContent key={tab.name} value={tab.name} className={className}>
                    {tab.content}
                </TabsContent>
            ))}
        </>
    );
};

type TabsListProps = React.ComponentPropsWithoutRef<typeof TabsPrimitive.List> & {
    size?: number;
    variant?: 'tabs' | 'pills';
};

const TabsList: React.ForwardRefExoticComponent<
    TabsListProps & React.RefAttributes<React.ElementRef<typeof TabsPrimitive.List>>
> = React.forwardRef<React.ElementRef<typeof TabsPrimitive.List>, TabsListProps>(
    ({ className, size, variant = 'tabs', ...props }, ref) => (
        <TabsContext.Provider value={{ size, variant }}>
            <TabsPrimitive.List
                ref={ref}
                className={cn(
                    variant === 'tabs' ? 'border-b -mb-px flex gap-4' : 'flex gap-2 p-1 rounded-md',
                    className,
                )}
                {...props}
            />
        </TabsContext.Provider>
    ),
);
TabsList.displayName = TabsPrimitive.List.displayName;

type TabsTriggerProps = React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger> & {
    href?: string;
    variant?: 'tabs' | 'pills';
};

const TabsTrigger: React.ForwardRefExoticComponent<
    TabsTriggerProps & React.RefAttributes<React.ElementRef<typeof TabsPrimitive.Trigger>>
> = React.forwardRef<React.ElementRef<typeof TabsPrimitive.Trigger>, TabsTriggerProps>(
    ({ className, href, variant = 'tabs', ...props }, ref) => {
        const { size } = React.useContext(TabsContext);

        const handleClick = React.useCallback(
            (event: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
                if (href) {
                    event.preventDefault();
                    // Preserve existing history state when changing tabs
                    const currentState = window.history.state;
                    window.history.pushState(currentState, '', href);
                }
                if (props.onClick) {
                    (props.onClick as React.MouseEventHandler<HTMLButtonElement>)(event);
                }
            },
            [href, props.onClick],
        );

        return (
            <TabsPrimitive.Trigger
                ref={ref}
                className={cn(
                    variant === 'tabs'
                        ? cn(
                              'border-b-2 px-2 py-1.5 text-sm font-medium whitespace-nowrap cursor-pointer',
                              'border-transparent text-muted hover:border-border hover:text-foreground',
                              'data-[state=active]:border-primary data-[state=active]:text-info',
                              'disabled:pointer-events-none disabled:opacity-50',
                          )
                        : cn(
                              'px-3 py-1.5 text-sm font-medium whitespace-nowrap cursor-pointer rounded-sm transition-colors',
                              'border border-input bg-muted shadow-xs hover:bg-muted ring-inset',
                              'data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm',
                              'disabled:pointer-events-none disabled:opacity-50',
                          ),
                    className,
                    size ? `w-1/${size}` : '',
                )}
                onClick={handleClick}
                {...props}
            />
        );
    },
);
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

type TabsContentProps = React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>;

const TabsContent: React.ForwardRefExoticComponent<
    TabsContentProps & React.RefAttributes<React.ElementRef<typeof TabsPrimitive.Content>>
> = React.forwardRef<React.ElementRef<typeof TabsPrimitive.Content>, TabsContentProps>(
    ({ className, ...props }, ref) => (
        <TabsPrimitive.Content
            ref={ref}
            className={cn('focus-visible:outline-none', 'flex-1 overflow-y-auto min-h-0 pt-2 pb-4', className)}
            {...props}
        />
    ),
);
TabsContent.displayName = TabsPrimitive.Content.displayName;

export { Tabs, TabsBar, TabsContent, TabsList, TabsPanel, TabsTrigger };
