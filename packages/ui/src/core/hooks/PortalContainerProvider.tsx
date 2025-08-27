import React from "react";

const PortalContainerContext = React.createContext<HTMLElement | undefined>(undefined);

function findOrCreatePortalContainer(root: ShadowRoot | Document, id = "plugin-portal-container") {
    // look only at direct children
    for (const child of Array.from(root.children)) {
        if (child instanceof HTMLElement && child.id === id) {
            return child;
        }
    }
    // not found → create
    const container = document.createElement("div");
    container.id = id;
    root.appendChild(container);
    return container;
}

export function PortalContainerProvider({
    children,
    id = "plugin-portal-container",
}: {
    children: React.ReactNode;
    id?: string;
}) {
    const ref = React.useRef<HTMLDivElement>(null);
    const [container, setContainer] = React.useState<HTMLElement | null | undefined>(undefined);

    React.useEffect(() => {
        if (ref.current) {
            const root = ref.current.getRootNode();
            if (root instanceof ShadowRoot || root instanceof Document) {
                const container = findOrCreatePortalContainer(root, id);
                setContainer(container);
            } else {
                setContainer(null);
            }
        }
    }, [id]);

    // If container not discovered yet → render hidden marker only
    if (container === undefined) {
        return <div ref={ref} style={{ display: "none" }} />;
    }

    // Once container is resolved (null or HTMLElement) → provide it
    return (
        <PortalContainerContext.Provider value={container || undefined}>
            {children}
        </PortalContainerContext.Provider>
    );
}

export function usePortalContainer() {
    return React.useContext(PortalContainerContext);
}