import type { ReactNode } from 'react';
import { Avatar, Button } from '@vertesia/ui/core';
import { Env } from '@vertesia/ui/env';
import { useUITranslation } from '@vertesia/ui/i18n';
import { HamburgerButton } from '@vertesia/ui/layout';
import { useUserSession } from '@vertesia/ui/session';
import { Bot, LogOut } from 'lucide-react';
import { CommandPalette } from './CommandPalette';
import { openAssistant } from './assistantEvents';

interface PluginTopNavProps {
    /**
     * Optional primary action rendered between the command palette and the
     * assistant launcher. Use for the page-agnostic top action (e.g. a
     * global Upload or Create button).
     */
    primaryAction?: ReactNode;
    /**
     * Optional notifications slot rendered before the avatar.
     */
    notifications?: ReactNode;
    /** Hide the cmd-K palette trigger. */
    hideCommandPalette?: boolean;
    /** Hide the persistent assistant launcher. */
    hideAssistantLauncher?: boolean;
}

export function PluginTopNav({
    primaryAction,
    notifications,
    hideCommandPalette = false,
    hideAssistantLauncher = false,
}: PluginTopNavProps) {
    const { t } = useUITranslation();
    const { user, logout } = useUserSession();

    return (
        <div className="bg-sidebar text-sidebar-foreground border-sidebar-border h-14 flex items-center justify-between gap-3 border-b px-3">
            <div className="flex items-center gap-2 min-w-0">
                <div className="size-9 shrink-0">
                    <HamburgerButton />
                </div>
                <span className="text-sm font-semibold truncate">{Env.name}</span>
            </div>
            <div className="flex-1 flex items-center justify-center max-w-xl">
                {!hideCommandPalette && <CommandPalette />}
            </div>
            <div className="flex items-center gap-2">
                {primaryAction}
                {!hideAssistantLauncher && (
                    <Button variant="outline" size="sm" onClick={() => openAssistant()} alt={t('nav.openAssistant')}>
                        <Bot className="size-4" />
                        <span className="hidden md:inline">{t('nav.askAi')}</span>
                    </Button>
                )}
                {notifications}
                {user && (
                    <>
                        <Avatar size="sm" name={user.name} color="bg-primary" />
                        <Button variant="outline" size="sm" onClick={() => logout()} alt={t('nav.signOut')}>
                            <LogOut className="size-3.5" />
                        </Button>
                    </>
                )}
            </div>
        </div>
    );
}
