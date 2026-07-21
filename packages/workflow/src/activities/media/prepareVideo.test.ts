import { describe, expect, it } from 'vitest';
import { resolveVideoPreset, shouldTranscodeVideo } from './prepareVideo.js';

describe('shouldTranscodeVideo', () => {
    it('transcodes by default', () => {
        expect(shouldTranscodeVideo()).toBe(true);
        expect(shouldTranscodeVideo(false)).toBe(true);
    });

    it('skips transcoding when explicitly requested', () => {
        expect(shouldTranscodeVideo(true)).toBe(false);
    });
});

describe('resolveVideoPreset', () => {
    it.each([
        { preset: 'medium', attempt: 1, expected: 'medium' },
        { preset: 'medium', attempt: 2, expected: 'fast' },
        { preset: 'medium', attempt: 3, expected: 'veryfast' },
        { preset: 'medium', attempt: 5, expected: 'veryfast' },
        { preset: 'fast', attempt: 1, expected: 'fast' },
        { preset: 'fast', attempt: 2, expected: 'veryfast' },
        { preset: 'ultrafast', attempt: 2, expected: 'ultrafast' },
    ] as const)('uses $expected for $preset on attempt $attempt', ({ preset, attempt, expected }) => {
        expect(resolveVideoPreset(preset, attempt)).toBe(expected);
    });
});
