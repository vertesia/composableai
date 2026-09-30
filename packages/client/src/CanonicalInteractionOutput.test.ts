import { createConversationDocument } from '@llumiverse/conversation';
import {
    type ConversationAcceptedOutputFragment,
    ExecutionRunStatus,
    type ExperimentalCanonicalInteractionExecutionResult,
    RunDataStorageLevel,
} from '@vertesia/common';
import { describe, expect, it } from 'vitest';
import {
    CanonicalInteractionOutput,
    canonicalReference,
    enhanceExperimentalCanonicalInteractionExecutionResult,
    referenceInitialState,
} from './CanonicalInteractionOutput.js';

const recordedAt = '2026-09-30T00:00:00.000Z';

function fragment(): ConversationAcceptedOutputFragment {
    const imageAsset: ConversationAcceptedOutputFragment['assets'][string] = {
        id: 'constructor',
        kind: 'image',
        mime_type: 'image/png',
        storage: { type: 'inline_base64', data: 'AAAA' },
        provenance: { type: 'generated', generation_id: 'generation-1', source_turn_id: 'turn-1' },
        created_at: recordedAt,
    };
    const assets: ConversationAcceptedOutputFragment['assets'] = Object.fromEntries([[imageAsset.id, imageAsset]]);
    return {
        format: 'llumiverse.conversation-output',
        schema_version: 0,
        experimental_revision: '2026-09-30.adoption.1',
        source: { conversation_id: 'conversation-1', revision: 1 },
        receipt: {
            id: 'response-1',
            conversation_id: 'conversation-1',
            base_revision: 0,
            result_revision: 1,
            recorded_at: recordedAt,
            accepted_turn_ids: ['turn-1'],
            accepted_generation_ids: ['generation-1'],
            accepted_asset_ids: ['constructor'],
        },
        turn: {
            id: 'turn-1',
            kind: 'agent',
            authority: 'ordinary',
            blocks: [
                { id: 'text-1', type: 'text', text: 'Answer', format: 'plain' },
                { id: 'reasoning-1', type: 'reasoning', text: 'Summary', representation: 'summary' },
                { id: 'json-1', type: 'json', value: { accepted: true } },
                { id: 'image-1', type: 'image', asset_id: 'constructor' },
                {
                    id: 'tool-1',
                    type: 'tool_call',
                    call_id: 'call-1',
                    tool_name: 'lookup',
                    executor: 'application',
                    arguments: { type: 'json', value: { id: 1 } },
                },
            ],
            status: 'completed',
            timestamps: { recorded_at: recordedAt, completed_at: recordedAt },
            provenance: { type: 'generated' },
            model_visibility: 'include',
            generation_id: 'generation-1',
        },
        generation: {
            id: 'generation-1',
            record_source: 'executed',
            request_id: 'request-1',
            attempt_id: 'attempt-1',
            purpose: 'interaction',
            requested_model: 'model-1',
            provider: 'provider-1',
            protocol: 'provider.protocol',
            adapter_version: 'adapter-1',
            status: 'completed',
            timestamps: { recorded_at: recordedAt, completed_at: recordedAt },
            source: { conversation_id: 'conversation-1', revision: 0 },
        },
        assets,
        completeness: {
            history: 'omitted',
            native_replay: 'omitted',
            metadata: 'omitted',
            semantic_content: 'complete',
            omitted_block_ids: [],
            omitted_asset_ids: [],
        },
    };
}

function result(output: ConversationAcceptedOutputFragment): ExperimentalCanonicalInteractionExecutionResult {
    return {
        run: {
            id: 'run-1',
            status: ExecutionRunStatus.completed,
            created_at: recordedAt,
            updated_at: recordedAt,
            retention: RunDataStorageLevel.STANDARD,
        },
        output: { status: 'accepted', fragment: output },
        history: {
            status: 'unavailable',
            reason: 'retention_policy',
            retention: RunDataStorageLevel.STANDARD,
        },
    };
}

describe('CanonicalInteractionOutput', () => {
    it('reads canonical semantic blocks and assets directly', () => {
        const source = fragment();
        const output = new CanonicalInteractionOutput<{ accepted: boolean }>(source);

        expect(output.text()).toBe('Answer');
        expect(output.reasoning()).toBe('Summary');
        expect(output.object()).toEqual({ accepted: true });
        expect(output.toolCalls().map((block) => block.call_id)).toEqual(['call-1']);
        expect(output.images()[0]).toMatchObject({
            block: { id: 'image-1', asset_id: 'constructor' },
            asset: { id: 'constructor', kind: 'image' },
        });
        source.turn.blocks[0] = { id: 'changed', type: 'text', text: 'changed', format: 'plain' };
        expect(output.text()).toBe('Answer');
    });

    it('validates and clones accepted wire fragments while enhancing the result', () => {
        const enhanced = enhanceExperimentalCanonicalInteractionExecutionResult(result(fragment()));
        expect(enhanced.canonicalOutput?.text()).toBe('Answer');
        expect(enhanced.output.status).toBe('accepted');

        const invalid = fragment();
        invalid.source.revision = 2;
        expect(() => enhanceExperimentalCanonicalInteractionExecutionResult(result(invalid))).toThrow(
            'inconsistent canonical references',
        );
    });

    it('builds a continuation from coherent DEBUG reference or document history', () => {
        const referenced = result(fragment());
        referenced.run.retention = RunDataStorageLevel.DEBUG;
        referenced.history = {
            status: 'reference',
            reference: {
                run_id: referenced.run.id,
                conversation: { conversation_id: 'conversation-1', revision: 1 },
            },
        };

        const reference = canonicalReference(referenced);
        expect(reference).toEqual(referenced.history.reference);
        expect(reference).not.toBe(referenced.history.reference);
        expect(referenceInitialState(referenced, 'handoff:1')).toEqual({
            type: 'reference',
            operation_id: 'handoff:1',
            reference,
        });

        const reloaded = result(fragment());
        reloaded.run.retention = RunDataStorageLevel.DEBUG;
        reloaded.history = {
            status: 'document',
            conversation: createConversationDocument({ id: 'conversation-reloaded', created_at: recordedAt }),
        };
        expect(referenceInitialState(reloaded, 'handoff:2')).toEqual({
            type: 'reference',
            operation_id: 'handoff:2',
            reference: {
                run_id: reloaded.run.id,
                conversation: { conversation_id: 'conversation-reloaded', revision: 0 },
            },
        });

        const incoherent = result(fragment());
        incoherent.run.retention = RunDataStorageLevel.DEBUG;
        incoherent.history = {
            status: 'reference',
            reference: {
                run_id: 'different-run',
                conversation: { conversation_id: 'conversation-1', revision: 1 },
            },
        };
        expect(() => canonicalReference(incoherent)).toThrow('does not match the result run');
        expect(() => canonicalReference(result(fragment()))).toThrow('does not contain DEBUG-retained history');
    });
});
