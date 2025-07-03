
/**
 * Compute the intersection of the two given rects.
 * @param rect1
 * @param rect2
 * @returns
 */
export function intersectRects(rect1: DOMRect, rect2: DOMRect): DOMRect | null {
    const x1 = Math.max(rect1.left, rect2.left);
    const y1 = Math.max(rect1.top, rect2.top);
    const x2 = Math.min(rect1.right, rect2.right);
    const y2 = Math.min(rect1.bottom, rect2.bottom);

    if (x2 <= x1 || y2 <= y1) {
        return null; // No intersection
    }

    return new DOMRect(x1, y1, x2 - x1, y2 - y1);
}

/**
 * Compute the visible rectangle of the scrollable parents.
 * @param scrollableParents
 * @returns
 */
export function computeVisibleClientRect(scrollableParents: HTMLElement[]): DOMRect | null {
    if (scrollableParents.length === 0) return null;
    // Initialize the rect as the bounding rect of the first scrollable parent
    let rect: DOMRect | null = scrollableParents[0].getBoundingClientRect();
    // Iterate over the remaining scrollable parents to compute the intersection
    for (let i = 1, l = scrollableParents.length; i < l; i++) {
        const parentRect = scrollableParents[i].getBoundingClientRect();
        rect = intersectRects(parentRect, rect);
        // If there is no intersection, exit early
        if (!rect) {
            return null;
        }
    }
    return rect;
}

/**
 * Tests whether the given element is scrollable in any direction.
 * @param element
 * @returns
 */
export function isScrollable(element: HTMLElement): boolean {
    const hasScrollY = element.scrollHeight > element.clientHeight;
    const hasScrollX = element.scrollWidth > element.clientWidth;

    if (hasScrollY || hasScrollX) {
        const style = getComputedStyle(element);
        if ((hasScrollY && style.overflowY !== 'visible') || (hasScrollX && style.overflowX !== 'visible')) {
            return true;
        }
    }

    return false;
}

/**
 * Get the list of scrollable parents of the given element. The list always include the root parent at the end.
 * The root parent is either the document.documentElement or the given root element.
 * To iterate the list from top to down you need to iterate from the end to the start of the list,
 * since the root parent is always the last element and the nearest scrollable parent is the first element.
 * @param element
 * @param root
 * @returns
 */
export function getScrollableParents(element: HTMLElement, root: HTMLElement = document.documentElement): HTMLElement[] {
    const parents: HTMLElement[] = [];
    let parent = element.parentElement;

    while (parent && parent !== root) {
        isScrollable(parent) && parents.push(parent);
        parent = parent.parentElement;
    }

    // Always push the root element
    parents.push(root);
    return parents;
}
