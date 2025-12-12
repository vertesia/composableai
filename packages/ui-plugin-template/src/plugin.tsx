import { PortalContainerProvider } from "@vertesia/ui/core";
import { App } from "./app";

/**
 * Export the plugin component.
 */
export default function UiPluginTemplatePlugin ({ slot }: { slot: string }) {
    if (slot === "page") {
        return (
            <PortalContainerProvider>
                <App />
            </PortalContainerProvider>
        );
    } else {
        console.warn('No component found for slot', slot);
        return null;
    }
}
