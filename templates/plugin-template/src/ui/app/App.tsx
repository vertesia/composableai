import { NestedRouterProvider } from "@vertesia/ui/router";
import { ContentObjectsListStateProvider } from "./features/content-objects";
import { ConversationsListStateProvider } from "./features/conversations";
import { routes } from "./routes";

export function App() {
    return (
        <ContentObjectsListStateProvider>
            <ConversationsListStateProvider>
                <NestedRouterProvider routes={routes} />
            </ConversationsListStateProvider>
        </ContentObjectsListStateProvider>
    )
}