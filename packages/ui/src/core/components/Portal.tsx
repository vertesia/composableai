import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const PORTAL_ID = '--tailwind-portal';

interface PortalProps {
    children: React.ReactNode | React.ReactNode[];
}
export function Portal({ children }: PortalProps) {
    const tempNode = useRef<HTMLSpanElement>(null);
    const [portalEl, setPortalEl] = useState<HTMLDivElement | null>(null);

    // hack to have the Portal not generating hydration errors (content mismatch) on SSR / CSR
    useEffect(() => {
        if (tempNode.current) { // we are on the browser -> we an use the portal
            const doc = tempNode.current.ownerDocument;
            let portalEl = doc.getElementById(PORTAL_ID) as HTMLDivElement;
            if (!portalEl) {
                portalEl = doc.createElement('DIV') as HTMLDivElement;
                portalEl.id = PORTAL_ID;
                doc.body.appendChild(portalEl);
            }
            setPortalEl(portalEl);
        }
    }, [tempNode.current]);

    if (portalEl) {
        return createPortal(children, portalEl);
    } else {
        return <span ref={tempNode} />
    }

}