import { describe, expect, it } from 'vitest';
import {
    createUnifiedLineDiff,
    diffTextSegments,
    diffWordSegments,
    getTextLineChangeRegions,
    rebaseTextChanges,
    type TextDiffSegment,
} from './textDiff.js';

function joinByTypes(segments: TextDiffSegment[], types: TextDiffSegment['type'][]): string {
    return segments
        .filter((segment) => types.includes(segment.type))
        .map((segment) => segment.text)
        .join('');
}

describe('diffWordSegments', () => {
    it('returns a single equal segment for identical texts', () => {
        expect(diffWordSegments('same text', 'same text')).toEqual([{ type: 'equal', text: 'same text' }]);
    });

    it('marks an appended sentence as added', () => {
        const before = 'Keep this paragraph unchanged.';
        const after = 'Keep this paragraph unchanged. Session edit A.';

        expect(diffWordSegments(before, after)).toEqual([
            { type: 'equal', text: 'Keep this paragraph unchanged.' },
            { type: 'added', text: ' Session edit A.' },
        ]);
    });

    it('marks a replaced word with a removal and an addition', () => {
        const segments = diffWordSegments('Keep the tone light.', 'Keep the tone formal.');

        expect(segments).toEqual([
            { type: 'equal', text: 'Keep the tone ' },
            { type: 'removed', text: 'light.' },
            { type: 'added', text: 'formal.' },
        ]);
    });

    it('reconstructs both sides from the segments across multiline edits', () => {
        const before = '- Preserve all sections.\n- Keep the tone light.\n- Ship it.';
        const after = '- Preserve all sections.\n- Keep the tone light and clear.\n- Log every revision.\n- Ship it.';
        const segments = diffWordSegments(before, after);

        expect(joinByTypes(segments, ['equal', 'removed'])).toBe(before);
        expect(joinByTypes(segments, ['equal', 'added'])).toBe(after);
    });

    it('handles a full replacement', () => {
        expect(diffWordSegments('old', 'new')).toEqual([
            { type: 'removed', text: 'old' },
            { type: 'added', text: 'new' },
        ]);
    });

    it('handles empty sides', () => {
        expect(diffWordSegments('', 'added')).toEqual([{ type: 'added', text: 'added' }]);
        expect(diffWordSegments('removed', '')).toEqual([{ type: 'removed', text: 'removed' }]);
        expect(diffWordSegments('', '')).toEqual([]);
    });
});

describe('diffTextSegments', () => {
    it('keeps unchanged lines aligned across a document-scale changed middle', () => {
        const preserved = Array.from({ length: 220 }, (_, index) => `Preserved line ${index}.`).join('\n');
        const before = `# Release notes\nOpening before.\n${preserved}\nClosing before.`;
        const after = `# Release notes\nOpening after.\n${preserved}\nClosing after.`;

        const segments = diffTextSegments(before, after);

        expect(joinByTypes(segments, ['equal', 'removed'])).toBe(before);
        expect(joinByTypes(segments, ['equal', 'added'])).toBe(after);
        expect(
            segments.some((segment) => segment.type === 'equal' && segment.text.includes('Preserved line 100.')),
        ).toBe(true);
    });

    it('returns distinct line regions separated by unchanged content', () => {
        expect(getTextLineChangeRegions('One\nTwo\nThree', 'One\nChanged\nThree\nFour')).toEqual([
            { startLine: 1, endLine: 1 },
            { startLine: 3, endLine: 3 },
        ]);
    });
});

describe('createUnifiedLineDiff', () => {
    const BEFORE = ['# Title', '', 'First paragraph.', '', '- one', '- two', '- three', '', 'Closing line.'].join('\n');

    it('returns undefined for identical texts', () => {
        expect(createUnifiedLineDiff(BEFORE, BEFORE)).toBeUndefined();
    });

    it('produces a hunk with context and correct markers for a line change', () => {
        const after = BEFORE.replace('- two', '- two (updated)');
        const diff = createUnifiedLineDiff(BEFORE, after, { context: 1 });
        expect(diff).toBe(['@@ -5,3 +5,3 @@', ' - one', '-- two', '+- two (updated)', ' - three'].join('\n'));
    });

    it('merges nearby changes into one hunk and separates distant ones', () => {
        const after = BEFORE.replace('# Title', '# New Title').replace('Closing line.', 'Closing line!');
        const diff = createUnifiedLineDiff(BEFORE, after, { context: 1 });
        const headers = diff?.split('\n').filter((line) => line.startsWith('@@'));
        expect(headers).toHaveLength(2);
    });

    it('handles pure insertions and deletions', () => {
        const inserted = createUnifiedLineDiff('a\nb', 'a\nnew\nb', { context: 0 });
        expect(inserted).toBe('@@ -2,0 +2,1 @@\n+new');
        const deleted = createUnifiedLineDiff('a\nold\nb', 'a\nb', { context: 0 });
        expect(deleted).toBe('@@ -2,1 +2,0 @@\n-old');
    });

    it('returns undefined when the diff exceeds maxChars', () => {
        const after = BEFORE.replace('First paragraph.', 'Rewritten paragraph.');
        expect(createUnifiedLineDiff(BEFORE, after, { maxChars: 10 })).toBeUndefined();
    });
});

describe('rebaseTextChanges', () => {
    const BASE = ['# Brief', '', 'Overview.', '', '## Goals', '- First', '- Second', '', 'Closing.'].join('\n');

    it('combines non-overlapping local and remote changes', () => {
        const local = BASE.replace('- Second', '- Second (local)');
        const remote = BASE.replace('Overview.', 'Overview updated remotely.');

        expect(rebaseTextChanges(BASE, local, remote)).toEqual({
            status: 'rebased',
            content: remote.replace('- Second', '- Second (local)'),
        });
    });

    it('returns the local version unchanged when the remote content did not change', () => {
        const local = BASE.replace('Closing.', 'Local closing.');
        expect(rebaseTextChanges(BASE, local, BASE)).toEqual({ status: 'rebased', content: local });
    });

    it('deduplicates an identical concurrent edit', () => {
        const changed = BASE.replace('- First', '- First (shared)');
        expect(rebaseTextChanges(BASE, changed, changed)).toEqual({ status: 'rebased', content: changed });
    });

    it('reports overlapping replacements as a conflict and preserves the local version', () => {
        const local = BASE.replace('Overview.', 'Local overview.');
        const remote = BASE.replace('Overview.', 'Remote overview.');
        expect(rebaseTextChanges(BASE, local, remote)).toEqual({ status: 'conflict', content: local });
    });

    it('treats competing insertions at the same base position as a conflict', () => {
        const local = BASE.replace('## Goals', 'Local note.\n\n## Goals');
        const remote = BASE.replace('## Goals', 'Remote note.\n\n## Goals');
        expect(rebaseTextChanges(BASE, local, remote)).toEqual({ status: 'conflict', content: local });
    });
});
