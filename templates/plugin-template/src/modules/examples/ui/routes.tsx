import { LibraryIcon } from 'lucide-react';

// Pages are loaded on first navigation — see the note in ../../assistant/ui/routes.tsx.
export const routes = [
    {
        path: '/views/document-library',
        label: 'Document Library',
        icon: LibraryIcon,
        LazyComponent: () => import('./pages/ViewExamplePage').then((m) => ({ default: m.ViewExamplePage })),
    },
];
