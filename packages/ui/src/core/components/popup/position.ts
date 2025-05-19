
export type PositionType = 'top' | 'right' | 'bottom' | 'left' | 'nw' | 'sw' | 'ne' | 'se';
export type AlignType = 'start' | 'center' | 'end' | 'fill';
export interface Constraints {
    position: PositionType;
    /**
     * The alignment of the target element relative to the anchor element and the position constraint.
     * The nw, ne, se, sw positions do not support any alignment. If any is given it will be ignored.
     */
    align?: AlignType;
    /**
     * A gap size between the anchor element and the target element.
     */
    gap?: number;
    /**
     * Whether the element should be displayed in a way that it covers the anchor element.
     * This modifier change the interpretation of the position and alignment
     */
    cover?: boolean;
    /**
     * the minimum width in pixels accepted to display the target element.
     * if the width contraint is not satisfied the element will be displayed in the opposite direction.
     */
    minWidth?: number;
    /**
     * the minimum height in pixels accepted to display the target element.
     * if the height contraint is not satisfied the element will be displayed in the opposite direction
     */
    minHeight?: number;
}

export interface Position {
    // the computer element rectangle
    rect: DOMRect;
    /**
     * If true then the element must use the computed width, otherwise it should preserve his current width
     */
    constrainWidth: boolean;
    /**
     * If true then the element must use the computed height, otherwise it should preserve his current height
     */
    constrainHeight: boolean;
    /**
     * The position constraints used to compute the position
     */
    position: PositionType;
    /**
     * The alignment constraints used to compute the position
     */
    align?: AlignType;
}

function flipPos(position: PositionType) {
    switch (position) {
        case "top": return "bottom";
        case "bottom": return "top";
        case "left": return "right";
        case "right": return "left";
        case "ne": return "sw";
        case "nw": return "se";
        case "se": return "nw";
        case "sw": return "ne";
        default: return position;
    }
}

function flipAlign(align: AlignType) {
    switch (align) {
        case "start": return "end";
        case "end": return "start";
        default: return align;
    }
}

class PositionResolver {
    /**
     * The computed left coordinate (i.e. x)
     */
    left?: number;
    /**
     * The computed top coordinate (i.e. y)
     */
    top?: number;
    /**
     * The computed width constraint. If undefined it means that the width is not constrained.
     */
    width?: number;
    /**
     * The computed height constraint. If undefined it means that the height is not constrained.
     */
    height?: number;
    /**
     * Alignment axis. The axis is computed from the position constraints.
     * If no axis is found - no alignment will be done
     */
    alignAxis?: 'x' | 'y';

    /**
     * A gap size between the anchor element and the target element.
     */
    gap: number;

    constructor(gap: number = 0) {
        this.gap = gap;
    }

    position(pos: PositionType, anchorRect: DOMRect, elemRect: DOMRect) {
        switch (pos) {
            case "top": {
                this.top = anchorRect.top - elemRect.height - this.gap;
                this.alignAxis = 'x';
                break;
            }
            case "bottom": {
                this.top = anchorRect.bottom + this.gap;
                this.alignAxis = 'x';
                break;
            }
            case "left": {
                this.left = anchorRect.left - elemRect.width - this.gap;
                this.alignAxis = 'y';
                break;
            }
            case "right": {
                this.left = anchorRect.right + this.gap;
                this.alignAxis = 'y';
                break;
            }
            case "ne": {
                this.top = anchorRect.top - elemRect.height - this.gap;
                this.left = anchorRect.right + this.gap;
                break;
            }
            case "nw": {
                this.top = anchorRect.top - elemRect.height - this.gap;
                this.left = anchorRect.left - elemRect.width - this.gap;
                break;
            }
            case "se": {
                this.top = anchorRect.bottom + this.gap;
                this.left = anchorRect.right + this.gap;
                break;
            }
            case "sw": {
                this.top = anchorRect.bottom + this.gap;
                this.left = anchorRect.left - elemRect.width - this.gap;
                break;
            }
        }
    }

    align(align: AlignType, anchorRect: DOMRect, elemRect: DOMRect) {
        if (!this.alignAxis) return; // no alignment axis
        switch (align) {
            case 'start': {
                if (this.alignAxis === 'x') {
                    this.left = anchorRect.left;
                } else {
                    this.top = anchorRect.top;
                }
                break;
            }
            case 'end': {
                if (this.alignAxis === 'x') {
                    this.left = anchorRect.right - elemRect.width;
                } else {
                    this.top = anchorRect.bottom - elemRect.height;
                }
                break;
            }
            case 'center': {
                // centering depend on the final value of the width / height
                if (this.alignAxis === 'x') {
                    this.left = anchorRect.left + anchorRect.width / 2 - elemRect.width / 2;
                } else {
                    this.top = anchorRect.top + anchorRect.height / 2 - elemRect.height / 2;
                }
                break;
            }
            case 'fill': {
                if (this.alignAxis === 'x') {
                    this.left = anchorRect.left;
                    this.width = anchorRect.right - anchorRect.left;
                } else {
                    this.top = anchorRect.top;
                    this.height = anchorRect.bottom - anchorRect.top;
                }
                break;
            }
        }
    }

    computePosition(constraints: Constraints, elemRect: DOMRect, anchorRect: DOMRect): Position {
        this.position(constraints.position, anchorRect, elemRect);
        constraints.align && this.align(constraints.align, anchorRect, elemRect);
        if (!this.left && !this.top) {
            throw new Error("Invalid position. Cannot compute x,y coordinates");
        }
        const constrainWidth = this.width != null;
        const constrainHeight = this.height != null;
        const width = constrainWidth ? this.width! : elemRect.width;
        const height = constrainHeight ? this.height! : elemRect.height;
        return {
            rect: new DOMRect(this.left!, this.top!, width, height),
            constrainWidth,
            constrainHeight,
            position: constraints.position,
            align: constraints.align
        }
    }

    flipAxis(constraints: Constraints, axis: 'x' | 'y'): Constraints | null {
        if (this.alignAxis === axis) { // flip alignment
            if (constraints.align) {
                const newAlign = flipAlign(constraints.align);
                if (newAlign !== constraints.align) {
                    return { ...constraints, align: newAlign };
                }
            }
        } else { // flip positioning
            const newPos = flipPos(constraints.position);
            if (newPos !== constraints.position) {
                return { ...constraints, position: newPos };
            }
        }
        return null; // nothing to do
    }

}
function isElementVisible(elemRect: DOMRect, clientRect: DOMRect) {
    return elemRect.left >= clientRect.left && elemRect.right <= clientRect.right
        &&
        elemRect.top >= clientRect.top && elemRect.bottom <= clientRect.bottom;
}

function isElementVisibleOnAxis(elemRect: DOMRect, clientRect: DOMRect, axis: 'x' | 'y') {
    if (axis === 'x') {
        return elemRect.left >= clientRect.left && elemRect.right <= clientRect.right;
    } else {
        return elemRect.top >= clientRect.top && elemRect.bottom <= clientRect.bottom;
    }
}


/**
 * Compute the position by trying to adjust the constraints until the computed position fits into the client area.
 * Returns the best position that fits the constraints.
 * @param constraints
 * @param elemRect
 * @param anchorRect
 * @param clientRect
 * @returns null if the element cannot be positioned otherwise returns a position object
 */
export function computePosition(constraints: Constraints, elemRect: DOMRect, anchorRect: DOMRect, clientRect: DOMRect): Position | null {
    const resolver = new PositionResolver(constraints.gap);
    let computedPos = resolver.computePosition(constraints, elemRect, anchorRect);
    const isVisibleOnXAxis = isElementVisibleOnAxis(computedPos.rect, clientRect, 'x');
    const isVisibleOnYAxis = isElementVisibleOnAxis(computedPos.rect, clientRect, 'y');
    if (isVisibleOnXAxis && isVisibleOnYAxis) {
        return computedPos; // the element is visible on both axis
    }
    let newConstraints: Constraints | null = null;
    if (!isVisibleOnXAxis) {
        newConstraints = resolver.flipAxis(constraints, 'x');
    }
    if (!isVisibleOnYAxis) {
        newConstraints = resolver.flipAxis(newConstraints || constraints, 'y');
    }
    if (!newConstraints) {
        return null; // cannot find a better position
    }
    computedPos = new PositionResolver(resolver.gap).computePosition(newConstraints, elemRect, anchorRect);
    if (isElementVisible(computedPos.rect, clientRect)) {
        return computedPos;
    }
    return null; // cannot find a better position
}