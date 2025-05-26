import clsx from 'clsx';
import { ComponentType, isValidElement, ReactNode, SyntheticEvent, useEffect, useState } from 'react';

import { Tab, TabsContext, useTabs } from './TabsContext.js';

function applyCurrentTab(tabs: Tab[], current?: string | (() => string)) {
    const name = typeof current === 'function' ? current() : current;
    let currentTab: Tab | null = null;
    const newTabs = [];
    for (const tab of tabs) {
        const newTab = { ...tab };
        newTab.current = false;
        newTabs.push(newTab);
        if (newTab.name === name) {
            currentTab = newTab;
        }
    }
    if (!currentTab) {
        currentTab = newTabs[0];
    }
    currentTab.current = true;
    return newTabs;
}

interface TabsProps {
    current?: string | (() => string);
    /**
     * Return false to prevent the tab from being selected
     * @param tab
     * @returns
     */
    onSelect?: (tab: Tab) => void | boolean;
    tabs: Tab[];
    children: ReactNode | ReactNode[];
    navigate?: (path: string) => void;
}
export function Tabs({ current, onSelect, tabs, children, navigate }: TabsProps) {
    const [_tabs, _setTabs] = useState<Tab[]>([]);
    useEffect(() => {
        _setTabs(applyCurrentTab(tabs, current));
    }, [current, tabs]);
    const context = {
        tabs: _tabs,
        select: (tab: Tab) => {
            if (onSelect) {
                if (onSelect(tab) === false) {
                    return;
                }
            }
            if (tab.href) {
                if (navigate) {
                    navigate(tab.href);
                } else {
                    window.location.href = tab.href;
                }
            } else {
                _setTabs([...applyCurrentTab(_tabs, tab.name)]);
            }
        }
    };

    return (
        <TabsContext.Provider value={context}>
            <div className="flex flex-col h-full">
                {children}
            </div>
        </TabsContext.Provider>
    );
}

interface TabsBarProps {
    actions?: ReactNode | ReactNode[];
    className?: string;
}
export function TabsBar({ actions, className }: TabsBarProps) {
    const { tabs, select } = useTabs();
    const _onClick = (e: SyntheticEvent, tab: Tab) => {
        e.preventDefault();
        e.stopPropagation();
        // ignore if disabled
        !tab.disabled && select(tab);
    };

    return (
        <div className="border-b flex items-start justify-between">
            <nav className="flex space-x-4 px-4" aria-label="Tabs">
                {tabs.map((tab) => {
                    const cursor = tab.disabled ? 'cursor-not-allowed' : 'cursor-pointer';
                    return (
                        <a
                            key={tab.name}
                            href={tab.href || '#' + tab.name}
                            onClick={(e) => _onClick(e, tab)}
                            className={clsx(
                                tab.current
                                    ? 'border-indigo-500 text-indigo-600 dark:border-indigo-400 dark:text-indigo-50'
                                    : 'border-transparent text-gray-500 dark:text-slate-300 hover:border-slate-400 hover:text-gray-700 dark:hover:border-slate-200 dark:hover:text-gray-200 ',
                                className,
                                'whitespace-nowrap border-b-2 py-2 px-1 text-sm font-medium',
                                cursor
                            )}
                            aria-current={tab.current ? 'page' : undefined}
                        >
                            {tab.label}
                        </a>
                    );
                })}
            </nav>
            <div className="flex gap-x-1">{actions}</div>
        </div>
    );
}

interface TabsPanelProps { }
export function TabsPanel({ }: TabsPanelProps) {
    const { tabs } = useTabs();
    const content = tabs.find((t) => t.current)?.content;
    if (!content) {
        return null;
    }

    if (isValidElement(content)) {
        return <div className="h-full overflow-y-auto flex-1">{content}</div>;
    }

    const Component = content as unknown as ComponentType;
    return (
        <div className="h-full overflow-y-auto flex-1">
            <Component />
        </div>
    );
}
