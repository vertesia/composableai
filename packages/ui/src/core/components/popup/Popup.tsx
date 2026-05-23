import { createContext, type RefObject, type ReactNode, useContext, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { PopupController, type PopupControllerOptions } from "./PopupController";
import type { Constraints } from "./position";


const PopupContext = createContext<PopupController | undefined>(undefined);

export function usePopupController() {
    const ctrl = useContext(PopupContext);
    if (!ctrl) throw new Error("usePopupController must be used inside a Popup component");
    return ctrl;
}

interface DOMPopupProps extends Omit<PopupControllerOptions, 'anchor' | 'popup' | 'root'> {
    isOpen: boolean;
    constraints: Constraints;
    anchor: HTMLElement;
    root?: HTMLElement;
    zIndex?: number;
    position?: "absolute" | "fixed";
    onClose?: () => void;
    onOpen?: () => void;
    className?: string;
    id?: string;
    children: ReactNode | ReactNode[];
    ctrlRef?: RefObject<PopupController | undefined>;
}
export function DOMPopup({ ctrlRef, id, constraints, isOpen, children, className, onClose, onOpen, zIndex, position, anchor, root, closeOnClick, closeOnEsc, blockPageScroll }: DOMPopupProps) {
    const popupRef = useRef<HTMLDivElement>(null);
    const [ctrl, setCtrl] = useState<PopupController | undefined>();
    const onCloseRef = useRef(onClose);
    const onOpenRef = useRef(onOpen);
    onCloseRef.current = onClose;
    onOpenRef.current = onOpen;
    useEffect(() => {
        if (!anchor) throw new Error("Anchor element is required");
        const _ctrl = new PopupController({
            anchor,
            root,
            closeOnClick,
            closeOnEsc,
            blockPageScroll,
            onClose: () => onCloseRef.current?.(),
            onOpen: () => onOpenRef.current?.()
        });
        setCtrl(_ctrl);
        return () => {
            _ctrl.tryClose();
        }
    }, [anchor, blockPageScroll, closeOnClick, closeOnEsc, root]);

    useEffect(() => {
        if (ctrlRef) {
            ctrlRef.current = ctrl;
        }
    }, [ctrl, ctrlRef]);

    // effect to open / close the popup
    useEffect(() => {
        if (ctrl && popupRef.current) {
            if (ctrl.isOpen !== isOpen) {
                if (isOpen) {
                    ctrl.open(popupRef.current, constraints);
                } else {
                    ctrl.close();
                }
            }
        } else if (ctrl?.isOpen && !isOpen) {
            // close the popup - happens when isOpen becomes false but the ctrl is still open
            // and the popupRef was destroyed by the isOpen && below
            ctrl.close();
        }
    }, [constraints, isOpen, ctrl]);

    return (
        <PopupContext.Provider value={ctrl}>
            {isOpen && createPortal(
                <div id={id} style={{
                    //display: isOpen ? 'block' : 'none',
                    visibility: 'hidden',
                    position: position || 'absolute',
                    zIndex: zIndex || 100,
                }} ref={popupRef} className={className}>
                    {children}
                </div>,
                document.body
            )}
        </PopupContext.Provider>
    )
}

export interface PopupProps extends Omit<DOMPopupProps, 'anchor' | 'root'> {
    anchor: React.RefObject<HTMLElement | null | undefined>;
    root?: React.RefObject<HTMLElement | null | undefined>;
}
export function Popup({ anchor, root, children, ...others }: PopupProps) {
    return anchor.current && (!root || root.current) ? (
        // biome-ignore lint/style/noNonNullAssertion: intentional non-null assertion; TS can't prove narrowing here
        <DOMPopup anchor={anchor.current!} root={root?.current || undefined} {...others}>
            {children}
        </DOMPopup>
    ) : null;
}
