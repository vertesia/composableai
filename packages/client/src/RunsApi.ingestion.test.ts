import { EXPERIMENTAL_CANONICAL_INTERACTION_API_VERSION_HEADER_VALUE, VERSION_HEADER } from '@vertesia/common';
import { describe, expect, it, vi } from 'vitest';
import { VertesiaClient } from './client.js';

describe('bounded ingestion SDK inspection transport only', () => {
    it.each(['preparation', 'recovery'] as const)(
        'uses the exact version and logical host reference for %s without nominating source or attempt',
        async (kind) => {
            const requests: Request[] = [];
            const response =
                kind === 'preparation'
                    ? { status: 'preparation_unavailable', reason: 'not_recorded' }
                    : { status: 'recovery_unavailable', reason: 'not_recorded' };
            const client = new VertesiaClient({
                serverUrl: 'https://studio.example.com',
                storeUrl: 'https://zeno.example.com',
                onRequest: (request) => requests.push(request.clone()),
                fetch: vi.fn(async () => Response.json(response)),
            });
            const abort = new AbortController();
            const targetKey = 'target:child/one';
            const operation =
                kind === 'preparation'
                    ? client.runs.retrieveCanonicalIngestionPreparation(
                          'run/one',
                          { target_key: targetKey, projection_id: `sha256:${'a'.repeat(64)}` },
                          { signal: abort.signal },
                      )
                    : client.runs.retrieveCanonicalIngestionRecovery(
                          'run/one',
                          { target_key: targetKey, request_id: 'actual:request/one' },
                          { signal: abort.signal },
                      );
            await expect(operation).resolves.toEqual(response);
            expect(requests).toHaveLength(1);
            const wire = requests[0];
            if (!wire) throw new Error('Expected serialized inspection');
            const url = new URL(wire.url);
            expect(url.pathname).toBe('/api/v1/runs/run%2Fone/conversation');
            expect(wire.method).toBe('GET');
            expect(wire.headers.get(VERSION_HEADER)).toBe(EXPERIMENTAL_CANONICAL_INTERACTION_API_VERSION_HEADER_VALUE);
            expect(url.searchParams.get('view')).toBe(`ingestion_${kind}`);
            expect(url.searchParams.get('target_key')).toBe(targetKey);
            expect([...url.searchParams.keys()].sort()).toEqual(
                kind === 'preparation' ? ['projection_id', 'target_key', 'view'] : ['request_id', 'target_key', 'view'],
            );
            expect(wire.body).toBeNull();
            abort.abort();
            expect(wire.signal.aborted).toBe(true);
        },
    );
});

it('serializes budget queue lookup as exact flat fields, preserving cancellation and the existing response', async () => {
    const requests: Request[] = [];
    const abort = new AbortController();
    const value = { status: 'preparation_unavailable', reason: 'not_recorded' };
    const client = new VertesiaClient({
        serverUrl: 'https://studio.example.com',
        storeUrl: 'https://zeno.example.com',
        onRequest: (request) => requests.push(request.clone()),
        fetch: vi.fn(async () => Response.json(value)),
    });
    await expect(
        client.runs.retrieveCanonicalIngestionBudgetQueue(
            'run/one',
            {
                target_key: 'target:child/one',
                queue_operation_id: 'queue/one',
                processor_id: 'externalize-text',
            },
            { signal: abort.signal },
        ),
    ).resolves.toEqual(value);
    expect(requests).toHaveLength(1);
    const wire = requests[0];
    if (!wire) throw new Error('Expected budget inspection HTTP request');
    const url = new URL(wire.url);
    expect(wire.method).toBe('GET');
    expect(url.pathname).toBe('/api/v1/runs/run%2Fone/conversation');
    expect(Object.fromEntries(url.searchParams)).toEqual({
        view: 'ingestion_budget_queue',
        target_key: 'target:child/one',
        queue_operation_id: 'queue/one',
        processor_id: 'externalize-text',
    });
    expect(wire.headers.get(VERSION_HEADER)).toBe(EXPERIMENTAL_CANONICAL_INTERACTION_API_VERSION_HEADER_VALUE);
    expect(wire.body).toBeNull();
    abort.abort();
    expect(wire.signal.aborted).toBe(true);
});
