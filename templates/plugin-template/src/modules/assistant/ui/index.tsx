import type { PropsWithChildren } from 'react';
import { ContentObjectsListStateProvider } from './features/content-objects';
import { ConversationsListStateProvider } from './features/conversations';

export { routes } from './routes';

export function AppProviders({ children }: PropsWithChildren) {
    return (
        <ContentObjectsListStateProvider>
            <ConversationsListStateProvider>{children}</ConversationsListStateProvider>
        </ContentObjectsListStateProvider>
    );
}
