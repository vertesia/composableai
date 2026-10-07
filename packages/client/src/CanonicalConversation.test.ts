import type { ConversationAgentTurn, ConversationDocumentV0, ConversationUserTurn } from '@vertesia/common';
import { describe, expect, it } from 'vitest';
import {
    selectLatestAgentTurn,
    selectLatestCompletedAgentBlocks,
    selectLatestCompletedAgentTurn,
} from './CanonicalConversation.js';

const timestamps = { recorded_at: '2026-01-01T00:00:00.000Z', completed_at: '2026-01-01T00:00:01.000Z' };

function userTurn(id: string): ConversationUserTurn {
    return {
        id,
        kind: 'user',
        authority: 'ordinary',
        model_visibility: 'include',
        status: 'completed',
        timestamps,
        provenance: { type: 'received' },
        blocks: [{ id: `${id}-text`, type: 'text', text: id, format: 'plain' }],
    };
}

function agentTurn(id: string, status: ConversationAgentTurn['status'] = 'completed'): ConversationAgentTurn {
    return {
        id,
        kind: 'agent',
        authority: 'ordinary',
        model_visibility: 'include',
        status,
        timestamps,
        provenance: { type: 'inserted' },
        blocks: [
            { id: `${id}-text`, type: 'text', text: id, format: 'markdown' },
            { id: `${id}-json`, type: 'json', value: { id } },
        ],
    };
}

function document(turns: ConversationDocumentV0['turns']): ConversationDocumentV0 {
    return {
        format: 'llumiverse.conversation',
        schema_version: 0,
        experimental_revision: '2026-09-30.adoption.1',
        id: 'conversation-1',
        revision: 1,
        created_at: timestamps.recorded_at,
        updated_at: timestamps.completed_at,
        turns,
        generations: {},
        operation_receipts: {},
        execution_receipts: {},
        assets: {},
        tool_definitions: {},
        context: {
            revision: 1,
            entries: [],
            active_tool_definition_ids: [],
            protected_entry_ids: [],
            retrieval_requirements: [],
        },
        compactions: {},
        processing: { enabled: false, policy_revision: 0, processors: [] },
    };
}

describe('canonical conversation selection', () => {
    it('returns only the latest completed agent response when generations are adjacent', () => {
        const first = agentTurn('agent-1');
        const second = agentTurn('agent-2');
        const latest = agentTurn('agent-3');
        const conversation = document([userTurn('user-1'), first, second, latest]);

        expect(selectLatestCompletedAgentTurn(conversation)?.id).toBe('agent-3');
        expect(selectLatestCompletedAgentBlocks(conversation).map((block) => block.id)).toEqual([
            'agent-3-text',
            'agent-3-json',
        ]);
    });

    it('does not mislabel an earlier response when the latest agent turn failed', () => {
        const completed = agentTurn('agent-completed');
        const conversation = document([userTurn('user-1'), completed, agentTurn('agent-failed', 'failed')]);

        expect(selectLatestCompletedAgentTurn(conversation)).toBeUndefined();
        expect(selectLatestCompletedAgentBlocks(conversation)).toEqual([]);
    });

    it('retains the status of a partial response without selecting older output', () => {
        const partial = agentTurn('partial', 'interrupted');
        const conversation = document([agentTurn('older'), partial]);
        expect(selectLatestAgentTurn(conversation)).toEqual(partial);
        expect(selectLatestCompletedAgentTurn(conversation)).toBeUndefined();
    });

    it('returns no blocks when no completed agent response exists', () => {
        expect(selectLatestCompletedAgentBlocks(document([userTurn('user-1')]))).toEqual([]);
    });
});
