import type { ContentObject } from '@vertesia/common';
import { describe, expect, it } from 'vitest';
import { getTextPanelSource } from './textPanelSource.js';

function contentObject(type: string, name: string, metadata?: unknown): ContentObject {
    return {
        id: 'obj-id',
        name,
        content: { source: `gs://bucket/${name}`, type, name },
        metadata,
    } as unknown as ContentObject;
}

describe('getTextPanelSource', () => {
    it.each([
        ['image/png', 'photo.png'],
        ['application/pdf', 'report.pdf'],
        ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'memo.docx'],
    ])('renders the extracted text of %s content as markdown, not the binary', (type, name) => {
        const text = '- **Description:** A plain description';
        const source = getTextPanelSource(contentObject(type, name), text);

        expect(source.contentType).toBe('text/markdown');
        expect(source.content).toBe(text);
        expect(source.sourcePath).toBeUndefined();
    });

    it('keeps the content type and source of textual content', () => {
        const source = getTextPanelSource(contentObject('application/json', 'data.json'), '{"a":1}');

        expect(source.contentType).toBe('application/json');
        expect(source.sourcePath).toBe('gs://bucket/data.json');
    });

    it('renders plain text and markdown content as markdown', () => {
        expect(getTextPanelSource(contentObject('text/plain', 'notes.txt'), 'notes').contentType).toBe('text/markdown');
    });

    it('renders XML content as XML', () => {
        const source = getTextPanelSource(
            contentObject('application/octet-stream', 'feed', { content_processor: { type: 'xml' } }),
            '<a/>',
        );

        expect(source.contentType).toBe('text/xml');
        expect(source.sourcePath).toBe('gs://bucket/feed');
    });
});
