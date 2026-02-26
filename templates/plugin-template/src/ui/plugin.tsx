import { PortalContainerProvider } from "@vertesia/ui/core";
import { App } from "./app";

/**
 * Export the plugin component.
 */
export default function TEMPLATE__PluginComponentName({ slot }: { slot: string }) {
    // Render the plugin component based on the slot.
    // Slot "page" is used in the App Portal
    // Slot "content" is used in the Composite App
    if (slot === "page" || slot === "content") {
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
