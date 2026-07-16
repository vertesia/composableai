import type { JSONContent } from '@tiptap/core';
import { describe, expect, it } from 'vitest';
import { createMarkdownEditor, isVertesiaWidgetLanguage, parseMarkdown, roundTripMarkdown } from './markdown.js';

const REPRESENTATIVE_DOCUMENT = `# Aurora launch brief

The **Aurora** release includes [the canonical document](store:6a56458923f5c40964a069e5),
an [artifact with spaces](<artifact:files/review copy.pdf>), and inline \`code\`.

![Architecture](<artifact:files/architecture v2.png> "Aurora architecture")

## Goals

- Cut review time by 60%.
- Preserve source-page provenance.
  - Keep stable anchors for comments.

| Tier | Pages | Support |
| :--- | ---: | :---: |
| Starter | 1,000 | Community |
| Scale | Unlimited | Dedicated |

> Review changes before publishing.

\`\`\`chart
{"$schema":"https://vega.github.io/schema/vega-lite/v6.json","mark":"bar","encoding":{}}
\`\`\`

\`\`\`mermaid
flowchart LR
    Draft --> Review --> Publish
\`\`\`

\`\`\`expand:table
files/pricing.csv
\`\`\`
`;

const OPAQUE_WIDGET_DOCUMENT = `# Layout and notation

:::columns
:::column{width=50%}
Left **column**.
:::
:::column{width=50%}
Right column.
:::
:::

$$
E = mc^2
$$

> [!NOTE]
> This alert must retain its Vertesia rendering semantics.
`;

const TASK_LIST_DOCUMENT = `# Release checklist

- [ ] Publish the migration guide
- [x] Verify the conformance suite
  - [ ] Run the browser smoke test
`;

function collectNodes(content: JSONContent, type: string): JSONContent[] {
    const matches: JSONContent[] = [];
    if (content.type === type) matches.push(content);
    for (const child of content.content || []) matches.push(...collectNodes(child, type));
    return matches;
}

describe('Vertesia Markdown conformance', () => {
    it('preserves the document structure through parse and serialize', () => {
        const parsed = parseMarkdown(REPRESENTATIVE_DOCUMENT);
        const serialized = roundTripMarkdown(REPRESENTATIVE_DOCUMENT);

        expect(parseMarkdown(serialized)).toEqual(parsed);
        expect(roundTripMarkdown(serialized)).toBe(serialized);
    });

    it('preserves custom links, artifact images, tables, and widget code blocks', () => {
        const parsed = parseMarkdown(REPRESENTATIVE_DOCUMENT);
        const serialized = roundTripMarkdown(REPRESENTATIVE_DOCUMENT);
        const codeBlocks = collectNodes(parsed, 'codeBlock');
        const images = collectNodes(parsed, 'image');
        const links = collectNodes(parsed, 'text').flatMap((node) => node.marks || []);

        expect(codeBlocks.map((node) => node.attrs?.language)).toEqual(['chart', 'mermaid', 'expand:table']);
        expect(images[0]?.attrs).toMatchObject({
            src: 'artifact:files/architecture v2.png',
            alt: 'Architecture',
            title: 'Aurora architecture',
        });
        expect(links.some((mark) => mark.attrs?.href === 'store:6a56458923f5c40964a069e5')).toBe(true);
        expect(links.some((mark) => mark.attrs?.href === 'artifact:files/review copy.pdf')).toBe(true);
        expect(collectNodes(parsed, 'table')).toHaveLength(1);
        expect(serialized).toContain('[artifact with spaces](<artifact:files/review copy.pdf>)');
        expect(serialized).toContain('![Architecture](<artifact:files/architecture v2.png> "Aurora architecture")');
    });

    it('keeps unsupported block widgets as exact opaque Markdown nodes', () => {
        const parsed = parseMarkdown(OPAQUE_WIDGET_DOCUMENT);
        const opaqueNodes = collectNodes(parsed, 'opaqueMarkdownBlock');
        const serialized = roundTripMarkdown(OPAQUE_WIDGET_DOCUMENT);

        expect(opaqueNodes.map((node) => node.attrs?.kind)).toEqual(['directive', 'display-math', 'github-alert']);
        for (const node of opaqueNodes) {
            expect(serialized).toContain(node.attrs?.raw);
        }
        expect(parseMarkdown(serialized)).toEqual(parsed);
        expect(roundTripMarkdown(serialized)).toBe(serialized);
    });

    it('preserves task lists as opaque Markdown until task editing is supported', () => {
        const parsed = parseMarkdown(TASK_LIST_DOCUMENT);
        const taskLists = collectNodes(parsed, 'opaqueMarkdownBlock').filter(
            (node) => node.attrs?.kind === 'task-list',
        );
        const serialized = roundTripMarkdown(TASK_LIST_DOCUMENT);

        expect(taskLists).toHaveLength(1);
        expect(taskLists[0]?.attrs?.raw).toContain('- [ ] Publish the migration guide');
        expect(serialized).toContain('- [x] Verify the conformance suite');
        expect(parseMarkdown(serialized)).toEqual(parsed);
    });

    it('registers node and mark views for every important Vertesia widget shape', () => {
        const editor = createMarkdownEditor({ content: REPRESENTATIVE_DOCUMENT, editable: false });
        try {
            const extensions = new Map(
                editor.extensionManager.extensions.map((extension) => [extension.name, extension]),
            );
            const hook = (extensionName: string, hookName: string): unknown => {
                const config = extensions.get(extensionName)?.config as Record<string, unknown> | undefined;
                return config?.[hookName];
            };

            expect(hook('codeBlock', 'addNodeView')).toBeTypeOf('function');
            expect(hook('image', 'addNodeView')).toBeTypeOf('function');
            expect(hook('link', 'addMarkView')).toBeTypeOf('function');
            expect(hook('opaqueMarkdownBlock', 'addNodeView')).toBeTypeOf('function');
        } finally {
            editor.destroy();
        }
    });

    it('classifies only renderable Vertesia code fences as widgets', () => {
        expect(isVertesiaWidgetLanguage('chart')).toBe(true);
        expect(isVertesiaWidgetLanguage('vega-lite')).toBe(true);
        expect(isVertesiaWidgetLanguage('mermaid')).toBe(true);
        expect(isVertesiaWidgetLanguage('mockup')).toBe(true);
        expect(isVertesiaWidgetLanguage('expand:fusion-fragment')).toBe(true);
        expect(isVertesiaWidgetLanguage('typescript')).toBe(false);
        expect(isVertesiaWidgetLanguage(undefined)).toBe(false);
    });
});
