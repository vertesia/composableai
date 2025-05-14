/**
 * Mount a React component to the host.
 */
export function mount(slot: string) {
    if (slot === "page") {
        return (
            <div className="text-2xl text-emerald-800" v>Hello world!</div>
        );
    } else {
        console.warn('No component found for slot', slot);
        return null;
    }
}
