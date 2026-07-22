import type { Route } from '@vertesia/ui/router';
import type { LucideIcon } from 'lucide-react';
import { BookOpen, CheckSquare, GitBranch, HomeIcon, Lightbulb } from 'lucide-react';
import { GuideDetailPage } from './pages/GuideDetailPage';
import { HomePage } from './pages/HomePage';
import { IdeasPage } from './pages/IdeasPage';
import { LibraryPage } from './pages/LibraryPage';
import { ProcessPage } from './pages/ProcessPage';
import { ReviewQueuePage } from './pages/ReviewQueuePage';

export type PluginRoute = Route & {
    label?: string;
    icon?: LucideIcon;
    hideFromNav?: boolean;
};

export const routes: PluginRoute[] = [
    {
        path: '/content',
        label: 'Content',
        icon: HomeIcon,
        Component: () => <HomePage />,
    },
    {
        path: '/content/library',
        label: 'Library',
        icon: BookOpen,
        Component: () => <LibraryPage />,
    },
    {
        path: '/content/library/:id',
        hideFromNav: true,
        Component: () => <GuideDetailPage />,
    },
    {
        path: '/content/reviews',
        label: 'Reviews',
        icon: CheckSquare,
        Component: () => <ReviewQueuePage />,
    },
    {
        path: '/content/ideas',
        label: 'Ideas',
        icon: Lightbulb,
        Component: () => <IdeasPage />,
    },
    {
        path: '/content/process',
        label: 'Process',
        icon: GitBranch,
        Component: () => <ProcessPage />,
    },
];
