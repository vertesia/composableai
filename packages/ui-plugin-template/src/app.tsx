import { NestedRouterProvider } from "@vertesia/ui/router";
import { routes } from "./routes";

export function App() {
    return (
        <NestedRouterProvider routes={routes} />
    )
}