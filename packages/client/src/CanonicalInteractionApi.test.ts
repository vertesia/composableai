import {
    EXPERIMENTAL_CANONICAL_INTERACTION_API_VERSION_HEADER_VALUE,
    ExecutionRunStatus,
    type ExperimentalCanonicalInteractionExecutionRequest,
    type ExperimentalCanonicalInteractionExecutionResult,
    RunDataStorageLevel,
    VERSION_HEADER,
} from '@vertesia/common';
import { describe, expect, it, vi } from 'vitest';
import { referenceInitialState } from './CanonicalInteractionOutput.js';
import { VertesiaClient } from './client.js';
import { INTERACTION_EXECUTION_TIMEOUT_MS } from './execute.js';

const recordedAt = '2026-09-30T00:00:00.000Z';

const request: ExperimentalCanonicalInteractionExecutionRequest = {
    initial_state: { type: 'new' },
    retention: RunDataStorageLevel.STANDARD,
    return_policy: { history: 'none' },
};

const response: ExperimentalCanonicalInteractionExecutionResult = {
    run: {
        id: 'run-1',
        status: ExecutionRunStatus.completed,
        interaction: 'interaction-1',
        created_at: recordedAt,
        updated_at: recordedAt,
        retention: RunDataStorageLevel.STANDARD,
    },
    output: { status: 'unavailable', reason: 'no_accepted_response' },
    history: {
        status: 'unavailable',
        reason: 'not_requested',
        retention: RunDataStorageLevel.STANDARD,
    },
};

describe('experimental canonical interaction API client', () => {
    it('pins every operation to the exact version and preserves the stable client default', async () => {
        const requests: Request[] = [];
        const client = new VertesiaClient({
            serverUrl: 'https://studio.example.com',
            storeUrl: 'https://zeno.example.com',
            fetch: vi.fn(async () => Response.json(response)),
            onRequest: (wireRequest) => requests.push(wireRequest),
        });
        const options = {
            headers: {
                'X-Api-Version': '20200101',
                'x-api-version': '>=20200101',
                'x-request-marker': 'kept',
            },
        };

        await client.interactions.executeCanonical('interaction/1', request, options);
        await client.interactions.executeCanonicalByName('Named@draft', request, options);
        await client.runs.createCanonical({ ...request, interaction: 'Named@draft' }, options);
        await client.runs.retrieveCanonical('run/1', options);

        expect(requests.map((wireRequest) => wireRequest.headers.get(VERSION_HEADER))).toEqual(
            Array(4).fill(EXPERIMENTAL_CANONICAL_INTERACTION_API_VERSION_HEADER_VALUE),
        );
        expect(requests.map((wireRequest) => wireRequest.headers.get('x-request-marker'))).toEqual(
            Array(4).fill('kept'),
        );
        expect(requests.map((wireRequest) => [wireRequest.method, new URL(wireRequest.url).pathname])).toEqual([
            ['POST', '/api/v1/interactions/interaction%2F1/execute'],
            ['POST', '/api/v1/execute'],
            ['POST', '/api/v1/runs'],
            ['GET', '/api/v1/runs/run%2F1'],
        ]);
    });

    it('uses the long inference timeout for canonical run creation by default', async () => {
        const timeout = vi.spyOn(AbortSignal, 'timeout');
        const client = new VertesiaClient({
            serverUrl: 'https://studio.example.com',
            storeUrl: 'https://zeno.example.com',
            fetch: vi.fn(async () => Response.json(response)),
        });

        await client.runs.createCanonical({ ...request, interaction: 'Named' });

        expect(timeout).toHaveBeenCalledWith(INTERACTION_EXECUTION_TIMEOUT_MS);
        timeout.mockRestore();
    });

    it('sends an exact server-issued reference as the canonical continuation state', async () => {
        const requests: Request[] = [];
        const referenced: ExperimentalCanonicalInteractionExecutionResult = {
            ...response,
            run: { ...response.run, retention: RunDataStorageLevel.DEBUG },
            history: {
                status: 'reference',
                reference: {
                    run_id: response.run.id,
                    conversation: { conversation_id: 'conversation-1', revision: 7 },
                },
            },
        };
        const continuation: ExperimentalCanonicalInteractionExecutionRequest = {
            initial_state: referenceInitialState(referenced, 'handoff:operation-1'),
            retention: RunDataStorageLevel.DEBUG,
            return_policy: { history: 'reference' },
        };
        const client = new VertesiaClient({
            serverUrl: 'https://studio.example.com',
            storeUrl: 'https://zeno.example.com',
            fetch: vi.fn(async () => Response.json(response)),
            onRequest: (wireRequest) => requests.push(wireRequest.clone()),
        });

        await client.interactions.executeCanonical('interaction-1', continuation);

        expect(await requests[0].json()).toEqual(continuation);
        expect(requests[0].headers.get(VERSION_HEADER)).toBe(
            EXPERIMENTAL_CANONICAL_INTERACTION_API_VERSION_HEADER_VALUE,
        );
    });

    it('preserves strict canonical turn selection in the request body', async () => {
        const requests: Request[] = [];
        const selected: ExperimentalCanonicalInteractionExecutionRequest = {
            ...request,
            turn_selection: { mode: 'required', tool_name: 'lookup' },
        };
        const client = new VertesiaClient({
            serverUrl: 'https://studio.example.com',
            storeUrl: 'https://zeno.example.com',
            fetch: vi.fn(async () => Response.json(response)),
            onRequest: (wireRequest) => requests.push(wireRequest.clone()),
        });

        await client.interactions.executeCanonical('interaction-1', selected);

        expect(await requests[0].json()).toEqual(selected);
    });
});
