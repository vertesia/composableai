import { Avatar, Button } from '@vertesia/ui/core';
import { Env } from '@vertesia/ui/env';
import { HamburgerButton } from '@vertesia/ui/layout';
import { useUserSession } from '@vertesia/ui/session';
import { LogOut } from 'lucide-react';

export function PluginTopNav() {
    const { user, logout } = useUserSession();

    return (
        <div className="bg-sidebar text-sidebar-foreground border-sidebar-border h-10 flex justify-between items-center border-b">
            <ul className="flex items-center justify-start">
                <li className="p-2">
                    <HamburgerButton />
                </li>
                <li className="text-sm font-semibold">
                    {Env.name}
                </li>
            </ul>
            <ul className="flex items-center justify-end mx-3 gap-2">
                {user && (
                    <>
                        <li>
                            <Avatar size="sm" name={user.name} color="bg-primary" />
                        </li>
                        <li>
                            <Button
                                variant="outline"
                                size="xs"
                                onClick={() => logout()}
                                alt="Sign out"
                            >
                                <LogOut className="size-3.5" />
                            </Button>
                        </li>
                    </>
                )}
            </ul>
        </div>
    );
}
