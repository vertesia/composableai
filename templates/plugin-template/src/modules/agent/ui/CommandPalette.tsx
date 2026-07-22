import { Modal } from '@vertesia/ui/core';
import { useUITranslation } from '@vertesia/ui/i18n';
import { useNavigate } from '@vertesia/ui/router';
import type { LucideIcon } from 'lucide-react';
import { Command, Search } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export interface CommandPaletteRoute {
    path: string;
    label?: string;
    icon?: LucideIcon;
    hideFromNav?: boolean;
}

interface CommandPaletteProps {
    routes: CommandPaletteRoute[];
}

interface PaletteItem {
    path: string;
    label: string;
    icon?: LucideIcon;
}

function isMacLike(): boolean {
    if (typeof navigator === 'undefined') return false;
    return /Mac|iPhone|iPad|iPod/.test(navigator.platform);
}

function buildItems(routes: CommandPaletteRoute[], t: (key: string) => string): PaletteItem[] {
    return routes.flatMap((route) => {
        if (route.hideFromNav || !route.label) {
            return [];
        }
        return {
            path: route.path,
            label: route.label.includes('.') ? t(route.label) : route.label,
            icon: route.icon,
        };
    });
}

export function CommandPaletteTrigger({ onOpen }: { onOpen: () => void }) {
    const { t } = useUITranslation();
    const shortcut = isMacLike() ? '⌘K' : 'Ctrl+K';
    return (
        <button
            type="button"
            onClick={onOpen}
            className="inline-flex items-center gap-2 rounded-md border bg-background px-3 py-1.5 text-xs text-muted hover:bg-muted transition-colors min-w-[220px]"
        >
            <Search className="size-3.5" />
            <span className="flex-1 text-start">{t('nav.commandPalettePlaceholder')}</span>
            <kbd className="hidden sm:inline-flex items-center gap-0.5 rounded border bg-muted px-1.5 py-0.5 text-[10px] font-mono">
                {shortcut}
            </kbd>
        </button>
    );
}

export function CommandPalette({ routes }: CommandPaletteProps) {
    const { t } = useUITranslation();
    const navigate = useNavigate();
    const [isOpen, setIsOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [activeIndex, setActiveIndex] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);

    const items = useMemo(() => buildItems(routes, t), [routes, t]);
    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return items;
        return items.filter((item) => item.label.toLowerCase().includes(q));
    }, [items, query]);

    const open = useCallback(() => {
        setQuery('');
        setActiveIndex(0);
        setIsOpen(true);
    }, []);

    const close = useCallback(() => setIsOpen(false), []);

    useEffect(() => {
        const handler = (event: KeyboardEvent) => {
            const isToggle = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k';
            if (isToggle) {
                event.preventDefault();
                setIsOpen((prev) => !prev);
            }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, []);

    useEffect(() => {
        if (isOpen) {
            const id = window.setTimeout(() => inputRef.current?.focus(), 0);
            return () => window.clearTimeout(id);
        }
    }, [isOpen]);

    const handleQueryChange = useCallback((value: string) => {
        setQuery(value);
        setActiveIndex(0);
    }, []);

    const choose = useCallback(
        (item: PaletteItem) => {
            navigate(item.path);
            close();
        },
        [navigate, close],
    );

    const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'ArrowDown') {
            event.preventDefault();
            setActiveIndex((i) => Math.min(i + 1, filtered.length - 1));
        } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            setActiveIndex((i) => Math.max(i - 1, 0));
        } else if (event.key === 'Enter') {
            event.preventDefault();
            const item = filtered[activeIndex];
            if (item) choose(item);
        } else if (event.key === 'Escape') {
            event.preventDefault();
            close();
        }
    };

    return (
        <>
            <CommandPaletteTrigger onOpen={open} />
            <Modal isOpen={isOpen} onClose={close} size="lg">
                <div className="flex flex-col">
                    <div className="flex items-center gap-2 border-b px-4 py-3">
                        <Command className="size-4 text-muted" />
                        <input
                            ref={inputRef}
                            value={query}
                            onChange={(e) => handleQueryChange(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder={t('nav.commandPalettePlaceholder')}
                            className="flex-1 bg-transparent text-sm outline-none"
                        />
                    </div>
                    <ul className="max-h-80 overflow-y-auto py-2">
                        {filtered.length === 0 && (
                            <li className="px-4 py-6 text-center text-sm text-muted">
                                {t('nav.commandPaletteNoResults')}
                            </li>
                        )}
                        {filtered.map((item, index) => {
                            const Icon = item.icon;
                            const isActive = index === activeIndex;
                            return (
                                <li key={item.path}>
                                    <button
                                        type="button"
                                        onMouseEnter={() => setActiveIndex(index)}
                                        onClick={() => choose(item)}
                                        className={`w-full flex items-center gap-3 px-4 py-2 text-start text-sm transition-colors ${
                                            isActive ? 'bg-muted' : 'hover:bg-muted/60'
                                        }`}
                                    >
                                        {Icon && <Icon className="size-4 text-muted" />}
                                        <span>{item.label}</span>
                                        <span className="ms-auto text-xs text-muted font-mono">{item.path}</span>
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                </div>
            </Modal>
        </>
    );
}
