import { NestedRouterProvider } from "@vertesia/ui/context";
import { routes } from "./routes";

/**
 * Export the plugin component.
 */
export default function ${ PluginComponent } ({ slot }: { slot: string }) {
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
