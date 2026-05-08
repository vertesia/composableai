import { NestedRouterProvider } from "@vertesia/ui/router";
import { ContentObjectsListStateProvider } from "./features/content-objects";
import { routes } from "./routes";

export function App() {
    return (
        <ContentObjectsListStateProvider>
            <NestedRouterProvider routes={routes} />
        </ContentObjectsListStateProvider>
    )
}