/**
 * Undoes the length-preserving mode of `preprocessMathDelimiters` after parsing.
 *
 * `MASKED_DOLLAR` becomes `$` again in text, link and image fields. Inside inline math, the masked
 * `\$` becomes `\text{\textdollar}`, matching what the escaping mode feeds KaTeX.
 */
import { visit } from 'unist-util-visit';
import { MASKED_DOLLAR } from './preprocessMathDelimiters';

type RemarkTree = Parameters<typeof visit>[0];

interface MaskableNode {
    type: string;
    value?: unknown;
    url?: unknown;
    title?: unknown;
    alt?: unknown;
    data?: { hChildren?: { type: string; value?: unknown }[] };
}

const MASKED_DOLLAR_REGEX = new RegExp(MASKED_DOLLAR, 'g');
const MASKED_ESCAPED_DOLLAR_REGEX = new RegExp(`\\\\${MASKED_DOLLAR}`, 'g');
const MASKABLE_FIELDS = ['value', 'url', 'title', 'alt'] as const;

export function remarkRestoreMaskedDollars() {
    return (tree: RemarkTree) => {
        visit(tree, (node) => {
            const maskable = node as MaskableNode;
            if (maskable.type === 'inlineMath') {
                if (typeof maskable.value !== 'string') return;
                const value = maskable.value.replace(MASKED_ESCAPED_DOLLAR_REGEX, '\\text{\\textdollar}');
                maskable.value = value;
                // remark-math copies the value into the hast text child at parse time
                for (const child of maskable.data?.hChildren ?? []) {
                    if (child.type === 'text') child.value = value;
                }
                return;
            }
            for (const field of MASKABLE_FIELDS) {
                const value = maskable[field];
                if (typeof value === 'string') maskable[field] = value.replace(MASKED_DOLLAR_REGEX, '$');
            }
        });
    };
}
