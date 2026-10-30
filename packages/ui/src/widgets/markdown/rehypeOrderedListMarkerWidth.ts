/**
 * Records on every `<ol>` how many digits its widest marker has, as the `--ol-marker-digits` custom
 * property. `.vprose` sizes the list's start padding from it, so a list running to "10." or "100."
 * leaves room for its numbers instead of clipping the leading digit.
 */
import type { Element, Root } from 'hast';
import { visit } from 'unist-util-visit';

/** Numbers past this are sized as if they were this one, so absurd `start` values cannot blow out the indent. */
const MAX_SIZED_MARKER = 10000;

export function getOrderedListMarkerDigits(start: number, itemCount: number): number {
    const highest = start + Math.max(itemCount, 1) - 1;
    const sized = Math.min(Math.max(Math.abs(highest), Math.abs(start), 1), MAX_SIZED_MARKER);
    return String(sized).length;
}

export function rehypeOrderedListMarkerWidth() {
    return (tree: Root) => {
        visit(tree, 'element', (node: Element) => {
            if (node.tagName !== 'ol') return;
            const start = Number(node.properties.start ?? 1);
            const itemCount = node.children.filter(
                (child) => child.type === 'element' && child.tagName === 'li',
            ).length;
            const digits = getOrderedListMarkerDigits(Number.isFinite(start) ? start : 1, itemCount);
            const style = typeof node.properties.style === 'string' ? node.properties.style.trim() : '';
            const separator = style && !style.endsWith(';') ? '; ' : style ? ' ' : '';
            node.properties.style = `${style}${separator}--ol-marker-digits: ${digits}`;
        });
    };
}
