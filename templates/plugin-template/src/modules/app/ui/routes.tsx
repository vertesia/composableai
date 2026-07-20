import { HomeIcon, LibraryIcon } from 'lucide-react';
import { HomePage } from './pages/HomePage';
import { ViewExamplePage } from './pages/ViewExamplePage';

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
        // Example: embed a reusable View Experience (see pages/ViewExamplePage.tsx).
        path: '/views/document-library',
        label: 'Document Library',
        icon: LibraryIcon,
        Component: () => <ViewExamplePage />,
    },
    {
        path: '*',
        hideFromNav: true,
        Component: () => <div className="p-4 text-destructive">Not found</div>,
    },
];
