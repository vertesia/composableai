import type { Route } from '@vertesia/ui/router';
import type { LucideIcon } from 'lucide-react';
import { BookOpen, CheckSquare, GitBranch, HomeIcon, Lightbulb } from 'lucide-react';

export type PluginRoute = Route & {
    label?: string;
    icon?: LucideIcon;
    hideFromNav?: boolean;
};

// Pages are loaded on first navigation — see the note in ../../assistant/ui/routes.tsx.
export const routes: PluginRoute[] = [
    {
        path: '/content',
        label: 'Content',
        icon: HomeIcon,
        LazyComponent: () => import('./pages/HomePage').then((m) => ({ default: m.HomePage })),
    },
    {
        path: '/content/library',
        label: 'Library',
        icon: BookOpen,
        LazyComponent: () => import('./pages/LibraryPage').then((m) => ({ default: m.LibraryPage })),
    },
    {
        path: '/content/library/:id',
        hideFromNav: true,
        LazyComponent: () => import('./pages/GuideDetailPage').then((m) => ({ default: m.GuideDetailPage })),
    },
    {
        path: '/content/reviews',
        label: 'Reviews',
        icon: CheckSquare,
        LazyComponent: () => import('./pages/ReviewQueuePage').then((m) => ({ default: m.ReviewQueuePage })),
    },
    {
        path: '/content/ideas',
        label: 'Ideas',
        icon: Lightbulb,
        LazyComponent: () => import('./pages/IdeasPage').then((m) => ({ default: m.IdeasPage })),
    },
    {
        path: '/content/process',
        label: 'Process',
        icon: GitBranch,
        LazyComponent: () => import('./pages/ProcessPage').then((m) => ({ default: m.ProcessPage })),
    },
];
