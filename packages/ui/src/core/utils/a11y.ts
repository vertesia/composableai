import type { KeyboardEvent } from "react";

/**
 * Returns an `onKeyDown` handler that fires the given callback when the user presses
 * Enter or Space. Use on non-button elements that have an `onClick` handler to satisfy
 * keyboard accessibility (pairs with `role="button"` and `tabIndex={0}`).
 *
 * @example
 *   <div
 *     role="button"
 *     tabIndex={0}
 *     onClick={handler}
 *     onKeyDown={onActivateKey(handler)}
 *   />
 */
export function onActivateKey<E extends Element>(callback: (event: KeyboardEvent<E>) => void) {
    return (event: KeyboardEvent<E>) => {
        if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            callback(event);
        }
    };
}
