import { MultiPagePlugin } from "@vertesia/ui-extension-sdk";
import "./index.css";
import { routes } from "./routes";

/**
 * Mount a React component to the DOM.
 */
export function mount(slot: string) {
    if (slot === "page") {
        return (
            <MultiPagePlugin
                title="${plugin_title}"
                routes={routes}
                index="/home" />
        );
    } else {
        console.warn('No component found for slot', slot);
        return null;
    }
}
