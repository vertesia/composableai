import { ChatPage } from './pages/ChatPage';
import { ContentObjectDetailPage } from './pages/ContentObjectDetailPage';
import { ContentObjectsPage } from './pages/ContentObjectsPage';
import { ConversationsPage } from './pages/ConversationsPage';
import { HomePage } from './pages/HomePage';
import { SettingsPage } from './pages/SettingsPage';

export const routes = [
    {
        path: '/',
        Component: () => <HomePage />,
    },
    {
        path: '/objects',
        Component: () => <ContentObjectsPage />,
    },
    {
        path: '/objects/:id',
        Component: () => <ContentObjectDetailPage />,
    },
    {
        path: '/conversations',
        Component: () => <ConversationsPage />,
    },
    {
        path: '/chat',
        Component: () => <ChatPage />,
    },
    {
        path: '/chat/:agentRunId',
        Component: () => <ChatPage />,
    },
    {
        path: '/settings',
        Component: () => <SettingsPage />,
    },
    {
        path: '*',
        Component: () => <div className="text-red-800 p-4">Not found</div>,
    },
];
