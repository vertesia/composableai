import { describe, expect, it } from 'vitest';
import { getUploadMimeTypeHint, resolveUploadMimeType } from './uploadMimeType.js';

describe('upload MIME type resolution', () => {
    it('keeps a specific browser-provided content type', () => {
        expect(getUploadMimeTypeHint('text/plain')).toBe('text/plain');
        expect(resolveUploadMimeType('text/plain', 'text/markdown')).toBe('text/plain');
    });

    it('uses filename inference when the browser reports generic binary content', () => {
        expect(getUploadMimeTypeHint('application/octet-stream')).toBeUndefined();
        expect(resolveUploadMimeType('application/octet-stream', 'text/markdown')).toBe('text/markdown');
    });

    it('uses filename inference when the browser omits the content type', () => {
        expect(resolveUploadMimeType('', 'text/markdown')).toBe('text/markdown');
    });

    it('retains octet-stream when no more specific type can be inferred', () => {
        expect(resolveUploadMimeType('application/octet-stream', undefined)).toBe('application/octet-stream');
    });
});
