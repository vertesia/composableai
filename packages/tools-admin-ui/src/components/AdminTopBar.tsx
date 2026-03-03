import { Avatar, useTheme } from '@vertesia/ui/core';
import { useUserSession } from '@vertesia/ui/session';
import { Computer, LogOut, Moon, Sun } from 'lucide-react';

interface AdminTopBarProps {
    title: string;
}

function ThemeToggle() {
    const { theme, setTheme } = useTheme();
    const options = [
        { value: 'system' as const, icon: <Computer className="size-3.5 text-muted-foreground" /> },
        { value: 'light' as const, icon: <Sun className="size-3.5 text-muted-foreground" /> },
        { value: 'dark' as const, icon: <Moon className="size-3.5 text-muted-foreground" /> },
    ];

    return (
        <div className="flex items-center gap-1">
            {options.map(opt => (
                <button
                    key={opt.value}
                    type="button"
                    onClick={() => setTheme(opt.value)}
                    aria-label={opt.value}
                    className={`inline-flex h-8 items-center justify-center rounded px-2.5 text-xs font-medium ${
                        theme === opt.value
                            ? 'bg-primary/5 text-primary shadow-xs dark:bg-primary/10'
                            : 'border border-input bg-background shadow-xs hover:bg-muted'
                    }`}
                >
                    {opt.icon}
                </button>
            ))}
        </div>
    );
}

export function AdminTopBar({ title }: AdminTopBarProps) {
    const { user, logout } = useUserSession();

    return (
        <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-border bg-background px-6">
            <div className="flex items-center gap-3">
                <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-xs font-semibold uppercase tracking-wider text-primary-foreground">
                    {title.split(/\s+/).map(w => w[0]).filter(Boolean).slice(0, 2).join('')}
                </div>
                <span className="text-sm font-semibold text-foreground">{title}</span>
            </div>

            <div className="flex items-center gap-3">
                <ThemeToggle />
                {user && (
                    <>
                        <Avatar size="sm" name={user.name} color="bg-primary" />
                        <button
                            type="button"
                            onClick={() => logout()}
                            aria-label="Sign out"
                            className="inline-flex h-8 items-center justify-center rounded-md px-3 text-xs font-medium hover:bg-muted/50"
                        >
                            <LogOut className="size-4" />
                        </button>
                    </>
                )}
            </div>
        </header>
    );
}
