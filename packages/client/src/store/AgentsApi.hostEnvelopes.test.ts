import type { ExperimentalAgentRunControlNotification, ExperimentalAgentRunUpdatesResponse } from '@vertesia/common';
import { describe, expect, it, vi } from 'vitest';
import { ZenoClient } from './client.js';

const control: ExperimentalAgentRunControlNotification = {
    api_version: '=20260930',
    agent_run_id: 'child/run',
    scope: 'workstream:launch',
    workstream_id: 'node',
    type: 'run_control',
    timestamp: 1790812800000,
    control: {
        version: 1,
        event: 'user_input_received',
        event_id: 'control:one',
        ack: 'client:one',
        editing_action: { operation_id: 'edit:one', resource: { kind: 'store_document', document_id: 'document:one' } },
        request_input_response: { request_id: 'input:one' },
    },
};
const updates: ExperimentalAgentRunUpdatesResponse = {
    run: {
        api_version: '=20260930',
        agent_run_id: 'child/run',
        scope: 'workstream:launch',
        workstream_id: 'node',
        type: 'run_status',
        status: 'running',
        activity_state: 'idle',
        updated_at: '2026-10-01T00:00:00.000Z',
    },
    source: {
        api_version: '=20260930',
        agent_run_id: 'child/run',
        scope: 'workstream:launch',
        workstream_id: 'node',
        status: 'uninitialized',
    },
    controls: [control],
    control_page: { after: control.timestamp, has_more: false, gap_before: false },
};

describe('AgentsApi negotiated canonical host envelopes through actual fetch/SSE', () => {
    it('returns strict descriptor/status/control poll snapshots with the exact negotiated headers and route', async () => {
        const requests: Request[] = [];
        const fetchTransport: typeof fetch = async (input, init) => {
            requests.push(input instanceof Request ? input : new Request(input, init));
            return Response.json(updates);
        };
        const client = new ZenoClient({ serverUrl: 'https://store.test', apikey: 'token', fetch: fetchTransport });
        await expect(
            client.agents.retrieveCanonicalUpdates(
                'child/run',
                {
                    conversation_scope: 'workstream:launch',
                    workstream_id: 'node',
                },
                { headers: { 'x-trace': 'host-poll' } },
            ),
        ).resolves.toEqual(updates);
        const request = requests[0];
        const url = new URL(request.url);
        expect(url.pathname).toBe('/api/v1/agents/child%2Frun/updates');
        expect(Object.fromEntries(url.searchParams)).toEqual({
            conversation_scope: 'workstream:launch',
            workstream_id: 'node',
        });
        expect(request.headers.get('x-api-version')).toBe('=20260930');
        expect(request.headers.get('x-trace')).toBe('host-poll');
    });
    it('routes the actual canonical consumer to the negotiated run SSE and keeps host callbacks out of content', async () => {
        const requests: Request[] = [];
        const abort = new AbortController();
        const clear = { ...updates.source, type: 'preview_unavailable', reason: 'live_only' };
        const { status: _sourceStatus, ...first } = clear;
        const encoded = new TextEncoder().encode(
            [first, updates.run, control].map((value) => `data: ${JSON.stringify(value)}\n\n`).join(''),
        );
        const fetchTransport: typeof fetch = async (input, init) => {
            requests.push(input instanceof Request ? input : new Request(input, init));
            return new Response(
                new ReadableStream<Uint8Array>({
                    start(controller) {
                        controller.enqueue(encoded);
                        controller.close();
                    },
                }),
                { headers: { 'content-type': 'text/event-stream' } },
            );
        };
        const client = new ZenoClient({ serverUrl: 'https://store.test', apikey: 'token', fetch: fetchTransport });
        const content = vi.fn();
        const status = vi.fn();
        const controls = vi.fn(() => abort.abort());
        await client.agents.streamCanonicalConversation('child/run', content, {
            scope: 'workstream:launch',
            workstream_id: 'node',
            signal: abort.signal,
            max_reconnects: 0,
            on_run_status: status,
            on_run_control: controls,
        });
        expect(new URL(requests[0].url).pathname).toBe('/api/v1/agents/child%2Frun/stream');
        expect(requests[0].headers.get('x-api-version')).toBe('=20260930');
        expect(status).toHaveBeenCalledExactlyOnceWith(updates.run);
        expect(controls).toHaveBeenCalledExactlyOnceWith(control);
        expect(content).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ type: 'preview_unavailable' }));
    });
    it('rejects a poll snapshot with a foreign control or output mirror rather than parsing it as current state', async () => {
        for (const value of [
            { ...updates, controls: [{ ...control, agent_run_id: 'foreign:run' }] },
            { ...updates, messages: [] },
        ]) {
            const client = new ZenoClient({
                serverUrl: 'https://store.test',
                apikey: 'token',
                fetch: async () => Response.json(value),
            });
            await expect(client.agents.retrieveCanonicalUpdates('child/run')).rejects.toThrow();
        }
    });
});

it('uses an independent control delivery cursor on actual negotiated SSE reconnect', async () => {
    const requests: Request[] = [];
    const abort = new AbortController();
    const second = {
        ...control,
        timestamp: control.timestamp + 1,
        control: { ...control.control, event_id: 'control:two', ack: 'client:two' },
    };
    const fetchTransport: typeof fetch = async (input, init) => {
        requests.push(input instanceof Request ? input : new Request(input, init));
        const unavailable = {
            api_version: '=20260930',
            agent_run_id: 'child/run',
            scope: 'workstream:launch',
            workstream_id: 'node',
            type: 'preview_unavailable',
            reason: 'live_only',
        };
        const selected = requests.length === 1 ? control : second;
        return new Response([unavailable, selected].map((value) => `data: ${JSON.stringify(value)}\n\n`).join(''), {
            headers: { 'content-type': 'text/event-stream' },
        });
    };
    const client = new ZenoClient({ serverUrl: 'https://store.test', apikey: 'token', fetch: fetchTransport });
    const controls: string[] = [];
    await client.agents.streamCanonicalConversation('child/run', () => {}, {
        scope: 'workstream:launch',
        workstream_id: 'node',
        signal: abort.signal,
        max_reconnects: 1,
        reconnect_delay_ms: 0,
        on_run_control: (value) => {
            controls.push(value.control.event_id);
            if (value.control.event_id === second.control.event_id) abort.abort();
        },
    });
    expect(controls).toEqual(['control:one', 'control:two']);
    expect(new URL(requests[0].url).searchParams.get('control_after')).toBeNull();
    expect(new URL(requests[1].url).searchParams.get('control_after')).toBe(String(control.timestamp));
    for (const request of requests) {
        expect(new URL(request.url).searchParams.get('conversation_scope')).toBe('workstream:launch');
        expect(new URL(request.url).searchParams.get('workstream_id')).toBe('node');
    }
});
