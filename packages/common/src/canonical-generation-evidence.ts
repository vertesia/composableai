import type {
    CanonicalContinuationState,
    CanonicalScopedGenerationEvidence,
    ConversationAcceptedGenerationEvidence,
} from './interaction.js';

function invalidEvidence(message: string): never {
    throw new TypeError(`Canonical accepted-generation evidence ${message}`);
}

/**
 * Verify the cross-record identity that JSON Schema cannot express for a standalone accepted
 * generation. The receipt identifies the exact accepted operation; the generation must be the
 * executed record created from that operation's base revision.
 */
export function assertConversationAcceptedGenerationEvidence(evidence: ConversationAcceptedGenerationEvidence): void {
    const { receipt, generation } = evidence;
    if (
        receipt.result_revision !== receipt.base_revision + 1 ||
        receipt.accepted_generation_ids.length !== 1 ||
        receipt.accepted_generation_ids[0] !== generation.id ||
        generation.record_source !== 'executed' ||
        generation.source.conversation_id !== receipt.conversation_id ||
        generation.source.revision !== receipt.base_revision
    ) {
        invalidEvidence('has inconsistent receipt and generation references');
    }
}

/** Verify one accepted generation against the explicit canonical agent-run head and scope. */
export function assertCanonicalScopedGenerationEvidence(
    evidence: CanonicalScopedGenerationEvidence,
    canonicalState: CanonicalContinuationState,
): void {
    assertConversationAcceptedGenerationEvidence(evidence);
    if (
        evidence.scope !== canonicalState.scope ||
        evidence.receipt.conversation_id !== canonicalState.head.conversation_id ||
        evidence.receipt.result_revision > canonicalState.head.revision
    ) {
        invalidEvidence('does not match its canonical agent-run head and scope');
    }
}
