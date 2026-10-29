import { describe, expect, it } from 'vitest';
import { canGenerateRendition, ImageRenditionFormat, isVideoContentType, MarkdownRenditionFormat } from './store.js';

describe('isVideoContentType', () => {
    it.each([
        ['video/mp4', true],
        ['video/quicktime', true],
        ['application/mxf', true],
        ['application/mp4', false],
        ['application/ogg', false],
        ['application/octet-stream', false],
        ['audio/mpeg', false],
        ['', false],
        [undefined, false],
    ])('%s is a video: %s', (contentType, expected) => {
        expect(isVideoContentType(contentType)).toBe(expected);
    });
});

describe('canGenerateRendition', () => {
    it('gives MXF the thumbnail formats of other videos, and nothing else', () => {
        expect(canGenerateRendition('application/mxf', ImageRenditionFormat.jpeg)).toBe(true);
        expect(canGenerateRendition('application/mxf', ImageRenditionFormat.png)).toBe(true);
        expect(canGenerateRendition('application/mxf', ImageRenditionFormat.webp)).toBe(false);
        expect(canGenerateRendition('application/mxf', MarkdownRenditionFormat.pdf)).toBe(false);
    });
});
