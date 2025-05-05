import { MyPage } from "./MyPage";

export const routes = [
    {
        path: '/home',
        Component: MyPage,
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