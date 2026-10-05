import type { AgentMessage, ExperimentalAgentDocumentEditingAction } from '@vertesia/common';
import {
    parseExperimentalAgentDocumentEditingAction,
    parseExperimentalAgentUserInputMetadata,
} from '@vertesia/common/canonical-stream-runtime';

/** UI-owned unaccepted authoring only. Never populated from a legacy accepted QUESTION/ANSWER. */
export interface CanonicalPendingUserInput {
    client_message_id: string;
    text: string;
    editing_action?: ExperimentalAgentDocumentEditingAction;
}
export function canonicalPendingUserInputs(
    messages: readonly AgentMessage[],
    workstreamId?: string,
): CanonicalPendingUserInput[] {
    return messages.flatMap((message) => {
        if (!message.details?._optimistic || message.workstream_id !== workstreamId) return [];
        const id = message.details._messageId;
        if (typeof id !== 'string' || !id) return [];
        let editingAction: ExperimentalAgentDocumentEditingAction | undefined;
        if (message.details.editing_action !== undefined) {
            try {
                editingAction = parseExperimentalAgentDocumentEditingAction(message.details.editing_action);
            } catch (error: unknown) {
                if (!(error instanceof TypeError)) throw error;
            }
        }
        return [
            {
                client_message_id: id,
                text: message.message,
                ...(editingAction ? { editing_action: editingAction } : {}),
            },
        ];
    });
}

/** Generic shared transcript metadata is rendered only when it satisfies the host's published typed view. */
export function canonicalUserMetadata(value: unknown) {
    if (value === undefined) return undefined;
    try {
        return parseExperimentalAgentUserInputMetadata(value);
    } catch (error: unknown) {
        if (!(error instanceof TypeError)) throw error;
        return undefined;
    }
}
