import { Editor } from '@tiptap/core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { richTextExtensions } from './extensions.js';

/**
 * Phase 0 de-risk spike (see plan: Collaborative Document Editing in the Agent Runner).
 *
 * Markdown is the single source of truth: the human edits in Tiptap, the agent edits
 * the canonical markdown with find/replace, and comments are anchored to text quotes.
 * All of that only holds if the Tiptap <-> markdown serialization has a STABLE canonical
 * form, i.e. once content has passed through the editor once, re-serializing it is a
 * fixed point. We do NOT require the editor's markdown to byte-match an agent's
 * hand-authored markdown; we require idempotence of the canonical form.
 *
 * Gate: serialize(parse(canonical)) === canonical  for every construct we support.
 *
 * Requires the composableai workspace to be installed (`pnpm install` inside composableai)
 * so @vertesia/tsconfig is linked; otherwise oxc cannot resolve the tsconfig `extends`.
 */

let editor: Editor;

/** The MarkdownManager built from the flattened extension list (parse + serialize). */
function markdown() {
    const manager = editor.markdown;
    if (!manager) throw new Error('Markdown manager is not registered on the editor');
    return manager;
}
/** Normalize once: the form the document takes after a single editor round-trip. */
function canonicalize(md: string): string {
    return markdown().serialize(markdown().parse(md));
}

beforeAll(() => {
    // Uses the same shared extension set as the production editor — the schema and the
    // markdown serializer must match, or unregistered constructs are dropped on serialize
    // (e.g. a GFM table with no TableKit serializes to an empty string).
    editor = new Editor({ extensions: richTextExtensions });
});
afterAll(() => {
    editor?.destroy();
});

// Representative of what an agent produces for a "plan"/"report" style document.
const CORPUS: Record<string, string> = {
    headings: ['# Implementation Plan', '', '## Phase 1', '', '### Details', '', 'A body paragraph.'].join('\n'),
    inlineMarks: 'This has **bold**, *italic*, ~~strike~~, and `inline code` in it.',
    bulletNested: ['- one', '- two', '    - nested a', '    - nested b', '- three'].join('\n'),
    orderedList: ['1. first', '2. second', '3. third'].join('\n'),
    codeFence: ['```ts', 'const x = 1;', 'console.log(x);', '```'].join('\n'),
    blockquote: ['> a quote', '> spanning two lines'].join('\n'),
    links: 'See [the docs](https://example.com/path) and [another](https://x.test) for details.',
    horizontalRule: ['Above the line.', '', '---', '', 'Below the line.'].join('\n'),
    longWrappedProse: [
        'Revenue grew twelve percent in the third quarter, driven primarily by expansion',
        'in the enterprise segment and a a reduction in churn across the mid-market cohort,',
        'though gross margin compressed slightly due to one-off infrastructure costs.',
    ].join(' '),
    mixedPlan: [
        '# Quarterly Report',
        '',
        'Revenue grew **12%** in Q3. Key drivers:',
        '',
        '- Enterprise expansion',
        '- Lower churn',
        '',
        '## Risks',
        '',
        '1. Margin compression',
        '2. Concentration risk',
        '',
        '> Note: figures are preliminary.',
        '',
        'See [the appendix](https://example.com/appendix).',
    ].join('\n'),
    // Constructs that likely need extra extensions beyond StarterKit — included to
    // surface exactly what's missing rather than assume.
    gfmTable: ['| Metric | Q2 | Q3 |', '| --- | --- | --- |', '| Revenue | 100 | 112 |', '| Churn | 5% | 4% |'].join(
        '\n',
    ),
    taskList: ['- [ ] draft the plan', '- [x] gather data'].join('\n'),
};

describe('markdown canonical form is idempotent', () => {
    it.each(Object.keys(CORPUS))('canonical(%s) is a fixed point', (name) => {
        const original = CORPUS[name];
        const canonical = canonicalize(original);
        const reCanonical = canonicalize(canonical);
        if (reCanonical !== canonical) {
            // Surface the drift for analysis.

            console.error(
                `\n[${name}] NOT idempotent:\n--- canonical ---\n${canonical}\n--- re-canonical ---\n${reCanonical}\n`,
            );
        }
        expect(reCanonical).toBe(canonical);
    });
});

describe('canonical form preserves content meaning (informational)', () => {
    it('logs canonical output for each corpus entry', () => {
        for (const name of Object.keys(CORPUS)) {
            const canonical = canonicalize(CORPUS[name]);

            console.info(`\n=== ${name} ===\n${canonical}`);
        }
        expect(true).toBe(true);
    });
});
