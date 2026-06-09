import { AgentMessageType } from '@vertesia/common';
import { describe, expect, it } from 'vitest';
import { processContentForMarkdown } from './processContentForMarkdown';

describe('processContentForMarkdown', () => {
    it('returns non-string content unchanged', () => {
        const obj = { a: 1 };
        expect(processContentForMarkdown(obj, AgentMessageType.ANSWER)).toBe(obj);
    });

    it('splits inline numbered lists for regular messages', () => {
        expect(processContentForMarkdown('1. First 2. Second', AgentMessageType.ANSWER)).toBe(
            '1. First\n\n2. Second\n\n',
        );
    });

    it('leaves content untouched when already multi-line', () => {
        const content = '1. First\n\n2. Second';
        expect(processContentForMarkdown(content, AgentMessageType.ANSWER)).toBe(content);
    });

    it('does not treat a bare number as a list item', () => {
        expect(processContentForMarkdown('see step 1.next', AgentMessageType.ANSWER)).toBe('see step 1.next');
    });

    it('converts inline dash bullets in thought messages', () => {
        expect(processContentForMarkdown('first - second - third', AgentMessageType.THOUGHT)).toBe(
            'first\n- second\n- third',
        );
    });

    // Regression guard for CodeQL js/polynomial-redos: anchoring the digit/whitespace
    // runs keeps these formatting heuristics linear on adversarial input.
    it('runs in linear time on pathological inputs', () => {
        const cases: [string | object, AgentMessageType][] = [
            ['0. x '.repeat(100_000), AgentMessageType.ANSWER],
            ['0. x '.repeat(100_000), AgentMessageType.THOUGHT],
            [`0.\t!${'!0.\t!'.repeat(100_000)}`, AgentMessageType.ANSWER],
            [`${' '.repeat(100_000)}- x`, AgentMessageType.THOUGHT],
            ['0'.repeat(100_000), AgentMessageType.ANSWER],
        ];
        for (const [content, type] of cases) {
            const start = performance.now();
            processContentForMarkdown(content, type);
            expect(performance.now() - start).toBeLessThan(2000);
        }
    });
});
