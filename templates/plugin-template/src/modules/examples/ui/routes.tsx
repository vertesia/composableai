import { LibraryIcon } from 'lucide-react';
import { ViewExamplePage } from './pages/ViewExamplePage';

export const routes = [
    {
        path: '/views/document-library',
        label: 'Document Library',
        icon: LibraryIcon,
        Component: () => <ViewExamplePage />,
    },
];
