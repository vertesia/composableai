/**
 * Exports the plugin component
 */
export default function ${ PluginComponent } ({ slot }: { slot: string }) {
    if (slot === "page") {
        return (
            <div className="text-2xl text-emerald-800">Hello world!</div>
        );
    } else {
        console.warn('No component found for slot', slot);
        return null;
    }
}
