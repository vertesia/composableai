import { HomePage, NextPage } from "../pages";

export const routes = [
    {
        path: '/',
        Component: HomePage,
    },
    {
        path: '/next',
        Component: NextPage,
    },
    {
        path: '*',
        Component: () => <div className="text-red-800 p-4">Not found</div>,
    }

];