import { type AgentMessage, AgentMessageType } from '@vertesia/common';
import { describe, expect, it } from 'vitest';
import { collectDeliveredArtifactRefs } from './AttachmentPreview';

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

describe('collectDeliveredArtifactRefs', () => {
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
