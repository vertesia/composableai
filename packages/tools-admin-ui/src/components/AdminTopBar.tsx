import { Avatar, Button, ModeToggle } from '@vertesia/ui/core';
import { useUserSession } from '@vertesia/ui/session';
import { LogOut } from 'lucide-react';

interface AdminTopBarProps {
    title: string;
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
                <ModeToggle label={false} />
                {user && (
                    <>
                        <Avatar size="sm" name={user.name} color="bg-primary" />
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => logout()}
                            alt="Sign out"
                        >
                            <LogOut className="size-4" />
                        </Button>
                    </>
                )}
            </div>
        </header>
    );
}
