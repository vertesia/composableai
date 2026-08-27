import { type AgentMessage, AgentMessageType } from '@vertesia/common';
import { describe, expect, it } from 'vitest';
import { collectDeliveredArtifactRefs, parseUserMessageAttachments } from './AttachmentPreview';

function question(message: string, details?: AgentMessage['details']): AgentMessage {
    return {
        timestamp: 1_000,
        workflow_run_id: 'run-1',
        type: AgentMessageType.QUESTION,
        message,
        workstream_id: 'main',
        details,
    };
}

describe('parseUserMessageAttachments', () => {
    // Filenames with parentheses (browser download suffixes like "report (6).json") flow
    // verbatim into artifact hrefs. A first-closing-paren href capture made these lines fail
    // to parse: the file rendered as raw text and its chip outlived delivery because the
    // reference never reached collectDeliveredArtifactRefs.
    it('parses hrefs containing parentheses', () => {
        const parsed = parseUserMessageAttachments(
            'Look at this.\n\nUploaded artifacts:\n[report (6).json](artifact:files/report (6).json)',
        );

        expect(parsed.body).toBe('Look at this.');
        expect(parsed.attachments).toHaveLength(1);
        expect(parsed.attachments[0].name).toBe('report (6).json');
        expect(parsed.attachments[0].href).toBe('artifact:files/report (6).json');
        expect(parsed.attachments[0].artifactPath).toBe('files/report (6).json');
    });

    it('splits href from trailing note even when both contain parentheses', () => {
        const parsed = parseUserMessageAttachments(
            [
                'Attachments:',
                '- [scan (2).png](artifact:files/scan (2).png) (image - use view_image tool with path "files/scan (2).png" to see it)',
                '- [notes (v2).pdf](artifact:files/notes (v2).pdf) (text extracted to files/notes (v2).pdf.md)',
            ].join('\n'),
        );

        expect(parsed.attachments).toHaveLength(2);
        expect(parsed.attachments[0].href).toBe('artifact:files/scan (2).png');
        // The note still drives the image content-type heuristic.
        expect(parsed.attachments[0].contentType).toBe('image/*');
        expect(parsed.attachments[1].href).toBe('artifact:files/notes (v2).pdf');
        expect(parsed.attachments[1].contentType).toBeUndefined();
    });

    // Only the two note shapes the server formatter emits may split a line. Without that
    // check, a note-less filename carrying its own parens is cut at the last ") (", yielding
    // a truncated href whose reference never matches — the chip then outlives delivery.
    it('does not split a note-less filename that contains ") ("', () => {
        const parsed = parseUserMessageAttachments(
            'Uploaded artifacts:\n[a (b) (c).pdf](artifact:files/a (b) (c).pdf)',
        );

        expect(parsed.attachments).toHaveLength(1);
        expect(parsed.attachments[0].name).toBe('a (b) (c).pdf');
        expect(parsed.attachments[0].href).toBe('artifact:files/a (b) (c).pdf');
        expect(parsed.attachments[0].artifactPath).toBe('files/a (b) (c).pdf');
    });

    // The previous regex pair backtracked polynomially on lines packed with ") (" sequences
    // (CodeQL js/polynomial-redos). The scanner must stay linear and still pick the rightmost
    // note split — the same split the greedy regex produced.
    it('handles pathological paren-dense lines in linear time with the rightmost note split', () => {
        const hostile = `[a](${') ('.repeat(20_000)}x) (image - hostile)`;
        const started = performance.now();
        const parsed = parseUserMessageAttachments(`Uploaded artifacts:\n${hostile}`);
        expect(performance.now() - started).toBeLessThan(200);

        expect(parsed.attachments).toHaveLength(1);
        expect(parsed.attachments[0].href).toBe(`${') ('.repeat(20_000)}x`);
        expect(parsed.attachments[0].contentType).toBe('image/*');
    });

    // Every ") (" above is a candidate the scanner must reject (unknown note prefix) before
    // falling through to the whole-body href. That rejection path is the one a quadratic
    // implementation would blow up on, so it gets its own budget.
    it('stays linear when every note candidate is rejected', () => {
        const hostile = `[a](${') ('.repeat(20_000)}x)`;
        const started = performance.now();
        const parsed = parseUserMessageAttachments(`Uploaded artifacts:\n${hostile}`);
        expect(performance.now() - started).toBeLessThan(200);

        expect(parsed.attachments).toHaveLength(1);
        expect(parsed.attachments[0].href).toBe(`${') ('.repeat(20_000)}x`);
    });

    it('keeps parsing plain links and note-suffixed links without parentheses', () => {
        const parsed = parseUserMessageAttachments(
            [
                'Uploaded artifacts:',
                '[report.pdf](artifact:files/report.pdf)',
                '- [photo.png](artifact:files/photo.png) (image - use view_image tool with path "files/photo.png" to see it)',
            ].join('\n'),
        );

        expect(parsed.attachments.map((a) => a.href)).toEqual([
            'artifact:files/report.pdf',
            'artifact:files/photo.png',
        ]);
        expect(parsed.attachments[1].contentType).toBe('image/*');
    });
});

describe('collectDeliveredArtifactRefs', () => {
    it('collects references for filenames containing parentheses', () => {
        const refs = collectDeliveredArtifactRefs([
            question(
                '[Files Ready] All 1 file(s)...\n\nUploaded artifacts:\n[filaments-bundle (6).json](artifact:files/filaments-bundle (6).json)',
            ),
        ]);

        expect(refs).toEqual(new Set(['artifact:files/filaments-bundle (6).json', 'files/filaments-bundle (6).json']));
    });

    it('collects attachment references from persisted user messages', () => {
        const refs = collectDeliveredArtifactRefs([
            question('Review this.\n\nUploaded artifacts:\n[report.pdf](artifact:files/report.pdf)'),
        ]);

        expect(refs).toEqual(new Set(['artifact:files/report.pdf', 'files/report.pdf']));
    });

    it.each(['sending', 'received', 'consumed', 'failed'] as const)(
        'ignores optimistic messages with %s delivery status',
        (_deliveryStatus) => {
            const refs = collectDeliveredArtifactRefs([
                question('Review this.\n\nUploaded artifacts:\n[report.pdf](artifact:files/report.pdf)', {
                    _optimistic: true,
                    _deliveryStatus,
                }),
            ]);

            expect(refs).toEqual(new Set());
        },
    );
});
