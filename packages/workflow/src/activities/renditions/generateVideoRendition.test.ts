import { describe, expect, it } from 'vitest';
import { calculateThumbnailTimestamps, requireGeneratedThumbnails } from './generateVideoRendition.js';

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
