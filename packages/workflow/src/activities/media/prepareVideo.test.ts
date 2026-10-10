import { describe, expect, it } from 'vitest';
import { resolveVideoPreset, screenshotTimestamp, shouldTranscodeVideo } from './prepareVideo.js';

describe('screenshotTimestamp', () => {
    it.each([0.1, 0.5, 1])('extracts the first frame of a %s-second clip', (duration) => {
        expect(screenshotTimestamp(duration, 0.25)).toBe(0);
        expect(screenshotTimestamp(duration, 0.05, 2)).toBe(0);
    });

    it('keeps seeks inside short clips and preserves positions for longer clips', () => {
        expect(screenshotTimestamp(1.2, 0.25)).toBe(0.6);
        expect(screenshotTimestamp(10, 0.25)).toBe(2.5);
        expect(screenshotTimestamp(100, 0.05, 2)).toBe(2);
    });
});

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
