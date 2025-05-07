import { HomePage } from "./pages/HomePage";

export const routes = [
    {
        path: '/home',
        Component: HomePage,
    },
    {
        path: '/test',
        Component: () => <div className="p-4">Test</div>,
    },
    {
        path: '*',
        Component: () => <div className="text-red-800 p-4">Not found</div>,
    }

];