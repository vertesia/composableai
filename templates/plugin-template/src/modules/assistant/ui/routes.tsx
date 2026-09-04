import { Database, MessagesSquare, PlusCircle, Settings } from 'lucide-react';

// Pages are loaded on first navigation. Importing them here instead would pull every page's
// dependency graph — agent chat, the document viewers, the markdown stack — into the entry chunk.
export const routes = [
    {
        path: '/objects',
        label: 'nav.objects',
        icon: Database,
        LazyComponent: () => import('./pages/ContentObjectsPage').then((m) => ({ default: m.ContentObjectsPage })),
    },
    {
        path: '/objects/:id',
        hideFromNav: true,
        LazyComponent: () =>
            import('./pages/ContentObjectDetailPage').then((m) => ({ default: m.ContentObjectDetailPage })),
    },
    {
        path: '/conversations',
        label: 'nav.conversations',
        icon: MessagesSquare,
        LazyComponent: () => import('./pages/ConversationsPage').then((m) => ({ default: m.ConversationsPage })),
    },
    {
        path: '/chat',
        label: 'nav.newChat',
        icon: PlusCircle,
        LazyComponent: () => import('./pages/ChatPage').then((m) => ({ default: m.ChatPage })),
    },
    {
        path: '/chat/:agentRunId',
        hideFromNav: true,
        LazyComponent: () => import('./pages/ChatPage').then((m) => ({ default: m.ChatPage })),
    },
    {
        path: '/settings',
        label: 'nav.settings',
        icon: Settings,
        LazyComponent: () => import('./pages/SettingsPage').then((m) => ({ default: m.SettingsPage })),
    },
];
