import {
    type AppendRunConversationProgramTurnPayload,
    type AppendRunConversationToolResultsPayload,
    EXPERIMENTAL_CANONICAL_INTERACTION_API_VERSION_HEADER_VALUE,
    type ExperimentalCanonicalAsyncCompletionOptions,
    type ExperimentalCanonicalToolResultsPayload,
    type ExperimentalCanonicalUserMessagePayload,
    type ToolResultsPayload,
    type UserMessagePayload,
} from '@vertesia/common';
import { describe, expect, it, vi } from 'vitest';
import { VertesiaClient } from './client.js';

describe('RunsApi resume request options', () => {
    it('sends private headers on tool-result and user-message resumes', async () => {
        const requests: Request[] = [];
        const client = new VertesiaClient({
            serverUrl: 'https://studio.example.com',
            storeUrl: 'https://zeno.example.com',
            fetch: vi.fn(async () => Response.json({ result: [], prompt: [] })),
            onRequest: (request) => requests.push(request),
        });
        const options = { headers: { 'x-vertesia-required-tool-name': 'write_artifact' } };

        await client.runs.sendToolResults({} as ToolResultsPayload, options);
        await client.runs.sendUserMessage({} as UserMessagePayload, options);

        expect(requests.map((request) => request.headers.get('x-vertesia-required-tool-name'))).toEqual([
            'write_artifact',
            'write_artifact',
        ]);
    });
});

describe('RunsApi canonical retrieval', () => {
    it('uses the dedicated endpoint and preserves the unavailable result', async () => {
        const requests: Request[] = [];
        const response = { status: 'unavailable', reason: 'retention_policy', retention: 'STANDARD' };
        const client = new VertesiaClient({
            serverUrl: 'https://studio.example.com',
            storeUrl: 'https://zeno.example.com',
            fetch: vi.fn(async () => Response.json(response)),
            onRequest: (request) => requests.push(request),
        });
        expect(await client.runs.retrieveConversation('run-1')).toEqual(response);
        const request = requests[0];
        if (!request) throw new Error('Expected a conversation retrieval request');
        expect(new URL(request.url).pathname).toBe('/api/v1/runs/run-1/conversation');
        expect(request.method).toBe('GET');
    });

    it('posts canonical tool-result records to the run-scoped append endpoint', async () => {
        const requests: Request[] = [];
        const response = {
            conversation: { conversation_id: 'conversation-1', revision: 2 },
            operation_receipt: {
                id: 'append-1',
                conversation_id: 'conversation-1',
                payload_fingerprint: `sha256:${'0'.repeat(64)}`,
                base_revision: 1,
                result_revision: 2,
                recorded_at: '2026-09-30T00:00:00.000Z',
            },
            applied: true,
        };
        const client = new VertesiaClient({
            serverUrl: 'https://studio.example.com',
            storeUrl: 'https://zeno.example.com',
            fetch: vi.fn(async () => Response.json(response)),
            onRequest: (request) => requests.push(request),
        });
        const payload = { operation_id: 'append-1' } as AppendRunConversationToolResultsPayload;

        expect(
            await client.runs.appendConversationToolResults('run/1', payload, {
                headers: { 'X-Api-Version': '=1', 'x-trace': 'append' },
            }),
        ).toEqual(response);
        const request = requests[0];
        if (!request) throw new Error('Expected a canonical append request');
        expect(new URL(request.url).pathname).toBe('/api/v1/runs/run%2F1/conversation/tool-results');
        expect(request.method).toBe('POST');
        expect(request.headers.get('x-api-version')).toBe(EXPERIMENTAL_CANONICAL_INTERACTION_API_VERSION_HEADER_VALUE);
        expect(request.headers.get('x-trace')).toBe('append');
        await expect(request.json()).resolves.toEqual(payload);
    });

    it('posts a canonical program instruction with the exact experimental header', async () => {
        const requests: Request[] = [];
        const response = {
            conversation: { conversation_id: 'conversation-1', revision: 2 },
            operation_receipt: {
                id: 'controller-corrective:1',
                conversation_id: 'conversation-1',
                payload_fingerprint: `sha256:${'0'.repeat(64)}`,
                base_revision: 1,
                result_revision: 2,
                recorded_at: '2026-09-30T00:00:00.000Z',
            },
            applied: true,
        };
        const client = new VertesiaClient({
            serverUrl: 'https://studio.example.com',
            storeUrl: 'https://zeno.example.com',
            fetch: vi.fn(async () => Response.json(response)),
            onRequest: (request) => requests.push(request),
        });
        const payload = {
            conversation_id: 'conversation-1',
            expected_revision: 1,
            operation_id: 'controller-corrective:1',
            recorded_at: '2026-09-30T00:00:00.000Z',
            purpose: 'controller_corrective',
            text: 'Use a different tool before answering.',
        } satisfies AppendRunConversationProgramTurnPayload;

        expect(
            await client.runs.appendConversationProgramTurn('run/1', payload, {
                headers: { 'X-Api-Version': '=1', 'x-trace': 'program' },
            }),
        ).toEqual(response);
        const request = requests[0];
        if (!request) throw new Error('Expected a canonical program-turn append request');
        expect(new URL(request.url).pathname).toBe('/api/v1/runs/run%2F1/conversation/program-turns');
        expect(request.method).toBe('POST');
        expect(request.headers.get('x-api-version')).toBe(EXPERIMENTAL_CANONICAL_INTERACTION_API_VERSION_HEADER_VALUE);
        expect(request.headers.get('x-trace')).toBe('program');
        await expect(request.json()).resolves.toEqual(payload);
    });
});

describe('RunsApi exact-version canonical resume', () => {
    it('negotiates both existing paths without sending host state or altering stable requests', async () => {
        const requests: Request[] = [];
        const accepted = { status: 'accepted', run_id: 'execution:1', activity_id: 'activity:resume' };
        const client = new VertesiaClient({
            serverUrl: 'https://studio.example.com',
            storeUrl: 'https://zeno.example.com',
            fetch: vi.fn(async () => Response.json(accepted)),
            onRequest: (request) => requests.push(request),
        });
        client.withApiVersion('=1');
        const at = '2026-10-01T00:00:00.000Z';
        const asyncCompletion = {
            run_id: 'temporal-current-after-can',
            task_token: 'task-token-base64url',
            activity_id: 'activity:resume',
            canonical_state: { head: { conversation_id: 'conversation:resume', revision: 4 }, scope: 'root' },
            agent_acceptance: {
                version: 1,
                subject_agent_run_id: 'agent:owner',
                scope: 'root',
                activity_id: 'activity:resume',
            },
            canonical_output_reference: 'conversation_output_authority_v1',
        } satisfies ExperimentalCanonicalAsyncCompletionOptions;
        const resume = { run: { id: 'execution:1', account: 'account:1', project: 'project:1' }, asyncCompletion };
        const user = {
            ...resume,
            config: { environment: 'environment:1', model: 'model:1' },
            turn_selection: { mode: 'auto' },
            input_append: {
                expected_revision: 4,
                operation_id: 'input:user',
                recorded_at: at,
                records: {
                    turns: [
                        {
                            id: 'user:1',
                            kind: 'user',
                            authority: 'ordinary',
                            model_visibility: 'include',
                            status: 'completed',
                            timestamps: { recorded_at: at },
                            provenance: { type: 'received' },
                            blocks: [{ id: 'text:user', type: 'text', text: 'Continue.', format: 'plain' }],
                        },
                    ],
                    context_entries: [{ id: 'context:user', type: 'source_turn', turn_id: 'user:1' }],
                },
            },
        } satisfies ExperimentalCanonicalUserMessagePayload;
        const tools = {
            ...resume,
            asyncCompletion: {
                ...asyncCompletion,
                canonical_state: {
                    ...asyncCompletion.canonical_state,
                    materialized_input: { operation_id: 'input:tools', result_revision: 4 },
                },
            },
        } satisfies ExperimentalCanonicalToolResultsPayload;
        const options = { headers: { 'X-Api-Version': '=1', 'x-vertesia-required-tool-name': 'write_artifact' } };
        expect(await client.runs.sendCanonicalUserMessage(user, options)).toEqual(accepted);
        expect(await client.runs.sendCanonicalToolResults(tools, options)).toEqual(accepted);
        await client.runs.sendUserMessage({} as UserMessagePayload);
        expect(requests.map((request) => new URL(request.url).pathname)).toEqual([
            '/api/v1/runs/user-message',
            '/api/v1/runs/tool-results',
            '/api/v1/runs/user-message',
        ]);
        for (const request of requests.slice(0, 2)) {
            expect(request.headers.get('x-api-version')).toBe(
                EXPERIMENTAL_CANONICAL_INTERACTION_API_VERSION_HEADER_VALUE,
            );
            expect(request.headers.get('x-vertesia-required-tool-name')).toBe('write_artifact');
            const body = await request.json();
            expect(body.asyncCompletion).not.toHaveProperty('current_state');
            expect(body.asyncCompletion).not.toHaveProperty('output');
            for (const key of [
                'results',
                'tools',
                'conversation',
                'strip_options',
                'options',
                'environment',
                'message',
            ]) {
                expect(body).not.toHaveProperty(key);
            }
        }
        expect(requests[2]?.headers.get('x-api-version')).toBe('=1');
    });
});
