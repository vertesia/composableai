import { computePosition, Constraints, Position } from "./position";
import { computeVisibleClientRect, getScrollableParents } from "./utils";


export interface PopupControllerOptions {
    /**
     * The element to use as the anchor for the popup.
     */
    anchor: HTMLElement;
    closeOnClick?: boolean;
    closeOnEsc?: boolean;
    blockPageScroll?: boolean;
    onClose?: (ctrl: PopupController) => void;
    onOpen?: (ctrl: PopupController) => void;
    root?: HTMLElement;
}

interface PopupControllerContext {
    element: HTMLElement;
    constraints: Constraints;
    /**
     * The computed position details
     */
    position?: Position;
    cleanup: () => void;
}

export class PopupController {
    root: HTMLElement;
    scrollableParents: HTMLElement[];
    visibleClientRect: DOMRect | null;
    context?: PopupControllerContext;

    constructor(public options: PopupControllerOptions) {
        this.root = options.root || document.documentElement;
        this.scrollableParents = getScrollableParents(this.anchor, this.root);
        this.visibleClientRect = computeVisibleClientRect(this.scrollableParents);
    }

    get anchor() {
        return this.options.anchor;
    }

    private registerListeners(element: HTMLElement) {
        const parents = this.scrollableParents;
        const updateHandler = () => {
            this.update();
        }
        // add a window resize listener
        window.addEventListener('resize', updateHandler);

        //TODO do we add scroll listeners to the window?

        // add scroll listeners to all scrollable parents
        for (const parent of parents) {
            parent.addEventListener('scroll', updateHandler);
        }

        let closeOnClick: ((ev: MouseEvent) => void) | undefined;
        if (this.options.closeOnClick) {
            closeOnClick = (ev: MouseEvent) => {
                if (!element.contains(ev.target as HTMLElement)) {
                    this.tryClose();
                }
            }
            // register in the next event loop cycle since the current one
            // is may be triggered by a click event
            window.setTimeout(function () {
                closeOnClick && document.addEventListener('click', closeOnClick);
            }, 0);
        }
        let closeOnEsc: ((ev: KeyboardEvent) => void) | undefined;
        if (this.options.closeOnEsc) {
            closeOnEsc = (ev: KeyboardEvent) => {
                if (ev.key === 'Escape') {
                    this.tryClose();
                }
            }
            window.setTimeout(function () {
                closeOnEsc && document.addEventListener('keydown', closeOnEsc);
            }, 0);
        }
        const blockPageScroll = this.options.blockPageScroll;
        if (blockPageScroll) {
            document.body.style.overflow = "hidden";
            document.body.style.height = "100%";
        }
        return () => {
            window.removeEventListener('resize', updateHandler);
            for (const parent of parents) {
                parent.removeEventListener('scroll', updateHandler);
            }
            closeOnClick && document.removeEventListener('click', closeOnClick);
            closeOnEsc && document.removeEventListener('keydown', closeOnEsc);
            if (blockPageScroll) {
                document.body.style.overflow = "";
                document.body.style.height = "";
            }
        }
    }

    open(element: HTMLElement, constraints: Constraints) {
        if (this.context) {
            throw new Error("The popup controller is already bound to an element");
        }
        this.tryOpen(element, constraints);
    }
    tryOpen(element: HTMLElement, constraints: Constraints) {
        if (this.context) {
            return; // do nothing if the popup is already open
        }
        this.context = {
            element,
            constraints,
            cleanup: this.registerListeners(element)
        }

        element.style.display = "";
        element.style.visibility = "hidden";
        // update the popup position
        this.update();
        this.options.onOpen && this.options.onOpen(this);
    }

    close() {
        if (!this.context) {
            throw new Error("The popup controller is not bound to an element");
        }
        this.tryClose();
    }
    tryClose() {
        if (!this.context) {
            return; // do nothing if the popup is not open
        }
        this.options.onClose && this.options.onClose(this);
        this.context.cleanup();
        //TODO
        this.context.element.style.display = "none";
        this.context = undefined;
    }

    get isOpen() {
        return !!this.context;
    }

    update() {
        if (!this.context) return; // do nothing if the popup is not open
        // update the position of the popup
        const element = this.context.element;
        const constraints = this.context.constraints;
        const elemRect = element.getBoundingClientRect();
        const anchorRect = this.anchor.getBoundingClientRect();
        const clientRect = this.visibleClientRect;
        if (!clientRect) {
            // the popup is not visible
            return;
        }
        const position = computePosition(constraints, elemRect, anchorRect, clientRect);
        this.context.position = position || undefined;
        if (position) {
            if (position.constrainHeight) {
                element.style.height = position.rect.height + 'px';
            }
            if (position.constrainWidth) {
                element.style.width = position.rect.width + 'px';
            }
            element.style.left = position.rect.left + 'px';
            element.style.top = position.rect.top + 'px';
            element.style.visibility = "visible";
        }
    }

    createPopupElement() {
        const popup = document.createElement('div');
        popup.style.margin = "0";
        popup.style.padding = "0";
        popup.style.border = "none";
        popup.style.background = "transparent";
        popup.className = "composable-Popup";
        return popup;
    }
}