import type { LucideIcon } from 'lucide-react';
import { Database, HomeIcon, MessagesSquare, PlusCircle, Settings } from 'lucide-react';
import type { Route } from '@vertesia/ui/router';
import { ChatPage } from './pages/ChatPage';
import { ContentObjectDetailPage } from './pages/ContentObjectDetailPage';
import { ContentObjectsPage } from './pages/ContentObjectsPage';
import { ConversationsPage } from './pages/ConversationsPage';
import { HomePage } from './pages/HomePage';
import { SettingsPage } from './pages/SettingsPage';

export type PluginRoute = Route & {
    label?: string;
    icon?: LucideIcon;
    hideFromNav?: boolean;
};

// FULL scaffold: the minimal surface plus the working example features
// (Store-object list/detail, conversations list, settings). This file is
// installed over the minimal `src/ui/app/routes.tsx` when the project is
// created with `--full` (see scripts/apply-examples.mjs). Nav is derived from
// this manifest (entries with a `label` and no `hideFromNav`).
export const routes: PluginRoute[] = [
    {
        path: '/',
        label: 'nav.home',
        icon: HomeIcon,
        Component: () => <HomePage />,
    },
    {
        path: '/objects',
        label: 'nav.contentObjects',
        icon: Database,
        Component: () => <ContentObjectsPage />,
    },
    {
        path: '/objects/:id',
        hideFromNav: true,
        Component: () => <ContentObjectDetailPage />,
    },
    {
        path: '/conversations',
        label: 'nav.conversations',
        icon: MessagesSquare,
        Component: () => <ConversationsPage />,
    },
    {
        path: '/chat',
        label: 'nav.newChat',
        icon: PlusCircle,
        Component: () => <ChatPage />,
    },
    {
        path: '/chat/:agentRunId',
        hideFromNav: true,
        Component: () => <ChatPage />,
    },
    {
        path: '/settings',
        label: 'nav.settings',
        icon: Settings,
        Component: () => <SettingsPage />,
    },
    {
        path: '*',
        hideFromNav: true,
        Component: () => <div className="text-red-800 p-4">Not found</div>,
    },
];
