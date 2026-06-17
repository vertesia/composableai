import type { Route } from '@vertesia/ui/router';
import type { LucideIcon } from 'lucide-react';
import { BookOpen, CheckSquare, GitBranch, HomeIcon, Lightbulb, PlusCircle } from 'lucide-react';
import { ChatPage } from './pages/ChatPage';
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
        path: '/',
        label: 'Home',
        icon: HomeIcon,
        Component: () => <HomePage />,
    },
    {
        path: '/library',
        label: 'Library',
        icon: BookOpen,
        Component: () => <LibraryPage />,
    },
    {
        path: '/library/:id',
        hideFromNav: true,
        Component: () => <GuideDetailPage />,
    },
    {
        path: '/reviews',
        label: 'Reviews',
        icon: CheckSquare,
        Component: () => <ReviewQueuePage />,
    },
    {
        path: '/ideas',
        label: 'Ideas',
        icon: Lightbulb,
        Component: () => <IdeasPage />,
    },
    {
        path: '/process',
        label: 'Process',
        icon: GitBranch,
        Component: () => <ProcessPage />,
    },
    {
        path: '/chat',
        label: 'Chat',
        icon: PlusCircle,
        Component: () => <ChatPage />,
    },
    {
        path: '/chat/:agentRunId',
        hideFromNav: true,
        Component: () => <ChatPage />,
    },
    {
        path: '*',
        hideFromNav: true,
        Component: () => <div className="p-4 text-destructive">Not found</div>,
    },
];
