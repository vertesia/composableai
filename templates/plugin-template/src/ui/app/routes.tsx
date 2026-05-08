import { ChatPage } from "./pages/ChatPage";
import { ContentObjectsPage } from "./pages/ContentObjectsPage";
import { HomePage } from "./pages/HomePage";

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
        path: '/chat',
        Component: () => <ChatPage />,
    },
    {
        path: '/chat/:agentRunId',
        Component: () => <ChatPage />,
    },
    {
        path: '*',
        Component: () => <div className="text-red-800 p-4">Not found</div>,
    }
];
