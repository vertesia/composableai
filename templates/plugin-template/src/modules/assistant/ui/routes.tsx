import { Database, MessagesSquare, PlusCircle, Settings } from 'lucide-react';
import { ChatPage } from './pages/ChatPage';
import { ContentObjectDetailPage } from './pages/ContentObjectDetailPage';
import { ContentObjectsPage } from './pages/ContentObjectsPage';
import { ConversationsPage } from './pages/ConversationsPage';
import { SettingsPage } from './pages/SettingsPage';

export const routes = [
    {
        path: '/objects',
        label: 'nav.objects',
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
];
