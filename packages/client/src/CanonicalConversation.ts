import type { ConversationAgentContentBlock, ConversationAgentTurn, ConversationDocumentV0 } from '@vertesia/common';

/** Select the final turn when it is a model response, retaining its completion status. */
export function selectLatestAgentTurn(document: ConversationDocumentV0): ConversationAgentTurn | undefined {
    const turn = document.turns.at(-1);
    return turn?.kind === 'agent' ? turn : undefined;
}

/** Select the latest turn only when the canonical history ends in a completed model response. */
export function selectLatestCompletedAgentTurn(document: ConversationDocumentV0): ConversationAgentTurn | undefined {
    const turn = selectLatestAgentTurn(document);
    return turn?.status === 'completed' ? turn : undefined;
}

/** Select canonical blocks from the latest completed model response without legacy result conversion. */
export function selectLatestCompletedAgentBlocks(document: ConversationDocumentV0): ConversationAgentContentBlock[] {
    return selectLatestCompletedAgentTurn(document)?.blocks ?? [];
}
