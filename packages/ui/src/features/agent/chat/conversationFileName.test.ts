import { describe, expect, it } from 'vitest';
import { conversationFileArtifactPath, conversationFileName } from './conversationFileName';

describe('conversationFileName', () => {
    it('stores a macOS screenshot name with plain spaces', () => {
        expect(conversationFileName('Screenshot 2026-11-13 at 8.25.40 AM.png')).toBe(
            'Screenshot 2026-11-13 at 8.25.40 AM.png',
        );
        expect(conversationFileArtifactPath('a b c.txt')).toBe('files/a b c.txt');
    });

    it('keeps other names unchanged', () => {
        expect(conversationFileName('Résumé 2026 — final.pdf')).toBe('Résumé 2026 — final.pdf');
        expect(conversationFileArtifactPath('report.docx')).toBe('files/report.docx');
    });
});
