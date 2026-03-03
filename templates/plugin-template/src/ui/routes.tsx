import { ChatPage, HomePage } from "./pages";

export const routes = [
    {
        path: '/',
        Component: HomePage,
    },
    {
        path: '/chat',
        Component: ChatPage,
    },
    {
        path: '/chat/:runId/:workflowId',
        Component: ChatPage,
    },
    {
        path: '*',
        Component: () => <div className="text-red-800 p-4">Not found</div>,
    }
];
