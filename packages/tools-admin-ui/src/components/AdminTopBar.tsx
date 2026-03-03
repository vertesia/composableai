import { Avatar, Button, useTheme } from '@vertesia/ui/core';
import { useUserSession } from '@vertesia/ui/session';
import { Computer, LogOut, Moon, Sun } from 'lucide-react';

interface AdminTopBarProps {
    title: string;
}

function ThemeToggle() {
    const { theme, setTheme } = useTheme();
    const options = [
        { value: 'system' as const, icon: <Computer className="text-muted" /> },
        { value: 'light' as const, icon: <Sun className="text-muted" /> },
        { value: 'dark' as const, icon: <Moon className="text-muted" /> },
    ];

    return (
        <div className="flex items-center gap-1">
            {options.map(opt => (
                <Button
                    key={opt.value}
                    variant={theme === opt.value ? 'secondary' : 'outline'}
                    size="sm"
                    onClick={() => setTheme(opt.value)}
                    aria-label={opt.value}
                    className={theme !== opt.value ? 'hover:bg-secondary-background!' : undefined}
                >
                    {opt.icon}
                </Button>
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
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => logout()}
                            aria-label="Sign out"
                        >
                            <LogOut className="size-4" />
                        </Button>
                    </>
                )}
            </div>
        </header>
    );
}
