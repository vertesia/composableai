import { describe, expect, it, vi } from 'vitest';
import {
    calculateThumbnailTimestamps,
    generateThumbnailsWithFallback,
    requireGeneratedThumbnails,
    resolveVideoDuration,
} from './generateVideoRendition.js';

describe('resolveVideoDuration', () => {
    it('prefers the video stream duration over a longer container duration', () => {
        expect(resolveVideoDuration('0.04', '11.971')).toBe(0.04);
    });

    it('falls back to a valid container duration', () => {
        expect(resolveVideoDuration(undefined, '11.971')).toBe(11.971);
    });

    it('rejects non-finite durations', () => {
        expect(resolveVideoDuration('Infinity', 'NaN')).toBe(0);
    });
});

describe('calculateThumbnailTimestamps', () => {
    it('keeps thumbnail seeks within a sub-second video', () => {
        const timestamps = calculateThumbnailTimestamps(0.5, 3);

        expect(timestamps).toHaveLength(3);
        expect(timestamps.every((timestamp) => timestamp > 0 && timestamp < 0.5)).toBe(true);
    });

    it('spaces thumbnails across the usable duration', () => {
        expect(calculateThumbnailTimestamps(100, 3)).toEqual([27.5, 50, 72.5]);
    });
});

describe('generateThumbnailsWithFallback', () => {
    it('retries the first frame when scheduled seeks produce no thumbnails', async () => {
        const generateAt = vi.fn((timestamp: number) =>
            Promise.resolve(timestamp === 0 ? '/tmp/first-frame.jpg' : undefined),
        );

        const thumbnails = await generateThumbnailsWithFallback([3.292, 5.986, 8.679], generateAt);

        expect(thumbnails).toEqual([undefined, undefined, undefined, '/tmp/first-frame.jpg']);
        expect(generateAt.mock.calls.map(([timestamp]) => timestamp)).toEqual([3.292, 5.986, 8.679, 0]);
    });

    it('does not generate a fallback when a scheduled seek succeeds', async () => {
        const generateAt = vi.fn((timestamp: number) => Promise.resolve(`/tmp/${timestamp}.jpg`));

        await generateThumbnailsWithFallback([1, 2], generateAt);

        expect(generateAt).toHaveBeenCalledTimes(2);
    });
});

describe('requireGeneratedThumbnails', () => {
    it('keeps successful thumbnails when some frame extractions fail', () => {
        expect(requireGeneratedThumbnails([undefined, '/tmp/one.jpg', undefined], 'video-id')).toEqual([
            '/tmp/one.jpg',
        ]);
    });

    it('fails permanently instead of reporting success when every extraction fails', () => {
        try {
            requireGeneratedThumbnails([undefined, undefined], 'video-id');
            throw new Error('Expected requireGeneratedThumbnails to throw');
        } catch (error) {
            expect(error).toMatchObject({
                message: 'No thumbnails were generated for video video-id',
                nonRetryable: true,
            });
        }
    });
});
