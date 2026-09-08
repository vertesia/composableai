import { HomeIcon } from 'lucide-react';
import { HomePage } from './pages/HomePage';

// To make another module the app home, use:
// import { redirectTo } from '@vertesia/ui/router';
// Component: redirectTo('/content')

// This module stays eagerly imported because '/' is the landing route: lazy-loading it would cost
// an extra round trip on every cold load. Other modules use `LazyComponent` — see
// ../../assistant/ui/routes.tsx.

// A page nested under another is a routed sub-page -- its own component on a `/parent/child` path,
// reachable by its own URL -- and it is listed in the parent's `children` in
// `src/tool-server/ui-nav-items.ts`. A view switched by parent-local state (a tab, modal, accordion
// or `useState`) is not a page: it cannot be linked, deep-linked, or shown in navigation. To nest:
//
//     { path: '/projects', label: 'Projects', icon: FolderIcon, Component: () => <ProjectsPage /> },
//     { path: '/projects/timeline', label: 'Timeline', icon: ClockIcon, Component: () => <TimelinePage /> },
//
// then in ui-nav-items.ts give Projects a `children: [{ label: 'Timeline', icon: 'Clock',
// route: '/projects/timeline' }]` -- the Composite App nests by `children`, never by path depth.
// Routes without a `label`, or with `hideFromNav: true`, stay out of navigation entirely.

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
