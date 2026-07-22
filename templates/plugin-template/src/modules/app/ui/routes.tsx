import { HomeIcon } from 'lucide-react';
import { HomePage } from './pages/HomePage';

// To make another module the app home, use:
// import { redirectTo } from '@vertesia/ui/router';
// Component: redirectTo('/content')

export const routes = [
    {
        path: '/',
        label: 'nav.home',
        icon: HomeIcon,
        Component: () => <HomePage />,
    },
    {
        path: '*',
        hideFromNav: true,
        Component: () => <div className="p-4 text-destructive">Not found</div>,
    },
];
