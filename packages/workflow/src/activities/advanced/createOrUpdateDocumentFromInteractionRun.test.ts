import { MockActivityEnvironment } from '@temporalio/testing';
import {
    type EnhancedExperimentalCanonicalInteractionExecutionResult,
    enhanceExperimentalCanonicalInteractionExecutionResult,
    type VertesiaClient,
} from '@vertesia/client';
import {
    ContentEventName,
    type ConversationAcceptedOutputFragment,
    type DSLActivityExecutionPayload,
    ExecutionRunStatus,
    type ExperimentalCanonicalInteractionExecutionResult,
    RunDataStorageLevel,
} from '@vertesia/common';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ActivityContext } from '../../dsl/setup/ActivityContext.js';
import { createOrUpdateDocumentFromInteractionRun } from './createOrUpdateDocumentFromInteractionRun.js';

vi.mock('../../dsl/setup/ActivityContext.js', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../../dsl/setup/ActivityContext.js')>();
    return { ...actual, setupActivity: vi.fn() };
});

let testEnv: MockActivityEnvironment;
let update: ReturnType<typeof vi.fn>;
let retrieve: ReturnType<typeof vi.fn>;
let retrieveCanonical: ReturnType<typeof vi.fn>;

beforeAll(() => {
    testEnv = new MockActivityEnvironment();
});

/**
 * `run.result` is the client's run-result wrapper: `object()` throws when the run produced prose
 * rather than JSON, and `text()` returns the raw completion.
 */
function runResult(json: unknown | undefined, text: string) {
    return {
        object: () => {
            if (json === undefined) {
                throw new Error('not valid JSON');
            }
            return json;
        },
        text: () => text,
    };
}

type ActivityResult = Awaited<ReturnType<typeof createOrUpdateDocumentFromInteractionRun>>;

async function runActivity(): Promise<ActivityResult> {
    return (await testEnv.run(createOrUpdateDocumentFromInteractionRun, createPayload())) as ActivityResult;
}

async function setupRun(json: unknown | undefined, text: string, parameters: Record<string, unknown> = {}) {
    const { setupActivity } = await import('../../dsl/setup/ActivityContext.js');
    update = vi.fn().mockResolvedValue({ id: 'object-1', name: 'doc' });
    retrieve = vi.fn().mockResolvedValue({
        id: 'run-1',
        modelId: 'test-model',
        parameters,
        result: runResult(json, text),
    });
    retrieveCanonical = vi.fn().mockResolvedValue(
        enhanceExperimentalCanonicalInteractionExecutionResult({
            run: {
                id: 'run-1',
                status: ExecutionRunStatus.completed,
                created_at: '2026-01-01T00:00:00.000Z',
                updated_at: '2026-01-01T00:00:00.000Z',
                retention: RunDataStorageLevel.STANDARD,
            },
            output: { status: 'unavailable', reason: 'not_recorded' },
            history: {
                status: 'unavailable',
                reason: 'not_recorded',
                retention: RunDataStorageLevel.STANDARD,
            },
        } satisfies ExperimentalCanonicalInteractionExecutionResult),
    );
    const client = {
        runs: {
            retrieve,
            retrieveCanonical,
        },
        objects: { update, create: vi.fn() },
        types: { getTypeByName: vi.fn() },
    } as unknown as VertesiaClient;
    vi.mocked(setupActivity).mockResolvedValue({
        client,
        objectId: 'object-1',
        params: { run_id: 'run-1', update_existing_id: 'object-1' },
    } as unknown as ActivityContext<Record<string, unknown>>);
}

function canonicalRun(
    blocks: ConversationAcceptedOutputFragment['turn']['blocks'],
    options: {
        generationStatus?: ConversationAcceptedOutputFragment['generation']['status'];
        turnStatus?: ConversationAcceptedOutputFragment['turn']['status'];
    } = {},
): EnhancedExperimentalCanonicalInteractionExecutionResult {
    const recordedAt = '2026-02-03T04:05:06.000Z';
    const fragment: ConversationAcceptedOutputFragment = {
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
            accepted_asset_ids: [],
        },
        turn: {
            id: 'turn-1',
            kind: 'agent',
            authority: 'ordinary',
            blocks,
            status: options.turnStatus ?? 'completed',
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
            requested_model: 'requested-model',
            resolved_model: 'canonical-model',
            provider: 'test-provider',
            protocol: 'test.protocol',
            adapter_version: 'test-adapter',
            status: options.generationStatus ?? 'completed',
            finish_reason: 'stop',
            timestamps: { recorded_at: recordedAt, completed_at: recordedAt },
            source: { conversation_id: 'conversation-1', revision: 0 },
        },
        assets: {},
        completeness: {
            history: 'omitted',
            native_replay: 'omitted',
            metadata: 'omitted',
            semantic_content: 'complete',
            omitted_block_ids: [],
            omitted_asset_ids: [],
        },
    };
    return enhanceExperimentalCanonicalInteractionExecutionResult({
        run: {
            id: 'run-1',
            status: ExecutionRunStatus.completed,
            created_at: '2026-02-03T04:05:06.000Z',
            updated_at: '2026-02-03T04:05:07.000Z',
            retention: RunDataStorageLevel.RESTRICTED,
        },
        output: { status: 'accepted', fragment },
        history: {
            status: 'unavailable',
            reason: 'retention_policy',
            retention: RunDataStorageLevel.RESTRICTED,
        },
    } satisfies ExperimentalCanonicalInteractionExecutionResult);
}

function createPayload(): DSLActivityExecutionPayload<Record<string, unknown>> {
    return {
        auth_token: 'test-token',
        account_id: 'test-account',
        project_id: 'test-project',
        params: {},
        config: { studio_url: 'http://test-studio', store_url: 'http://test-store' },
        workflow_name: 'StandardMediaIntakeWorkflow',
        event: ContentEventName.create,
        objectIds: ['object-1'],
        vars: {},
        activity: {
            name: 'createOrUpdateDocumentFromInteractionRun',
            params: { run_id: 'run-1', update_existing_id: 'object-1' },
        },
    } as unknown as DSLActivityExecutionPayload<Record<string, unknown>>;
}

describe('createOrUpdateDocumentFromInteractionRun', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('writes properties and reports target=properties for a JSON run', async () => {
        await setupRun({ title: 'A title', category: 'report' }, '');

        const result = await runActivity();

        expect(result.target).toBe('properties');
        const docPayload = update.mock.calls[0][1];
        expect(docPayload.properties).toEqual({ title: 'A title', category: 'report' });
        expect(docPayload.text).toBeUndefined();
        expect(docPayload.generation_run_info.target).toBe('properties');
    });

    it('writes text and reports target=text for a prose run', async () => {
        await setupRun(undefined, 'A prose summary of the audio.');

        const result = await runActivity();

        expect(result.target).toBe('text');
        const docPayload = update.mock.calls[0][1];
        expect(docPayload.text).toBe('A prose summary of the audio.');
        expect(docPayload.generation_run_info.target).toBe('text');
    });

    it('omits properties entirely for a prose run so existing properties are not erased', async () => {
        // A `properties: {}` in the update payload is a full replacement server-side, which would
        // wipe whatever the object already carried (and clear its derived embeddings with it).
        await setupRun(undefined, 'A prose summary of the audio.');

        await runActivity();

        const docPayload = update.mock.calls[0][1];
        expect(docPayload.properties).toBeUndefined();
        expect('properties' in docPayload && docPayload.properties !== undefined).toBe(false);
    });

    it('writes accepted canonical JSON when retained history and legacy result data are unavailable', async () => {
        await setupRun(undefined, 'legacy result must not be read');
        retrieveCanonical.mockResolvedValue(
            canonicalRun([{ id: 'block-1', type: 'json', value: { category: 'call' } }]),
        );
        retrieve.mockRejectedValue(new Error('legacy result is unavailable'));

        const result = await runActivity();

        expect(result.target).toBe('properties');
        expect(retrieve).toHaveBeenCalledOnce();
        expect(update.mock.calls[0][1]).toMatchObject({
            properties: { category: 'call' },
            generation_run_info: {
                id: 'run-1',
                date: '2026-02-03T04:05:06.000Z',
                model: 'canonical-model',
                target: 'properties',
            },
        });
    });

    it('writes accepted canonical text when retained history is unavailable', async () => {
        await setupRun(undefined, 'legacy result must not be read');
        retrieveCanonical.mockResolvedValue(
            canonicalRun([{ id: 'block-1', type: 'text', text: 'Canonical audio analysis.', format: 'plain' }]),
        );

        const result = await runActivity();

        expect(result.target).toBe('text');
        expect(retrieve).toHaveBeenCalledOnce();
        expect(update.mock.calls[0][1]).toMatchObject({ text: 'Canonical audio analysis.' });
    });

    it('preserves an available legacy input name without reading legacy output authority', async () => {
        await setupRun(undefined, 'legacy result must not be read', { name: 'Recorded call' });
        retrieveCanonical.mockResolvedValue(
            canonicalRun([{ id: 'block-1', type: 'text', text: 'Canonical audio analysis.', format: 'plain' }]),
        );

        await runActivity();

        expect(update.mock.calls[0][1]).toMatchObject({
            name: 'Recorded call',
            text: 'Canonical audio analysis.',
        });
    });

    it.each([
        ['failed generation and turn', { generationStatus: 'failed' as const, turnStatus: 'failed' as const }],
        [
            'cancelled generation and interrupted turn',
            { generationStatus: 'cancelled' as const, turnStatus: 'interrupted' as const },
        ],
        ['interrupted turn', { turnStatus: 'interrupted' as const }],
    ])('does not write an object for an accepted canonical output with a %s', async (_subject, options) => {
        await setupRun(undefined, 'legacy result must not be read');
        retrieveCanonical.mockResolvedValue(
            canonicalRun([{ id: 'block-1', type: 'text', text: 'Partial output.', format: 'plain' }], options),
        );

        await expect(runActivity()).rejects.toThrow('is not completed');
        expect(retrieve).not.toHaveBeenCalled();
        expect(update).not.toHaveBeenCalled();
    });

    it.each([null, [], 'text', 42])(
        'rejects non-object canonical JSON before object side effects: %j',
        async (value) => {
            await setupRun(undefined, 'legacy result must not be read');
            retrieveCanonical.mockResolvedValue(canonicalRun([{ id: 'block-1', type: 'json', value }]));

            await expect(runActivity()).rejects.toThrow('produced a non-object JSON output');
            expect(retrieve).not.toHaveBeenCalled();
            expect(update).not.toHaveBeenCalled();
        },
    );

    it('does not replace a pruned canonical output with a weaker legacy result', async () => {
        await setupRun(undefined, 'legacy result must not be used');
        retrieveCanonical.mockResolvedValue(
            enhanceExperimentalCanonicalInteractionExecutionResult({
                run: {
                    id: 'run-1',
                    status: ExecutionRunStatus.completed,
                    created_at: '2026-02-03T04:05:06.000Z',
                    updated_at: '2026-02-03T04:05:07.000Z',
                    retention: RunDataStorageLevel.RESTRICTED,
                },
                output: { status: 'unavailable', reason: 'pruned' },
                history: {
                    status: 'unavailable',
                    reason: 'pruned',
                    retention: RunDataStorageLevel.RESTRICTED,
                },
            } satisfies ExperimentalCanonicalInteractionExecutionResult),
        );

        await expect(runActivity()).rejects.toThrow('Canonical output for run run-1 is unavailable: pruned');
        expect(retrieve).not.toHaveBeenCalled();
        expect(update).not.toHaveBeenCalled();
    });
});
