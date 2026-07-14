import { describe, expect, it } from 'vitest';
import { diffWordSegments, type TextDiffSegment } from './textDiff.js';

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
