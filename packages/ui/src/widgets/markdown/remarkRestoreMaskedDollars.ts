/**
 * Undoes `maskMathDelimiters` after parsing.
 *
 * The mask becomes `$` again in text, link and image fields. Inside inline math, a masked `\$`
 * becomes `\text{\textdollar}`, matching what `preprocessMathDelimiters` feeds KaTeX.
 */
import { visit } from 'unist-util-visit';

type RemarkTree = Parameters<typeof visit>[0];

interface MaskableNode {
    type: string;
    value?: unknown;
    url?: unknown;
    title?: unknown;
    alt?: unknown;
    data?: { hChildren?: { type: string; value?: unknown }[] };
}

export interface RemarkRestoreMaskedDollarsOptions {
    /** The stand-in returned by `maskMathDelimiters` */
    mask: string;
}

const MASKABLE_FIELDS = ['value', 'url', 'title', 'alt'] as const;

export function remarkRestoreMaskedDollars({ mask }: RemarkRestoreMaskedDollarsOptions) {
    const maskedEscapedDollar = `\\${mask}`;
    return (tree: RemarkTree) => {
        visit(tree, (node) => {
            const maskable = node as MaskableNode;
            if (maskable.type === 'inlineMath') {
                if (typeof maskable.value !== 'string') return;
                const value = maskable.value.split(maskedEscapedDollar).join('\\text{\\textdollar}');
                maskable.value = value;
                // remark-math copies the value into the hast text child at parse time
                for (const child of maskable.data?.hChildren ?? []) {
                    if (child.type === 'text') child.value = value;
                }
                return;
            }
            for (const field of MASKABLE_FIELDS) {
                const value = maskable[field];
                if (typeof value === 'string') maskable[field] = value.split(mask).join('$');
            }
        });
    };
}
