import { NestedRouterProvider } from "@vertesia/ui/context";
import { routes } from "./routes";

/**
 * Mount a React component to the host.
 */
export function mount(slot: string) {
    if (slot === "page") {
        return (
            <NestedRouterProvider
                routes={routes}
                index="/home" />
        );
    } else {
        console.warn('No component found for slot', slot);
        return null;
    }
}
