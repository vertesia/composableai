import type { LucideIcon } from 'lucide-react';
import { HomeIcon, PlusCircle } from 'lucide-react';
import type { Route } from '@vertesia/ui/router';
import { ChatPage } from './pages/ChatPage';
import { HomePage } from './pages/HomePage';

export type PluginRoute = Route & {
    label?: string;
    icon?: LucideIcon;
    hideFromNav?: boolean;
};

// Minimal default surface: a Home page and the built-in assistant chat.
// Nav is derived from this manifest (entries with a `label` and no `hideFromNav`).
// Build your app's pages here; see examples/ui for working references
// (Store-object list/detail, conversations list, settings) to copy and adapt.
export const routes: PluginRoute[] = [
    {
        path: '/',
        label: 'nav.home',
        icon: HomeIcon,
        Component: () => <HomePage />,
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
        path: '*',
        hideFromNav: true,
        Component: () => <div className="text-red-800 p-4">Not found</div>,
    },
];
