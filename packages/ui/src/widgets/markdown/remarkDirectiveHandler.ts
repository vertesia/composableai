/**
 * Custom remark plugin that transforms remark-directive nodes into
 * HTML elements for columns layout and callout containers.
 *
 * Supported directives:
 *   :::columns          → <div class="md-columns">
 *   :::column{width=50%}→ <div class="md-column" style="width:50%">
 *   :::note / :::warning / :::tip / :::caution / :::important → callout <div>s
 *   :::name             → <div class="md-name"> (generic fallback)
 */
import { visit, type VisitorResult } from 'unist-util-visit';

// Callout types mapped to CSS modifier classes (semantic design system)
const CALLOUT_TYPES: Record<string, string> = {
    note: 'md-callout-info',
    tip: 'md-callout-info',
    warning: 'md-callout-attention',
    important: 'md-callout-attention',
    caution: 'md-callout-destructive',
};

const CALLOUT_LABELS: Record<string, string> = {
    note: 'Note',
    tip: 'Tip',
    warning: 'Warning',
    important: 'Important',
    caution: 'Caution',
};

interface DirectiveNode {
    type: string;
    name: string;
    attributes?: Record<string, string>;
    data?: {
        hName?: string;
        hProperties?: Record<string, unknown>;
    };
    children?: DirectiveNode[];
}

export function remarkDirectiveHandler() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (tree: any) => {
        visit(tree, (node): VisitorResult => {
            if (
                node.type !== 'containerDirective' &&
                node.type !== 'leafDirective' &&
                node.type !== 'textDirective'
            ) {
                return;
            }

            const d = node as unknown as DirectiveNode;
            const data = d.data || (d.data = {});
            const attrs = d.attributes || {};
            const name = d.name;

            // ::pagebreak / :::pagebreak → visual page break indicator
            if (name === 'pagebreak') {
                data.hName = 'hr';
                data.hProperties = { className: 'md-pagebreak' };
                return;
            }

            // :::columns → flex container
            if (name === 'columns') {
                data.hName = 'div';
                data.hProperties = { className: 'md-columns' };
                return;
            }

            // :::column{width=50%} → flex child with optional width
            if (name === 'column') {
                data.hName = 'div';
                const props: Record<string, unknown> = { className: 'md-column' };
                if (attrs.width) {
                    props.style = `flex-basis:${attrs.width};flex-grow:0;flex-shrink:0`;
                }
                data.hProperties = props;
                return;
            }

            // Callout types
            if (name in CALLOUT_TYPES) {
                data.hName = 'div';
                data.hProperties = {
                    className: `md-callout ${CALLOUT_TYPES[name]}`,
                    'data-callout-type': name,
                };
                // Prepend a title paragraph
                const label = CALLOUT_LABELS[name];
                if (label && d.children) {
                    const titleNode = {
                        type: 'paragraph',
                        data: {
                            hName: 'p',
                            hProperties: { className: 'md-callout-title' },
                        },
                        children: [{ type: 'text', value: label }],
                    };
                    d.children.unshift(titleNode as unknown as DirectiveNode);
                }
                return;
            }

            // Generic fallback: :::name → <div class="md-name">
            data.hName = 'div';
            data.hProperties = {
                className: `md-${name}`,
                ...Object.fromEntries(
                    Object.entries(attrs).filter(([k]) => k !== 'class'),
                ),
            };
            if (attrs.class) {
                data.hProperties.className += ` ${attrs.class}`;
            }
        });
    };
}
